/**
 * src/routes/hostel.routes.js
 *
 * Routes for managing the admin's hostel details.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET  /api/hostels/me      — Get my hostel's full details
 *   PUT  /api/hostels/me      — Update hostel details
 *   POST /api/hostels/setup   — One-time setup for Google SSO / WhatsApp OTP users
 */

const express = require('express');
const { body } = require('express-validator');

const hostelController = require('../controllers/hostel.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All hostel routes require authentication
router.use(protect);

// GET /api/hostels/me
router.get('/me', asyncHandler(hostelController.getMyHostel));

// PUT /api/hostels/me
router.put(
  '/me',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('totalRooms').optional().isInt({ min: 0 }).withMessage('totalRooms must be a non-negative integer'),
    body('amenities').optional().isArray().withMessage('amenities must be an array of strings'),
  ],
  validate,
  asyncHandler(hostelController.updateMyHostel)
);

// POST /api/hostels/setup  (for Google/WhatsApp users who need to create a hostel)
router.post(
  '/setup',
  [
    body('name').trim().notEmpty().withMessage('Hostel name is required'),
  ],
  validate,
  asyncHandler(hostelController.setupHostel)
);

module.exports = router;
