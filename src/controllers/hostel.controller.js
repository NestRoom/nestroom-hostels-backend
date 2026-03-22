/**
 * src/controllers/hostel.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Hostel API lets the logged-in admin view and update their hostel's
 * details (name, address, city, state, amenities, logo).
 *
 * OWNERSHIP CHECK:
 * A hostel belongs to one admin. We always look up the hostel using
 * `req.user.hostelId` (from the JWT) — an admin can only ever touch THEIR
 * own hostel. No separate ownership check is needed because the hostelId in
 * the JWT is set at registration and controlled by our backend.
 *
 * HOSTEL CREATION:
 * Hostels are created automatically during `POST /api/auth/register`.
 * Google SSO and WhatsApp OTP users begin with `hostelId: null` and must
 * create their hostel through `POST /api/hostels/setup` as a one-time
 * onboarding step (this is different from the update route).
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

function sanitizeHostel(hostel) {
  return {
    id: hostel._id.toString(),
    name: hostel.name,
    hostelId: hostel.hostelId,
    address: hostel.address,
    city: hostel.city,
    state: hostel.state,
    totalRooms: hostel.totalRooms,
    amenities: hostel.amenities || [],
    logo: hostel.logo || null,
    createdAt: hostel.createdAt,
    updatedAt: hostel.updatedAt,
  };
}

// ---------------------------------------------------------------
// GET /api/hostels/me
// Returns the hostel document linked to the logged-in admin.
// ---------------------------------------------------------------
async function getMyHostel(req, res) {
  const db = getDb();

  // If the user registered via Google SSO or WhatsApp OTP they may not
  // have a hostel yet. We return a clear message so the frontend can
  // redirect them to the hostel setup page.
  if (!req.user.hostelId) {
    return res.status(404).json({
      success: false,
      message: 'No hostel linked to your account. Please complete hostel setup.',
    });
  }

  const hostel = await db.collection('hostels').findOne({
    _id: new ObjectId(req.user.hostelId),
  });

  if (!hostel) {
    return res.status(404).json({ success: false, message: 'Hostel not found.' });
  }

  return res.status(200).json({ success: true, hostel: sanitizeHostel(hostel) });
}

// ---------------------------------------------------------------
// PUT /api/hostels/me
// Updates the hostel's details. Only the admin who owns the hostel
// can update it (enforced by hostelId scoping from JWT).
// ---------------------------------------------------------------
async function updateMyHostel(req, res) {
  const db = getDb();

  if (!req.user.hostelId) {
    return res.status(404).json({ success: false, message: 'No hostel linked to your account.' });
  }

  const { name, address, city, state, totalRooms, amenities, logo } = req.body;

  // Build the $set object with only fields that were actually sent
  const updates = {};
  if (name !== undefined)       updates.name = name.trim();
  if (address !== undefined)    updates.address = address.trim();
  if (city !== undefined)       updates.city = city.trim();
  if (state !== undefined)      updates.state = state.trim();
  if (totalRooms !== undefined) updates.totalRooms = Number(totalRooms);
  if (amenities !== undefined)  updates.amenities = amenities; // array
  if (logo !== undefined)       updates.logo = logo;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields provided to update.' });
  }

  updates.updatedAt = new Date();

  const result = await db.collection('hostels').findOneAndUpdate(
    { _id: new ObjectId(req.user.hostelId) },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) {
    return res.status(404).json({ success: false, message: 'Hostel not found.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Hostel updated.',
    hostel: sanitizeHostel(result),
  });
}

// ---------------------------------------------------------------
// POST /api/hostels/setup
// One-time setup for Google SSO / WhatsApp OTP users who don't have
// a hostel yet. Creates the hostel and links it to the user account.
//
// WHY SEPARATE FROM REGISTER:
// Registration with email/password creates the hostel in one step.
// OAuth/OTP users bypass the registration form, so they start without
// a hostel. This endpoint serves as their onboarding step.
// ---------------------------------------------------------------
async function setupHostel(req, res) {
  const db = getDb();

  // Prevent duplicate hostel creation
  if (req.user.hostelId) {
    return res.status(409).json({
      success: false,
      message: 'Your account already has a hostel. Use PUT /api/hostels/me to update it.',
    });
  }

  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Hostel name is required.' });
  }

  const now = new Date();
  const hostelDoc = {
    name: name.trim(),
    hostelId: `NR-${Date.now()}`,
    address: '',
    city: '',
    state: '',
    adminUserId: new ObjectId(req.user.userId),
    totalRooms: 0,
    amenities: [],
    logo: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('hostels').insertOne(hostelDoc);

  // Link the new hostel back to the user document
  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.userId) },
    { $set: { hostelId: result.insertedId, updatedAt: now } }
  );

  return res.status(201).json({
    success: true,
    message: 'Hostel created and linked to your account.',
    hostel: sanitizeHostel({ ...hostelDoc, _id: result.insertedId }),
  });
}

module.exports = { getMyHostel, updateMyHostel, setupHostel };
