/**
 * src/controllers/auth.controller.js
 *
 * WHY THIS FILE EXISTS:
 * Controllers contain the actual business logic for each route. They:
 *   1. Read validated data from req.body / req.user
 *   2. Interact with the database (getDb().collection(...))
 *   3. Call external services when needed (firebase-admin, Meta API)
 *   4. Send a response
 *
 * Controllers do NOT validate (that's middleware/validate.js) and do NOT
 * define routes (that's routes/auth.routes.js).
 *
 * RESPONSE FORMAT:
 * All responses follow a consistent shape:
 *   Success: { success: true, token: "...", user: {...} }
 *   Error:   { success: false, message: "..." }
 * This consistency makes frontend error handling predictable.
 */

const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const { getDb } = require('../config/db');
const { verifyFirebaseToken } = require('../config/firebase');
const { signToken } = require('../utils/jwt');
const generateOtp = require('../utils/generateOtp');
const { sendWhatsAppOtp: dispatchWhatsAppOtp } = require('../utils/whatsapp');

// WHY 12 ROUNDS: bcrypt's cost factor. 12 rounds means bcrypt performs 2^12 = 4096
// iterations of hashing. Takes ~300ms on modern hardware — fast enough for users,
// too slow for brute-forcers trying millions of combinations per second.
const BCRYPT_ROUNDS = 12;

// OTP expires in 5 minutes (in milliseconds)
const OTP_EXPIRY_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------
// HELPER: Build a safe user object to return to the client.
// WHY: We never include passwordHash, googleUid, or raw MongoDB fields
// in API responses. This function whitelists only safe fields.
// ---------------------------------------------------------------
function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hostelId: user.hostelId?.toString(),
    photoURL: user.photoURL,
    lastLogin: user.lastLogin,
  };
}

// ---------------------------------------------------------------
// HELPER: Creates a hostel record for a new admin registration.
// Called only from register() because Google SSO and WhatsApp OTP
// users are prompted to complete their hostel profile separately.
// ---------------------------------------------------------------
async function createHostelForAdmin(db, adminUserId, hostelName) {
  const hostelId = `NR-${Date.now()}`; // Simple unique slug for now
  const now = new Date();
  const result = await db.collection('hostels').insertOne({
    name: hostelName,
    hostelId,
    address: '',
    city: '',
    state: '',
    adminUserId: new ObjectId(adminUserId),
    totalRooms: 0,
    amenities: [],
    logo: null,
    createdAt: now,
    updatedAt: now,
  });
  return result.insertedId;
}

// ---------------------------------------------------------------
// POST /api/auth/register
// Flow: validate → hash password → insert user → create hostel → JWT
// ---------------------------------------------------------------
async function register(req, res) {
  const { name, hostelName, email, password } = req.body;
  const db = getDb();

  // Check if email already exists
  const existing = await db.collection('users').findOne({ email });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists.',
    });
  }

  // Hash the password before storing
  // WHY NOT STORE PLAIN TEXT: If the database is breached, attackers get
  // only bcrypt hashes, not the real passwords. Bcrypt hashing is one-way —
  // you can verify a password against a hash but cannot reverse the hash.
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const now = new Date();
  const userDoc = {
    googleUid: null,          // Not a Google user
    name,
    email,
    phone: null,              // Not set at registration (email signup)
    passwordHash,
    role: 'admin',
    hostelId: null,           // Will be set after hostel creation
    photoURL: null,
    lastLogin: now,
    createdAt: now,
    updatedAt: now,
  };

  const userResult = await db.collection('users').insertOne(userDoc);
  const userId = userResult.insertedId;

  // Create the hostel record and link it back to the user
  const hostelObjectId = await createHostelForAdmin(db, userId, hostelName);
  await db.collection('users').updateOne(
    { _id: userId },
    { $set: { hostelId: hostelObjectId, updatedAt: new Date() } }
  );

  const token = signToken({
    userId: userId.toString(),
    role: 'admin',
    hostelId: hostelObjectId.toString(),
  });

  return res.status(201).json({
    success: true,
    token,
    user: sanitizeUser({ ...userDoc, _id: userId, hostelId: hostelObjectId }),
  });
}

// ---------------------------------------------------------------
// POST /api/auth/login
// Flow: find user by email → compare password → update lastLogin → JWT
// ---------------------------------------------------------------
async function login(req, res) {
  const { email, password } = req.body;
  const db = getDb();

  const user = await db.collection('users').findOne({ email });

  // WHY SAME ERROR FOR "user not found" AND "wrong password":
  // If we said "user not found", an attacker could enumerate which emails
  // are registered. Generic message prevents this (user enumeration attack).
  if (!user || !user.passwordHash) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  }

  // Update lastLogin timestamp
  await db.collection('users').updateOne(
    { _id: user._id },
    { $set: { lastLogin: new Date(), updatedAt: new Date() } }
  );

  const token = signToken({
    userId: user._id.toString(),
    role: user.role,
    hostelId: user.hostelId?.toString(),
  });

  return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
}

// ---------------------------------------------------------------
// POST /api/auth/google
// Flow: verify Firebase ID Token → extract Google user info →
//       upsert in users collection → JWT
//
// WHY UPSERT (not insert):
// The same user might sign in via Google multiple times (sign in again on
// a new device, token expired, etc.). We use findOneAndUpdate with upsert:true
// so if the user exists, we update their lastLogin; if they're new, we create them.
// ---------------------------------------------------------------
async function googleAuth(req, res) {
  const { idToken } = req.body;
  const db = getDb();

  // This throws if the token is invalid, expired, or from a different Firebase project
  let decoded;
  try {
    decoded = await verifyFirebaseToken(idToken);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid Google token.' });
  }

  const { uid: googleUid, email, name, picture: photoURL } = decoded;
  const now = new Date();

  // Find existing user by googleUid OR email (handles case where same email
  // was previously registered by email/password — we link the Google account)
  let user = await db.collection('users').findOne({
    $or: [{ googleUid }, { email }],
  });

  if (user) {
    // Update existing user with Google info
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          googleUid,
          photoURL: photoURL || user.photoURL,
          lastLogin: now,
          updatedAt: now,
        },
      }
    );
    user = await db.collection('users').findOne({ _id: user._id });
  } else {
    // New user via Google — create account (no hostel yet, they'll set it up)
    const newUser = {
      googleUid,
      name: name || 'Admin',
      email,
      phone: null,
      passwordHash: null,
      role: 'admin',
      hostelId: null, // Google users complete hostel setup in the profile page
      photoURL,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('users').insertOne(newUser);
    user = { ...newUser, _id: result.insertedId };
  }

  const token = signToken({
    userId: user._id.toString(),
    role: user.role,
    hostelId: user.hostelId?.toString() || null,
  });

  return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
}

// ---------------------------------------------------------------
// POST /api/auth/whatsapp/send-otp
// Flow: normalize phone → delete any old OTP → generate OTP →
//       hash OTP → store in otp_sessions → send via Meta API
// ---------------------------------------------------------------
async function sendWhatsAppOtp(req, res) {
  const { phone } = req.body;
  const db = getDb();

  // Normalize phone to E.164 with + prefix
  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  // Delete any existing OTP for this phone (user might be re-requesting)
  // WHY: Prevents multiple valid OTPs existing simultaneously for the same phone.
  await db.collection('otp_sessions').deleteMany({ phone: normalizedPhone });

  const otp = generateOtp();

  // Hash the OTP before storing — same principle as password hashing.
  // If someone reads the DB, they can't recover the OTP.
  // WHY ONLY 8 ROUNDS (not 12): OTPs expire in 5 min so brute-force risk is low.
  // Lower rounds = faster hashing, which matters since users are waiting for a response.
  const otpHash = await bcrypt.hash(otp, 8);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  await db.collection('otp_sessions').insertOne({
    phone: normalizedPhone,
    otpHash,
    expiresAt,
    createdAt: new Date(),
  });

  // Send the OTP via Meta WhatsApp Cloud API
  await dispatchWhatsAppOtp(normalizedPhone, otp);

  // WHY NOT RETURN THE OTP: Never return the OTP in the API response.
  // An attacker intercepting network traffic would immediately get the OTP.
  return res.status(200).json({
    success: true,
    message: `OTP sent to ${normalizedPhone} via WhatsApp`,
    expiresIn: '5 minutes',
  });
}

// ---------------------------------------------------------------
// POST /api/auth/whatsapp/verify-otp
// Flow: find OTP session → check expiry → compare hash →
//       delete session → upsert user → JWT
// ---------------------------------------------------------------
async function verifyWhatsAppOtp(req, res) {
  const { phone, otp } = req.body;
  const db = getDb();

  const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

  const session = await db.collection('otp_sessions').findOne({ phone: normalizedPhone });

  if (!session) {
    return res.status(400).json({ success: false, message: 'OTP not found. Please request a new one.' });
  }

  // Double-check expiry (the TTL index also does this, but we check explicitly
  // to give a clear error message rather than a generic "session not found")
  if (new Date() > session.expiresAt) {
    await db.collection('otp_sessions').deleteOne({ _id: session._id });
    return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
  }

  const isMatch = await bcrypt.compare(otp, session.otpHash);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Invalid OTP.' });
  }

  // Consume the OTP — delete the session so it cannot be reused
  // WHY: OTPs must be single-use. An attacker who captures the OTP once
  // should not be able to use it a second time.
  await db.collection('otp_sessions').deleteOne({ _id: session._id });

  const now = new Date();

  // Upsert user by phone number
  let user = await db.collection('users').findOne({ phone: normalizedPhone });

  if (user) {
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLogin: now, updatedAt: now } }
    );
    user = await db.collection('users').findOne({ _id: user._id });
  } else {
    // New user — create with phone only. They'll fill in name and hostel in the app.
    const newUser = {
      googleUid: null,
      name: 'Admin',
      email: null,
      phone: normalizedPhone,
      passwordHash: null,
      role: 'admin',
      hostelId: null,
      photoURL: null,
      lastLogin: now,
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection('users').insertOne(newUser);
    user = { ...newUser, _id: result.insertedId };
  }

  const token = signToken({
    userId: user._id.toString(),
    role: user.role,
    hostelId: user.hostelId?.toString() || null,
  });

  return res.status(200).json({ success: true, token, user: sanitizeUser(user) });
}

// ---------------------------------------------------------------
// GET /api/auth/me (protected — runs after auth middleware)
// WHY: Frontend calls this to get fresh user data from DB.
// req.user is the decoded JWT payload (attached by auth middleware).
// ---------------------------------------------------------------
async function getMe(req, res) {
  const db = getDb();
  const user = await db.collection('users').findOne({
    _id: new ObjectId(req.user.userId),
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  return res.status(200).json({ success: true, user: sanitizeUser(user) });
}

module.exports = {
  register,
  login,
  googleAuth,
  sendWhatsAppOtp,
  verifyWhatsAppOtp,
  getMe,
};
