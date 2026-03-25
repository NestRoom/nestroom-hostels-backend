/**
 * src/controllers/dashboard.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Dashboard API provides a single, unified entry point for the frontend
 * homepage. It aggregates key metrics from multiple collections (Rooms,
 * Residents, Payments, and Services) in a single request, significantly
 * improving initial load performance.
 *
 * DATA ISOLATION:
 * All queries are strictly scoped to `req.user.hostelId`.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// ---------------------------------------------------------------
// GET /api/dashboard/stats
// Returns an aggregated summary of all hostel management metrics.
// ---------------------------------------------------------------
async function getDashboardStats(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // We use parallel queries for maximum speed
  const [rooms, residents, payments, services] = await Promise.all([
    // 1. Rooms Summary
    db.collection('rooms').aggregate([
      { $match: { hostelId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]).toArray(),

    // 2. Residents Summary
    db.collection('residents').aggregate([
      { $match: { hostelId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]).toArray(),

    // 3. Payments Summary (This month's collection & dues)
    db.collection('payments').aggregate([
      { $match: { hostelId } },
      {
        $facet: {
          collected: [
            { $match: { status: 'Successful', date: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ],
          dues: [
            { $match: { status: 'Pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ],
          overdue: [
            { $match: { status: 'Pending', dueDate: { $lt: now } } },
            { $count: 'count' }
          ]
        }
      }
    ]).toArray(),

    // 4. Services Summary (Open tickets)
    db.collection('services_tickets').countDocuments({
      hostelId,
      status: { $nin: ['Resolved', 'Closed'] }
    })
  ]);

  // Format Room Metrics
  const roomStats = { total: 0, occupied: 0, vacant: 0, maintenance: 0 };
  rooms.forEach(g => {
    roomStats.total += g.count;
    if (g._id === 'OCCUPIED' || g._id === 'PARTIALLY VACANT') roomStats.occupied += g.count;
    if (g._id === 'VACANT') roomStats.vacant = g.count;
    if (g._id === 'MAINTENANCE') roomStats.maintenance = g.count;
  });

  // Format Resident Metrics
  const residentStats = { total: 0, active: 0, onNotice: 0 };
  residents.forEach(g => {
    residentStats.total += g.count;
    if (g._id === 'Active') residentStats.active = g.count;
    if (g._id === 'Notice') residentStats.onNotice = g.count;
  });

  // Format Payment Metrics
  const paymentStats = {
    collectedThisMonth: payments[0].collected[0]?.total || 0,
    pendingDues: payments[0].dues[0]?.total || 0,
    overdueCount: payments[0].overdue[0]?.count || 0
  };

  return res.status(200).json({
    success: true,
    stats: {
      rooms: roomStats,
      residents: residentStats,
      payments: paymentStats,
      services: {
        openTickets: services
      }
    }
  });
}

module.exports = {
  getDashboardStats,
};
