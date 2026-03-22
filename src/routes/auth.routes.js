/**
 * src/routes/auth.routes.js
 *
 * WHY THIS FILE EXISTS:
 * Routes are the "map" of our API — they declare what HTTP method + URL
 * maps to which controller function. Controllers contain the actual logic;
 * routes are intentionally thin.
 *
 * RATE LIMITING ON AUTH ROUTES:
 * Auth endpoints are the primary target of brute-force attacks. We apply
 * a strict rate limit (10 requests per minute per IP) specifically to these
 * routes, on top of the global limit in app.js. This means an attacker
 * can only try 10 passwords per minute from any given IP address.
 *
 * VALIDATION ARRAYS:
 * Each route that accepts a body declares its validation rules inline.
 * The `validate` middleware then checks those rules before the controller runs.
 * This keeps the controller clean — it can assume req.body is valid.
 *
 * ENDPOINTS:
 *   POST /api/auth/register              — Email + password registration
 *   POST /api/auth/login                 — Email + password login
 *   POST /api/auth/google                — Verify Firebase Google token → JWT
 *   POST /api/auth/whatsapp/send-otp     — Generate + send OTP via WhatsApp
 *   POST /api/auth/whatsapp/verify-otp   — Verify OTP → JWT
 *   GET  /api/auth/me                    — Get current user (protected)
 */

const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/auth.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Strict rate limiter for auth endpoints only
// WHY: Auth routes are the primary brute-force target
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'Too many auth attempts. Please wait a minute.' },
});

// ---------------------------------------------------------------
// POST /api/auth/register
// WHY: Allows a new hostel admin to create an account with email + password.
// The hostel name is collected here so we can create their hostel record
// at the same time as their user record.
// ---------------------------------------------------------------
router.post(
  '/register',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('hostelName').trim().notEmpty().withMessage('Hostel name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  asyncHandler(authController.register)
);

// ---------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------
router.post(
  '/login',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validate,
  asyncHandler(authController.login)
);

// ---------------------------------------------------------------
// POST /api/auth/google
// WHY: Frontend sends the Firebase ID Token after Google popup succeeds.
// Backend verifies it, upserts the user, issues our JWT.
// ---------------------------------------------------------------
router.post(
  '/google',
  authLimiter,
  [
    body('idToken').notEmpty().withMessage('Firebase ID token is required'),
  ],
  validate,
  asyncHandler(authController.googleAuth)
);

// ---------------------------------------------------------------
// POST /api/auth/whatsapp/send-otp
// ---------------------------------------------------------------
router.post(
  '/whatsapp/send-otp',
  authLimiter,
  [
    body('phone')
      .matches(/^\+?[1-9]\d{9,14}$/)
      .withMessage('Valid phone number required (E.164 format, e.g. +919876543210)'),
  ],
  validate,
  asyncHandler(authController.sendWhatsAppOtp)
);

// ---------------------------------------------------------------
// POST /api/auth/whatsapp/verify-otp
// ---------------------------------------------------------------
router.post(
  '/whatsapp/verify-otp',
  authLimiter,
  [
    body('phone').notEmpty().withMessage('Phone is required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('OTP must be 6 digits'),
  ],
  validate,
  asyncHandler(authController.verifyWhatsAppOtp)
);

// ---------------------------------------------------------------
// GET /api/auth/me (protected)
// WHY: Frontend calls this on app load to check if the stored JWT is still
// valid and to get the latest user profile from MongoDB.
// ---------------------------------------------------------------
router.get('/me', protect, asyncHandler(authController.getMe));

module.exports = router;
