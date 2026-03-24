/**
 * src/controllers/room.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Rooms API allows admins to manage the inventory of rooms in their hostel.
 * It handles CRUD operations, status filtering, and room-level diagnostics.
 *
 * DATA ISOLATION:
 * All queries are strictly scoped to `req.user.hostelId`. An admin can only
 * see or modify rooms belonging to their own hostel.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// ---------------------------------------------------------------
// HELPER: Sanitize room object for API responses
// ---------------------------------------------------------------
function sanitizeRoom(room) {
  return {
    id: room._id.toString(),
    number: room.number,
    status: room.status,
    sharing: room.sharing,
    capacity: room.capacity,
    maintenanceInfo: room.maintenanceInfo || null,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

// ---------------------------------------------------------------
// GET /api/rooms
// Returns all rooms for the admin's hostel. Supports filtering by status and sharing.
// ---------------------------------------------------------------
async function getAllRooms(req, res) {
  const db = getDb();
  const { status, sharing } = req.query;

  const query = {
    hostelId: new ObjectId(req.user.hostelId),
  };

  if (status) query.status = status;
  if (sharing) query.sharing = sharing;

  const rooms = await db.collection('rooms')
    .find(query)
    .sort({ number: 1 }) // Always sort by room number
    .toArray();

  return res.status(200).json({
    success: true,
    count: rooms.length,
    rooms: rooms.map(sanitizeRoom),
  });
}

// ---------------------------------------------------------------
// GET /api/rooms/stats
// Returns counts of rooms grouped by status (OCCUPIED, VACANT, etc.)
// Uses MongoDB Aggregation for performance.
// ---------------------------------------------------------------
async function getRoomStats(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);

  const stats = await db.collection('rooms').aggregate([
    { $match: { hostelId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  // Format into a clean object instead of an array of groups
  const formattedStats = {
    total: 0,
    occupied: 0,
    partiallyVacant: 0,
    vacant: 0,
    maintenance: 0,
  };

  stats.forEach(group => {
    formattedStats.total += group.count;
    if (group._id === 'OCCUPIED') formattedStats.occupied = group.count;
    if (group._id === 'PARTIALLY VACANT') formattedStats.partiallyVacant = group.count;
    if (group._id === 'VACANT') formattedStats.vacant = group.count;
    if (group._id === 'MAINTENANCE') formattedStats.maintenance = group.count;
  });

  return res.status(200).json({
    success: true,
    stats: formattedStats,
  });
}

// ---------------------------------------------------------------
// GET /api/rooms/:id
// Returns a single room with its resident details (Joined from residents collection).
// ---------------------------------------------------------------
async function getOneRoom(req, res) {
  const db = getDb();
  const roomId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const room = await db.collection('rooms').findOne({ _id: roomId, hostelId });

  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  // Fetch residents currently assigned to this room
  // This is a "manual join" — cleaner and easier to read than complex $lookup aggregations
  const residents = await db.collection('residents')
    .find({ roomId, hostelId })
    .toArray();

  return res.status(200).json({
    success: true,
    room: {
      ...sanitizeRoom(room),
      residents: residents.map(r => ({
        id: r._id.toString(),
        name: r.name,
        bed: r.bed,
        paymentStatus: r.paymentStatus,
      })),
    },
  });
}

// ---------------------------------------------------------------
// POST /api/rooms
// Creates a new room. Enforces uniqueness of room numbers within a hostel.
// ---------------------------------------------------------------
async function createRoom(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  const { number, sharing, capacity, status } = req.body;

  // Check if room number already exists for this hostel
  const existing = await db.collection('rooms').findOne({
    hostelId,
    number: number.trim(),
  });

  if (existing) {
    return res.status(409).json({
      success: false,
      message: `Room number ${number} already exists in your hostel.`,
    });
  }

  const now = new Date();
  const roomDoc = {
    hostelId,
    number: number.trim(),
    sharing: sharing || '2-Sharing', // Default
    capacity: Number(capacity) || 2,
    status: status || 'VACANT',      // Default
    maintenanceInfo: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('rooms').insertOne(roomDoc);

  return res.status(201).json({
    success: true,
    message: 'Room created successfully.',
    room: sanitizeRoom({ ...roomDoc, _id: result.insertedId }),
  });
}

// ---------------------------------------------------------------
// PUT /api/rooms/:id
// Updates a room's details (status, capacity, etc.)
// ---------------------------------------------------------------
async function updateRoom(req, res) {
  const db = getDb();
  const roomId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const { number, status, sharing, capacity, maintenanceInfo } = req.body;

  const updates = {};
  if (number !== undefined)          updates.number = number.trim();
  if (status !== undefined)          updates.status = status;
  if (sharing !== undefined)         updates.sharing = sharing;
  if (capacity !== undefined)        updates.capacity = Number(capacity);
  if (maintenanceInfo !== undefined) updates.maintenanceInfo = maintenanceInfo;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields provided to update.' });
  }

  // If number is being changed, check for uniqueness
  if (updates.number) {
    const existing = await db.collection('rooms').findOne({
      hostelId,
      number: updates.number,
      _id: { $ne: roomId },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Room number ${updates.number} already exists.`,
      });
    }
  }

  updates.updatedAt = new Date();

  const result = await db.collection('rooms').findOneAndUpdate(
    { _id: roomId, hostelId },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  return res.status(200).json({
    success: true,
    message: 'Room updated.',
    room: sanitizeRoom(result),
  });
}

// ---------------------------------------------------------------
// DELETE /api/rooms/:id
// ---------------------------------------------------------------
async function deleteRoom(req, res) {
  const db = getDb();
  const roomId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const room = await db.collection('rooms').findOne({ _id: roomId, hostelId });

  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  // Safety check: Cannot delete a room if it is not VACANT
  if (room.status !== 'VACANT') {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete a room that is not vacant. Please vacate the residents first.',
    });
  }

  await db.collection('rooms').deleteOne({ _id: roomId, hostelId });

  return res.status(200).json({
    success: true,
    message: 'Room deleted successfully.',
  });
}

module.exports = {
  getAllRooms,
  getRoomStats,
  getOneRoom,
  createRoom,
  updateRoom,
  deleteRoom,
};
