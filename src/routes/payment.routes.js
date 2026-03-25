/**
 * src/routes/payment.routes.js
 *
 * Routes for the payments management.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET    /api/payments                — Get all payments (filtered)
 *   GET    /api/payments/stats          — Get summary statistics
 *   GET    /api/payments/revenue-chart  — Get monthly data for charts
 *   GET    /api/payments/disputes       — Get failed payments
 *   GET    /api/payments/:id            — Get one payment doc
 *   POST   /api/payments                — Record new payment
 *   PUT    /api/payments/:id            — Update status (e.g. Successful)
 */

const express = require('express');
const { body, query } = require('express-validator');

const paymentController = require('../controllers/payment.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All payment routes require authentication
router.use(protect);

// GET /api/payments
router.get(
  '/',
  [
    query('from').optional().isISO8601().withMessage('Invalid from date format (YYYY-MM-DD)'),
    query('to').optional().isISO8601().withMessage('Invalid to date format (YYYY-MM-DD)'),
  ],
  validate,
  asyncHandler(paymentController.getAllPayments)
);

// GET /api/payments/stats
router.get('/stats', asyncHandler(paymentController.getPaymentStats));

// GET /api/payments/revenue-chart
router.get('/revenue-chart', asyncHandler(paymentController.getRevenueChart));

// GET /api/payments/disputes
router.get('/disputes', asyncHandler(paymentController.getDisputes));

// GET /api/payments/:id
router.get('/:id', asyncHandler(paymentController.getOnePayment));

// POST /api/payments
router.post(
  '/',
  [
    body('residentId').trim().isMongoId().withMessage('Valid Resident ID is required'),
    body('roomId').trim().isMongoId().withMessage('Valid Room ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be positive'),
    body('method').optional().isIn(['UPI', 'Cash', 'Transfer']).withMessage('Invalid payment method'),
    body('status').optional().isIn(['Successful', 'Pending', 'Failed']).withMessage('Invalid status'),
    body('type').optional().isIn(['Rent', 'Service', 'Deposit']).withMessage('Invalid type'),
    body('date').optional().isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
    body('dueDate').optional().isISO8601().withMessage('Invalid dueDate format (YYYY-MM-DD)'),
  ],
  validate,
  asyncHandler(paymentController.recordPayment)
);

// PUT /api/payments/:id
router.put(
  '/:id',
  [
    body('status').notEmpty().isIn(['Successful', 'Pending', 'Failed']).withMessage('Valid status required'),
  ],
  validate,
  asyncHandler(paymentController.updatePaymentStatus)
);

module.exports = router;
