const express = require("express");
const router = express.Router();

const {
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
} = require("../controllers/auth.controller");

const authenticate = require("../middlewares/authenticate");
const validate = require("../middlewares/validate");
const {
  ownerSignupSchema,
  verifyOwnerSignupSchema,
  residentLoginSchema,
  loginSchema,
  refreshTokenSchema,
  verify2FASchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require("../utils/validators/auth.validator");

// ── Owner registration ────────────────────────────────────────────────────────
// POST /v1/auth/owner/signup
router.post("/owner/signup", validate(ownerSignupSchema), ownerSignup);

// POST /v1/auth/owner/verify-signup
router.post("/owner/verify-signup", validate(verifyOwnerSignupSchema), verifyOwnerSignup);

// ── Resident login ────────────────────────────────────────────────────────────
// POST /v1/auth/resident/login
router.post("/resident/login", validate(residentLoginSchema), residentLogin);

// ── General login (owner / employee) ─────────────────────────────────────────
// POST /v1/auth/login
router.post("/login", validate(loginSchema), generalLogin);

// ── Session management ────────────────────────────────────────────────────────
// POST /v1/auth/logout  (requires auth)
router.post("/logout", authenticate, logout);

// POST /v1/auth/refresh-token
router.post("/refresh-token", validate(refreshTokenSchema), refreshToken);

// ── 2FA (requires auth) ───────────────────────────────────────────────────────
// POST /v1/auth/setup-2fa
router.post("/setup-2fa", authenticate, setup2FA);

// POST /v1/auth/verify-2fa
router.post("/verify-2fa", authenticate, validate(verify2FASchema), verify2FA);

// ── Password reset ────────────────────────────────────────────────────────────
// POST /v1/auth/forgot-password
router.post("/forgot-password", validate(forgotPasswordSchema), forgotPassword);

// POST /v1/auth/reset-password
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

// POST /v1/auth/change-password (requires auth)
router.post("/change-password", authenticate, validate(changePasswordSchema), changePassword);

// ── Profile ───────────────────────────────────────────────────────────────────
// GET /v1/auth/me
router.get("/me", authenticate, getMe);

// PUT /v1/auth/me
router.put("/me", authenticate, updateMe);

// ── Health ─── ────────────────────────────────────────────────────────────────
router.get("/ping", (req, res) => res.json({ success: true, data: { module: "auth" } }));

module.exports = router;
