/**
 * src/routes/service.routes.js
 *
 * Routes for the service tickets management.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET    /api/services/tickets        — Get all tickets (filtered)
 *   GET    /api/services/stats          — Get open count & resolution time
 *   GET    /api/services/tickets/:id    — Get one ticket doc
 *   POST   /api/services/tickets        — Record new service request
 *   PUT    /api/services/tickets/:id    — Update status/priority
 *   DELETE /api/services/tickets/:id    — Remove ticket record
 */

const express = require('express');
const { body } = require('express-validator');

const serviceController = require('../controllers/service.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All service routes require authentication
router.use(protect);

// GET /api/services/tickets
router.get('/tickets', asyncHandler(serviceController.getAllTickets));

// GET /api/services/stats
router.get('/stats', asyncHandler(serviceController.getServiceStats));

// GET /api/services/tickets/:id
router.get('/tickets/:id', asyncHandler(serviceController.getOneTicket));

// POST /api/services/tickets
router.post(
  '/tickets',
  [
    body('residentId').trim().isMongoId().withMessage('Valid Resident ID required'),
    body('roomId').trim().isMongoId().withMessage('Valid Room ID required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Invalid priority'),
  ],
  validate,
  asyncHandler(serviceController.createTicket)
);

// PUT /api/services/tickets/:id
router.put(
  '/tickets/:id',
  [
    body('status').optional().isIn(['Pending', 'In Progress', 'Resolved', 'Closed']).withMessage('Invalid status'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Invalid priority'),
    body('category').optional().trim().notEmpty().withMessage('Category cannot be empty'),
  ],
  validate,
  asyncHandler(serviceController.updateTicket)
);

// DELETE /api/services/tickets/:id
router.delete('/tickets/:id', asyncHandler(serviceController.deleteTicket));

module.exports = router;
