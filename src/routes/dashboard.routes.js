/**
 * src/routes/dashboard.routes.js
 *
 * Routes for the combined dashboard functionality.
 * All routes are protected — a valid JWT is required.
 *
 * ENDPOINTS:
 *   GET /api/dashboard/stats — Aggregate stats for homepage cards
 */

const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const protect = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All dashboard routes require authentication
router.use(protect);

// GET /api/dashboard/stats
router.get('/stats', asyncHandler(dashboardController.getDashboardStats));

module.exports = router;
