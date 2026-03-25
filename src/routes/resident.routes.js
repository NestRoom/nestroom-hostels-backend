/**
 * src/routes/resident.routes.js
 *
 * Routes for the residents management.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET    /api/residents        — Get all residents with filtering
 *   GET    /api/residents/stats  — Get status summary (aggregation)
 *   GET    /api/residents/:id    — Get one resident doc
 *   POST   /api/residents        — Add new resident + update room status
 *   PUT    /api/residents/:id    — Update resident doc
 *   DELETE /api/residents/:id    — Delete resident + vacate bed
 */

const express = require('express');
const { body } = require('express-validator');

const residentController = require('../controllers/resident.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All resident routes require authentication
router.use(protect);

// GET /api/residents
router.get('/', asyncHandler(residentController.getAllResidents));

// GET /api/residents/stats
router.get('/stats', asyncHandler(residentController.getResidentStats));

// GET /api/residents/:id
router.get('/:id', asyncHandler(residentController.getOneResident));

// POST /api/residents
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone')
      .trim()
      .matches(/^\+?[1-9]\d{9,14}$/)
      .withMessage('Valid phone number required (e.g. +919000000000)'),
    body('email').trim().isEmail().withMessage('Valid email required'),
    body('roomId').trim().isMongoId().withMessage('Valid Room ID is required'),
    body('bed').optional().trim().notEmpty().withMessage('Bed label cannot be empty'),
    body('joinDate').optional().isISO8601().withMessage('Invalid joinDate format (YYYY-MM-DD)'),
    body('emergencyContact').optional().trim(),
    body('aadharNo').optional().trim(),
  ],
  validate,
  asyncHandler(residentController.addResident)
);

// PUT /api/residents/:id
router.put(
  '/:id',
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phone')
      .optional()
      .trim()
      .matches(/^\+?[1-9]\d{9,14}$/)
      .withMessage('Valid phone number required'),
    body('email').optional().trim().isEmail().withMessage('Valid email required'),
    body('roomId').optional().trim().isMongoId().withMessage('Valid Room ID required'),
    body('status').optional().isIn(['Active', 'Notice', 'New']).withMessage('Invalid status'),
    body('paymentStatus').optional().isIn(['Paid', 'Overdue', 'Partial', 'Pending']).withMessage('Invalid paymentStatus'),
    body('emergencyContact').optional().trim(),
    body('aadharNo').optional().trim(),
  ],
  validate,
  asyncHandler(residentController.updateResident)
);

// DELETE /api/residents/:id
router.delete('/:id', asyncHandler(residentController.deleteResident));

module.exports = router;
