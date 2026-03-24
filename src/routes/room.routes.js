/**
 * src/routes/room.routes.js
 *
 * Routes for the rooms management.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET    /api/rooms        — Get all rooms with filtering
 *   GET    /api/rooms/stats  — Get counts grouped by status
 *   GET    /api/rooms/:id    — Get one room with residents
 *   POST   /api/rooms        — Create a new room
 *   PUT    /api/rooms/:id    — Update room details
 *   DELETE /api/rooms/:id    — Delete room if VACANT
 */

const express = require('express');
const { body } = require('express-validator');

const roomController = require('../controllers/room.controller');
const protect = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All room routes require authentication
router.use(protect);

// GET /api/rooms
router.get('/', asyncHandler(roomController.getAllRooms));

// GET /api/rooms/stats (must be before /:id)
router.get('/stats', asyncHandler(roomController.getRoomStats));

// GET /api/rooms/:id
router.get('/:id', asyncHandler(roomController.getOneRoom));

// POST /api/rooms
router.post(
  '/',
  [
    body('number').trim().notEmpty().withMessage('Room number is required'),
    body('sharing').trim().notEmpty().withMessage('Sharing type is required'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('status').optional().isIn(['OCCUPIED', 'PARTIALLY VACANT', 'VACANT', 'MAINTENANCE']).withMessage('Invalid status'),
  ],
  validate,
  asyncHandler(roomController.createRoom)
);

// PUT /api/rooms/:id
router.put(
  '/:id',
  [
    body('number').optional().trim().notEmpty().withMessage('Room number cannot be empty'),
    body('sharing').optional().trim().notEmpty().withMessage('Sharing type cannot be empty'),
    body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
    body('status').optional().isIn(['OCCUPIED', 'PARTIALLY VACANT', 'VACANT', 'MAINTENANCE']).withMessage('Invalid status'),
    body('maintenanceInfo').optional().trim(),
  ],
  validate,
  asyncHandler(roomController.updateRoom)
);

// DELETE /api/rooms/:id
router.delete('/:id', asyncHandler(roomController.deleteRoom));

module.exports = router;
