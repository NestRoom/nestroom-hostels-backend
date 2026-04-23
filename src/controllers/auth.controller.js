const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");

const User = require("../models/User.model");
const Hostel = require("../models/Hostel.model");
const Resident = require("../models/Resident.model");
const Employee = require("../models/Employee.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const {
  generateOwnerId,
  generateHostelId,
  generateHostelCode,
} = require("../utils/idGenerator");
const { createOTP, verifyOTP } = require("../services/otp");
const { sendOTPEmail, sendCredentialsEmail, sendPasswordResetEmail } = require("../services/email");
const { sendOTPWhatsapp } = require("../services/whatsapp");
const { encrypt, decrypt } = require("../services/encryption");

// ─── Token Helpers ────────────────────────────────────────────────────────────

const signAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

const signRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  });

const issueTokenPair = async (user) => {
  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);
  // Persist hashed refresh token
  user.refreshToken = await bcrypt.hash(refreshToken, 8);
  await user.save();
  return { accessToken, refreshToken };
};

// ─── 1.1 Owner Sign-Up (Initialize) ─────────────────────────────────────────────
const ownerSignup = asyncHandler(async (req, res) => {
  const { email, whatsappNumber, ownerName } = req.body;

  // Uniqueness checks
  const existingUser = await User.findOne({ $or: [{ email }, { whatsappNumber }] });
  if (existingUser) {
    if (existingUser.email === email)
      throw createError("Email already registered", 409, "EMAIL_EXISTS");
    throw createError("WhatsApp number already registered", 409, "WHATSAPP_EXISTS");
  }

  // Generate & send Email OTP
  const emailOtp = createOTP("email", email);
  try {
    await sendOTPEmail(email, emailOtp, ownerName);
  } catch (e) {
    console.error("OTP email send failed:", e.message);
  }

  // Generate & send WhatsApp OTP temporarily disabled
  // const waOtp = createOTP("whatsapp", whatsappNumber);
  // try {
  //   await sendOTPWhatsapp(whatsappNumber, waOtp);
  // } catch (e) {
  //   console.error("WhatsApp OTP send failed:", e.message);
  // }

  return sendSuccess(
    res,
    {
      email,
      whatsappNumber,
      message: "Verification OTP sent to your email",
    },
    201
  );
});

// ─── 1.2 Verify Sign-Up & Create User ─────────────────────────────────────────
const verifyOwnerSignup = asyncHandler(async (req, res) => {
  const { hostelName, ownerName, whatsappNumber, email, password, emailOtp, whatsappOtp } = req.body;

  // Verify Email OTP
  const emailResult = verifyOTP("email", email, emailOtp);
  if (!emailResult.valid) throw createError(`Email OTP: ${emailResult.reason}`, 400, "INVALID_OTP");

  // Verify WhatsApp OTP temporarily disabled
  // const waResult = verifyOTP("whatsapp", whatsappNumber, whatsappOtp);
  // if (!waResult.valid) throw createError(`WhatsApp OTP: ${waResult.reason}`, 400, "INVALID_OTP");

  // Re-check uniqueness just in case
  const existingUser = await User.findOne({ $or: [{ email }, { whatsappNumber }] });
  if (existingUser) {
    throw createError("User already registered during verification process", 409, "USER_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = generateOwnerId();

  // Create User
  const user = await User.create({
    userId,
    userType: "owner",
    email,
    passwordHash,
    whatsappNumber,
    fullName: ownerName,
    emailVerified: true,
    emailVerifiedAt: new Date(),
    whatsappVerified: true,
    whatsappVerifiedAt: new Date(),
    lastLogin: new Date()
  });

  // Create first Hostel
  const hostelId = generateHostelId();
  const hostelCode = generateHostelCode(hostelName, "");
  await Hostel.create({
    hostelId,
    hostelCode,
    ownerId: user._id,
    hostelName,
    contactPerson: ownerName,
    contactEmail: email,
    whatsappNumber,
  });

  const { accessToken, refreshToken } = await issueTokenPair(user);

  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user: {
      userId: user.userId,
      email: user.email,
      userType: user.userType,
    },
    message: "Signup and verification successful",
  });
});

// ─── 1.4 Resident Login ───────────────────────────────────────────────────────
const residentLogin = asyncHandler(async (req, res) => {
  const { residentId, email, password } = req.body;

  // Find resident by residentId and email
  const resident = await Resident.findOne({ residentId, email })
    .populate("userId")
    .populate("hostelId")
    .populate("roomId", "roomNumber")
    .populate("bedId", "bedNumber")
    .lean();

  if (!resident) throw createError("Invalid resident code or email", 401, "INVALID_CREDENTIALS");

  const user = await User.findById(resident.userId._id);
  if (!user) throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  // Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  if (!user.isActive) throw createError("Account is deactivated", 403, "ACCOUNT_DEACTIVATED");
  if (user.isSuspended) throw createError("Account is suspended", 403, "ACCOUNT_SUSPENDED");

  user.lastLogin = new Date();
  const { accessToken, refreshToken } = await issueTokenPair(user);

  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user: {
      residentId: resident.residentId,
      fullName: resident.fullName,
      email: resident.email,
      userType: "resident",
      hostelId: resident.hostelId?._id,
      hostelName: resident.hostelId?.hostelName,
      roomNumber: resident.roomId?.roomNumber || null,
      bedNumber: resident.bedId?.bedNumber || null,
    },
  });
});

// ─── 1.5 General Login (Owner / Employee) ─────────────────────────────────────
const generalLogin = asyncHandler(async (req, res) => {
  const { email, password, totpToken } = req.body;

  const user = await User.findOne({ email, userType: { $in: ["owner", "employee"] } });
  if (!user) throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) throw createError("Invalid credentials", 401, "INVALID_CREDENTIALS");

  if (!user.isActive) throw createError("Account is deactivated", 403, "ACCOUNT_DEACTIVATED");
  if (user.isSuspended) throw createError("Account is suspended", 403, "ACCOUNT_SUSPENDED");

  // 2FA gate — if enabled, require TOTP
  if (user.twoFactorEnabled) {
    if (!totpToken) {
      return sendSuccess(res, { requiresTwoFactor: true }, 200);
    }
    const valid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: "base32",
      token: totpToken,
      window: 1,
    });
    if (!valid) throw createError("Invalid 2FA code", 401, "INVALID_2FA");
  }

  user.lastLogin = new Date();
  const { accessToken, refreshToken } = await issueTokenPair(user);

  const userOut = {
    userId: user.userId,
    email: user.email,
    userType: user.userType,
    fullName: user.fullName,
  };

  // Attach employee info
  if (user.userType === "employee") {
    const emp = await Employee.findOne({ userId: user._id }).lean();
    userOut.employeeId = emp?.employeeId;
    userOut.position = emp?.position;
    userOut.hostelId = emp?.hostelId;
    userOut.permissions = emp?.permissions;
  }

  return sendSuccess(res, { accessToken, refreshToken, user: userOut });
});

// ─── 1.5.1 Get Me (My Profile) ────────────────────────────────────────────────
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).lean();
  if (!user) throw createError("User not found", 404, "USER_NOT_FOUND");
  
  // Exclude sensitive manually if lean
  delete user.passwordHash;
  delete user.twoFactorSecret;
  delete user.twoFactorSecretPending;
  delete user.verificationToken;
  delete user.whatsappOtp;
  delete user.resetToken;
  delete user.refreshToken;

  // Include all hostels if owner
  if (user.userType === "owner") {
    const hostels = await Hostel.find({ ownerId: user._id }).lean();
    
    user.hostels = hostels.map(h => {
      // Decrypt bank details if present
      if (h.bankDetails?.accountNumber) {
        h.bankDetails.accountNumber = decrypt(h.bankDetails.accountNumber);
      }
      return h;
    });
  }

  return sendSuccess(res, { user });
});

// ─── 1.5.2 Update Me (My Profile) ─────────────────────────────────────────────
const updateMe = asyncHandler(async (req, res) => {
  const { fullName, email, whatsappNumber, profilePhoto, coverPhoto } = req.body;
  const updatePayload = {};
  
  if (fullName !== undefined) updatePayload.fullName = fullName;
  if (profilePhoto !== undefined) updatePayload.profilePhoto = profilePhoto;
  if (coverPhoto !== undefined) updatePayload.coverPhoto = coverPhoto;
  
  // Note: updating email/whatsapp might require re-verification conceptually, but we allow simple update here
  if (email !== undefined) updatePayload.email = email;
  if (whatsappNumber !== undefined) updatePayload.whatsappNumber = whatsappNumber;

  const user = await User.findByIdAndUpdate(req.user._id, { $set: updatePayload }, { new: true }).lean();
  
  delete user.passwordHash;
  delete user.twoFactorSecret;
  delete user.twoFactorSecretPending;
  
  return sendSuccess(res, { message: "Profile updated successfully", user });
});

// ─── 1.6 Logout ───────────────────────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  // Clear stored refresh token
  req.user.refreshToken = null;
  await req.user.save();

  return sendSuccess(res, { message: "Logged out successfully" });
});

// ─── 1.7 Refresh Token ────────────────────────────────────────────────────────
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
  } catch {
    throw createError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.refreshToken) throw createError("Refresh token revoked", 401, "TOKEN_REVOKED");

  // Verify token matches stored hash
  const isValid = await bcrypt.compare(token, user.refreshToken);
  if (!isValid) throw createError("Refresh token mismatch", 401, "INVALID_REFRESH_TOKEN");

  const { accessToken, refreshToken: newRefresh } = await issueTokenPair(user);

  return sendSuccess(res, { accessToken, refreshToken: newRefresh });
});

// ─── 1.8 Setup 2FA ────────────────────────────────────────────────────────────
const setup2FA = asyncHandler(async (req, res) => {
  const secret = speakeasy.generateSecret({ name: `nestRoom (${req.user.email})` });

  // Temporarily store the pending secret (not yet confirmed)
  req.user.twoFactorSecretPending = secret.base32;
  await req.user.save();

  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

  return sendSuccess(res, {
    secret: secret.base32,
    qrCode: qrCodeUrl,
    message: "Scan the QR code with Google Authenticator, then call /verify-2fa to confirm",
  });
});

// ─── 1.9 Verify & Enable 2FA ─────────────────────────────────────────────────
const verify2FA = asyncHandler(async (req, res) => {
  const { token, secret } = req.body;

  const valid = speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1,
  });

  if (!valid) throw createError("Invalid 2FA token", 400, "INVALID_2FA");

  req.user.twoFactorEnabled = true;
  req.user.twoFactorSecret = secret;
  req.user.twoFactorSecretPending = null;
  await req.user.save();

  return sendSuccess(res, { message: "2FA enabled successfully" });
});

// ─── 1.10 Forgot Password ─────────────────────────────────────────────────────
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  // Always return success to prevent user enumeration
  if (!user) {
    return sendSuccess(res, { message: "If that email exists, a reset OTP has been sent." });
  }

  const otp = createOTP("reset", email);
  try {
    await sendPasswordResetEmail(email, otp, user.fullName);
  } catch (e) {
    console.error("Password reset email failed:", e.message);
  }

  return sendSuccess(res, { message: "If that email exists, a reset OTP has been sent." });
});

// ─── 1.11 Reset Password ──────────────────────────────────────────────────────
const resetPassword = asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const result = verifyOTP("reset", email, otp);
  if (!result.valid) throw createError(result.reason, 400, "INVALID_OTP");

  const user = await User.findOne({ email });
  if (!user) throw createError("User not found", 404, "USER_NOT_FOUND");

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.refreshToken = null; // invalidate all sessions
  await user.save();

  return sendSuccess(res, { message: "Password reset successfully. Please log in again." });
});

// ─── 1.12 Change Password ─────────────────────────────────────────────────────
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);

  if (!user) throw createError("User not found", 404, "USER_NOT_FOUND");

  // Verify current password
  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) throw createError("Current password incorrect", 400, "INVALID_PASSWORD");

  // Hash new password
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  
  // If resident, also update encrypted password for admin view
  if (user.userType === "resident") {
    user.passwordEncrypted = encrypt(newPassword);
  }

  await user.save();

  return sendSuccess(res, { message: "Password updated successfully" });
});

module.exports = {
  ownerSignup,
  verifyOwnerSignup,
  residentLogin,
  generalLogin,
  logout,
  refreshToken,
  setup2FA,
  verify2FA,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateMe,
};
