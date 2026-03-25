/**
 * src/controllers/service.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Services API (Ticketing System) handles maintenance and amenity-related
 * requests from residents. It provides a structured way for admins to track,
 * prioritize, and resolve complaints and issues.
 *
 * DATA ISOLATION:
 * All queries are strictly scoped to `req.user.hostelId`.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// ---------------------------------------------------------------
// HELPER: Sanitize ticket object for API responses
// ---------------------------------------------------------------
function sanitizeTicket(ticket) {
  return {
    id: ticket._id.toString(),
    ticketId: ticket.ticketId,
    hostelId: ticket.hostelId.toString(),
    residentId: ticket.residentId.toString(),
    roomId: ticket.roomId.toString(),
    category: ticket.category,
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    resolvedAt: ticket.resolvedAt || null,
    updatedAt: ticket.updatedAt,
  };
}

// ---------------------------------------------------------------
// GET /api/services/tickets
// Returns all tickets with status filtering.
// ---------------------------------------------------------------
async function getAllTickets(req, res) {
  const db = getDb();
  const { status } = req.query;

  const query = {
    hostelId: new ObjectId(req.user.hostelId),
  };

  if (status) query.status = status;

  const tickets = await db.collection('services_tickets')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return res.status(200).json({
    success: true,
    count: tickets.length,
    tickets: tickets.map(sanitizeTicket),
  });
}

// ---------------------------------------------------------------
// GET /api/services/stats
// Returns count of open tickets and average resolution time in minutes.
// ---------------------------------------------------------------
async function getServiceStats(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);

  const stats = await db.collection('services_tickets').aggregate([
    { $match: { hostelId } },
    {
      $facet: {
        openCount: [
          { $match: { status: { $nin: ['Resolved', 'Closed'] } } },
          { $count: 'count' }
        ],
        resolutionTimes: [
          { $match: { status: 'Resolved', resolvedAt: { $exists: true } } },
          {
            $project: {
              diff: { $subtract: ["$resolvedAt", "$createdAt"] }
            }
          },
          {
            $group: {
              _id: null,
              avgTimeMs: { $avg: "$diff" }
            }
          }
        ]
      }
    }
  ]).toArray();

  const facet = stats[0];
  const openCount = facet.openCount[0]?.count || 0;
  const avgTimeMs = facet.resolutionTimes[0]?.avgTimeMs || 0;

  // Convert MS to user-friendly hours/minutes
  const avgHours = Math.round((avgTimeMs / (1000 * 60 * 60)) * 10) / 10;

  return res.status(200).json({
    success: true,
    stats: {
      openTickets: openCount,
      averageResolutionTimeHours: avgHours,
    }
  });
}

// ---------------------------------------------------------------
// GET /api/services/tickets/:id
// ---------------------------------------------------------------
async function getOneTicket(req, res) {
  const db = getDb();
  const ticketId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const ticket = await db.collection('services_tickets').findOne({ _id: ticketId, hostelId });

  if (!ticket) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }

  return res.status(200).json({ success: true, ticket: sanitizeTicket(ticket) });
}

// ---------------------------------------------------------------
// POST /api/services/tickets
// Auto-generates a human-friendly ticketId (e.g. T-1002).
// ---------------------------------------------------------------
async function createTicket(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  const { residentId, roomId, category, title, description, priority } = req.body;

  // 1. Generate sequential Ticket ID
  const lastTicket = await db.collection('services_tickets')
    .find({ hostelId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();

  let nextIdNum = 1001;
  if (lastTicket.length > 0 && lastTicket[0].ticketId) {
    const lastNumMatch = lastTicket[0].ticketId.match(/\d+/);
    if (lastNumMatch) {
      nextIdNum = parseInt(lastNumMatch[0]) + 1;
    }
  }

  const now = new Date();
  const ticketDoc = {
    hostelId,
    residentId: new ObjectId(residentId),
    roomId: new ObjectId(roomId),
    ticketId: `T-${nextIdNum}`,
    category: category || 'General',
    title: title.trim(),
    description: description.trim(),
    priority: priority || 'Medium',
    status: 'Pending',
    createdAt: now,
    resolvedAt: null,
    updatedAt: now,
  };

  const result = await db.collection('services_tickets').insertOne(ticketDoc);

  return res.status(201).json({
    success: true,
    message: 'Ticket created successfully.',
    ticket: sanitizeTicket({ ...ticketDoc, _id: result.insertedId }),
  });
}

// ---------------------------------------------------------------
// PUT /api/services/tickets/:id
// Updates status and automatically sets resolvedAt if status is 'Resolved'.
// ---------------------------------------------------------------
async function updateTicket(req, res) {
  const db = getDb();
  const ticketId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);
  const { status, priority, category } = req.body;

  const updates = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === 'Resolved') {
      updates.resolvedAt = new Date();
    }
  }
  if (priority !== undefined) updates.priority = priority;
  if (category !== undefined) updates.category = category;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update.' });
  }

  updates.updatedAt = new Date();

  const result = await db.collection('services_tickets').findOneAndUpdate(
    { _id: ticketId, hostelId },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }

  return res.status(200).json({
    success: true,
    message: `Ticket updated to ${status}.`,
    ticket: sanitizeTicket(result),
  });
}

// ---------------------------------------------------------------
// DELETE /api/services/tickets/:id
// ---------------------------------------------------------------
async function deleteTicket(req, res) {
  const db = getDb();
  const ticketId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const result = await db.collection('services_tickets').deleteOne({ _id: ticketId, hostelId });

  if (result.deletedCount === 0) {
    return res.status(404).json({ success: false, message: 'Ticket not found.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Ticket deleted successfully.'
  });
}

module.exports = {
  getAllTickets,
  getServiceStats,
  getOneTicket,
  createTicket,
  updateTicket,
  deleteTicket,
};
