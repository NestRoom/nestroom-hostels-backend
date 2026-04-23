const Joi = require("joi");

const passwordSchema = Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/)
  .message("Password must be at least 8 characters with uppercase, lowercase, number and special character");

const phoneSchema = Joi.string()
  .pattern(/^\+[1-9]\d{6,14}$/)
  .message("Phone must be in E.164 format (e.g. +919876543210)");

// ── 1.1 Owner Signup ──────────────────────────────────────────────────────────
const ownerSignupSchema = Joi.object({
  hostelName: Joi.string().min(2).max(100).trim().required(),
  ownerName: Joi.string().min(2).max(100).trim().required(),
  numberOfHostels: Joi.number().integer().min(1).max(100).default(1),
  whatsappNumber: phoneSchema.required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: passwordSchema.required(),
  confirmPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .messages({ "any.only": "Passwords do not match" }),
});

// ── 1.2 Verify Sign-Up ────────────────────────────────────────────────────────
const verifyOwnerSignupSchema = Joi.object({
  hostelName: Joi.string().min(2).max(100).trim().required(),
  ownerName: Joi.string().min(2).max(100).trim().required(),
  whatsappNumber: phoneSchema.required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: passwordSchema.required(),
  emailOtp: Joi.string().length(6).pattern(/^\d+$/).required(),
});

// ── 1.4 Resident Login ────────────────────────────────────────────────────────
const residentLoginSchema = Joi.object({
  residentId: Joi.string().trim().required(),
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
});

// ── Change Password ───────────────────────────────────────────────────────────
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: passwordSchema.required(),
  confirmPassword: Joi.any()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Passwords do not match" }),
});

// ── 1.5 General Login (Owner / Employee) ──────────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  password: Joi.string().required(),
  totpToken: Joi.string().length(6).pattern(/^\d+$/).optional(), // 2FA TOTP
});

// ── 1.7 Refresh Token ─────────────────────────────────────────────────────────
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ── 1.9 Verify 2FA ────────────────────────────────────────────────────────────
const verify2FASchema = Joi.object({
  token: Joi.string().length(6).pattern(/^\d+$/).required(),
  secret: Joi.string().required(),
});

// ── Forgot Password ───────────────────────────────────────────────────────────
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
});

// ── Reset Password ────────────────────────────────────────────────────────────
const resetPasswordSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  newPassword: passwordSchema.required(),
  confirmPassword: Joi.any()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Passwords do not match" }),
});

module.exports = {
  ownerSignupSchema,
  verifyOwnerSignupSchema,
  residentLoginSchema,
  loginSchema,
  refreshTokenSchema,
  verify2FASchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
};
