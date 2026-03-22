/**
 * src/routes/profile.routes.js
 *
 * Routes for the admin's personal profile.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET /api/profile     — Get user + hostel combined profile
 *   PUT /api/profile     — Update personal info (name, phone)
 */

const express = require('express');
const { body } = require('express-validator');

const profileController = require('../controllers/profile.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All profile routes require authentication
router.use(protect);

// GET /api/profile
router.get('/', asyncHandler(profileController.getProfile));

// PUT /api/profile
router.put(
  '/',
  [
    // Both fields are optional — but if provided, they must be valid
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone')
      .optional()
      .matches(/^\+?[1-9]\d{9,14}$/)
      .withMessage('Valid phone number required (e.g. +919876543210)'),
  ],
  validate,
  asyncHandler(profileController.updateProfile)
);

module.exports = router;
