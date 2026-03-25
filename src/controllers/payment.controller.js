/**
 * src/controllers/payment.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Payments API manages all financial transactions (rent, deposits, service
 * fees) within a hostel. It provides insights into collections, dues, and
 * revenue growth via specialized aggregation endpoints.
 *
 * DATA ISOLATION:
 * All queries are strictly scoped to `req.user.hostelId`.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// ---------------------------------------------------------------
// HELPER: Sanitize payment object for API responses
// ---------------------------------------------------------------
function sanitizePayment(payment) {
  return {
    id: payment._id.toString(),
    hostelId: payment.hostelId.toString(),
    residentId: payment.residentId.toString(),
    roomId: payment.roomId.toString(),
    amount: payment.amount,
    method: payment.method,
    date: payment.date,
    dueDate: payment.dueDate || null,
    status: payment.status,
    type: payment.type,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

// ---------------------------------------------------------------
// GET /api/payments
// Returns all payments with filtering and date range support.
// ---------------------------------------------------------------
async function getAllPayments(req, res) {
  const db = getDb();
  const { status, method, from, to } = req.query;

  const query = {
    hostelId: new ObjectId(req.user.hostelId),
  };

  if (status) query.status = status;
  if (method) query.method = method;
  
  // Date range filtering
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to)   query.date.$lte = new Date(to);
  }

  const payments = await db.collection('payments')
    .find(query)
    .sort({ date: -1 })
    .toArray();

  return res.status(200).json({
    success: true,
    count: payments.length,
    payments: payments.map(sanitizePayment),
  });
}

// ---------------------------------------------------------------
// GET /api/payments/stats
// Returns collection totals, pending dues, and upcoming renewals count.
// ---------------------------------------------------------------
async function getPaymentStats(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  const now = new Date();
  
  // Define upcoming window: next 7 days
  const nextWeek = new Date();
  nextWeek.setDate(now.getDate() + 7);

  const stats = await db.collection('payments').aggregate([
    { $match: { hostelId } },
    {
      $facet: {
        totalCollected: [
          { $match: { status: 'Successful' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ],
        totalDues: [
          { $match: { status: 'Pending' } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ],
        upcomingRenewals: [
          { $match: { type: 'Rent', dueDate: { $gte: now, $lte: nextWeek } } },
          { $count: 'count' }
        ],
        overdueCount: [
          { $match: { status: 'Pending', dueDate: { $lt: now } } },
          { $count: 'count' }
        ]
      }
    }
  ]).toArray();

  const facet = stats[0];

  return res.status(200).json({
    success: true,
    stats: {
      totalCollected: facet.totalCollected[0]?.total || 0,
      totalDues: facet.totalDues[0]?.total || 0,
      upcomingRenewals: facet.upcomingRenewals[0]?.count || 0,
      overdueResidents: facet.overdueCount[0]?.count || 0,
    }
  });
}

// ---------------------------------------------------------------
// GET /api/payments/revenue-chart
// Returns total successful payments grouped by month for the current year.
// ---------------------------------------------------------------
async function getRevenueChart(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  
  const currentYear = new Date().getFullYear();
  const startOfYear = new Date(currentYear, 0, 1);

  const data = await db.collection('payments').aggregate([
    { 
      $match: { 
        hostelId, 
        status: 'Successful',
        date: { $gte: startOfYear }
      } 
    },
    {
      $group: {
        _id: { $month: '$date' },
        revenue: { $sum: '$amount' }
      }
    },
    { $sort: { '_id': 1 } }
  ]).toArray();

  // Convert month numbers to names (Jan, Feb...)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedData = data.map(item => ({
    month: monthNames[item._id - 1],
    revenue: item.revenue
  }));

  return res.status(200).json({
    success: true,
    data: formattedData
  });
}

// ---------------------------------------------------------------
// GET /api/payments/disputes
// Short-cut for GET /api/payments?status=Failed
// ---------------------------------------------------------------
async function getDisputes(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);

  const disputes = await db.collection('payments')
    .find({ hostelId, status: 'Failed' })
    .sort({ date: -1 })
    .toArray();

  return res.status(200).json({
    success: true,
    count: disputes.length,
    disputes: disputes.map(sanitizePayment)
  });
}

// ---------------------------------------------------------------
// GET /api/payments/:id
// ---------------------------------------------------------------
async function getOnePayment(req, res) {
  const db = getDb();
  const paymentId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const payment = await db.collection('payments').findOne({ _id: paymentId, hostelId });

  if (!payment) {
    return res.status(404).json({ success: false, message: 'Payment record not found.' });
  }

  return res.status(200).json({ success: true, payment: sanitizePayment(payment) });
}

// ---------------------------------------------------------------
// POST /api/payments
// ---------------------------------------------------------------
async function recordPayment(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  const { residentId, roomId, amount, method, date, dueDate, type, status } = req.body;

  const now = new Date();
  const paymentDoc = {
    hostelId,
    residentId: new ObjectId(residentId),
    roomId: new ObjectId(roomId),
    amount: Number(amount),
    method: method || 'UPI',
    date: date ? new Date(date) : now,
    dueDate: dueDate ? new Date(dueDate) : null,
    type: type || 'Rent',
    status: status || 'Successful',
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('payments').insertOne(paymentDoc);

  return res.status(201).json({
    success: true,
    message: 'Payment recorded successfully.',
    payment: sanitizePayment({ ...paymentDoc, _id: result.insertedId }),
  });
}

// ---------------------------------------------------------------
// PUT /api/payments/:id
// Updates the status of a payment (e.g. Pending -> Successful).
// ---------------------------------------------------------------
async function updatePaymentStatus(req, res) {
  const db = getDb();
  const paymentId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required.' });
  }

  const result = await db.collection('payments').findOneAndUpdate(
    { _id: paymentId, hostelId },
    { $set: { status, updatedAt: new Date() } },
    { returnDocument: 'after' }
  );

  if (!result) {
    return res.status(404).json({ success: false, message: 'Payment record not found.' });
  }

  return res.status(200).json({
    success: true,
    message: `Payment marked as ${status}.`,
    payment: sanitizePayment(result),
  });
}

module.exports = {
  getAllPayments,
  getPaymentStats,
  getRevenueChart,
  getDisputes,
  getOnePayment,
  recordPayment,
  updatePaymentStatus,
};
