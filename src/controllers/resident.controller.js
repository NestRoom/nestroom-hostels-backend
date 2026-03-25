/**
 * src/controllers/resident.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Residents API manages the profiles and stay status of people living in
 * the hostel. It handles all operations related to residents, including
 * automatically updating room occupancy when residents are added or removed.
 *
 * DATA ISOLATION:
 * All queries are strictly scoped to `req.user.hostelId`.
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// ---------------------------------------------------------------
// HELPER: Sanitize resident object for API responses
// ---------------------------------------------------------------
function sanitizeResident(resident) {
  return {
    id: resident._id.toString(),
    hostelId: resident.hostelId.toString(),
    roomId: resident.roomId.toString(),
    name: resident.name,
    phone: resident.phone,
    email: resident.email,
    bed: resident.bed,
    joinDate: resident.joinDate,
    status: resident.status,
    paymentStatus: resident.paymentStatus,
    avatarUrl: resident.avatarUrl || null,
    emergencyContact: resident.emergencyContact || null,
    aadharNo: resident.aadharNo || null,
    createdAt: resident.createdAt,
    updatedAt: resident.updatedAt,
  };
}

/**
 * HELPER: Updates a room's status based on current resident count.
 * Logic:
 * - 0 residents: VACANT
 * - Count == Capacity: OCCUPIED
 * - 0 < Count < Capacity: PARTIALLY VACANT
 */
async function updateRoomStatus(db, hostelId, roomId) {
  const room = await db.collection('rooms').findOne({ _id: roomId, hostelId });
  if (!room) return;

  const residentCount = await db.collection('residents').countDocuments({ roomId, hostelId });

  let newStatus = 'VACANT';
  if (residentCount >= room.capacity) {
    newStatus = 'OCCUPIED';
  } else if (residentCount > 0) {
    newStatus = 'PARTIALLY VACANT';
  }

  await db.collection('rooms').updateOne(
    { _id: roomId, hostelId },
    { $set: { status: newStatus, updatedAt: new Date() } }
  );
}

// ---------------------------------------------------------------
// GET /api/residents
// Returns all residents for the admin's hostel with optional filtering.
// ---------------------------------------------------------------
async function getAllResidents(req, res) {
  const db = getDb();
  const { status, paymentStatus, roomId } = req.query;

  const query = {
    hostelId: new ObjectId(req.user.hostelId),
  };

  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (roomId) query.roomId = new ObjectId(roomId);

  const residents = await db.collection('residents')
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  return res.status(200).json({
    success: true,
    count: residents.length,
    residents: residents.map(sanitizeResident),
  });
}

// ---------------------------------------------------------------
// GET /api/residents/stats
// Returns counts of residents grouped by status (Active, Notice, etc.).
// ---------------------------------------------------------------
async function getResidentStats(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);

  const stats = await db.collection('residents').aggregate([
    { $match: { hostelId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]).toArray();

  const formattedStats = {
    total: 0,
    active: 0,
    notice: 0,
    new: 0,
  };

  stats.forEach(group => {
    formattedStats.total += group.count;
    if (group._id === 'Active') formattedStats.active = group.count;
    if (group._id === 'Notice') formattedStats.notice = group.count;
    if (group._id === 'New')    formattedStats.new    = group.count;
  });

  return res.status(200).json({
    success: true,
    stats: formattedStats,
  });
}

// ---------------------------------------------------------------
// GET /api/residents/:id
// Returns a single resident's full document.
// ---------------------------------------------------------------
async function getOneResident(req, res) {
  const db = getDb();
  const residentId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const resident = await db.collection('residents').findOne({ _id: residentId, hostelId });

  if (!resident) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  return res.status(200).json({ success: true, resident: sanitizeResident(resident) });
}

// ---------------------------------------------------------------
// POST /api/residents
// Adds a new resident and updates the corresponding room's occupancy status.
// ---------------------------------------------------------------
async function addResident(req, res) {
  const db = getDb();
  const hostelId = new ObjectId(req.user.hostelId);
  const { name, phone, email, roomId, bed, joinDate, emergencyContact, aadharNo } = req.body;

  const roomObjectId = new ObjectId(roomId);

  // 1. Verify if room exists in this hostel
  const room = await db.collection('rooms').findOne({ _id: roomObjectId, hostelId });
  if (!room) {
    return res.status(404).json({ success: false, message: 'Room not found.' });
  }

  // 2. Check room capacity safety
  const currentCount = await db.collection('residents').countDocuments({ roomId: roomObjectId, hostelId });
  if (currentCount >= room.capacity) {
    return res.status(400).json({
      success: false,
      message: `Room ${room.number} is already fully occupied. Cannot add more residents.`,
    });
  }

  const now = new Date();
  const residentDoc = {
    hostelId,
    roomId: roomObjectId,
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    bed: bed || 'Any',
    joinDate: joinDate ? new Date(joinDate) : now,
    status: 'New',            // Defaults to New
    paymentStatus: 'Pending', // Defaults to Pending
    avatarUrl: null,
    emergencyContact: emergencyContact || null,
    aadharNo: aadharNo || null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('residents').insertOne(residentDoc);

  // 3. Update the room's status based on new count
  await updateRoomStatus(db, hostelId, roomObjectId);

  return res.status(201).json({
    success: true,
    message: 'Resident added successfully and room occupancy updated.',
    resident: sanitizeResident({ ...residentDoc, _id: result.insertedId }),
  });
}

// ---------------------------------------------------------------
// PUT /api/residents/:id
// Updates a resident's details (status, phone, assigned room, etc.).
// ---------------------------------------------------------------
async function updateResident(req, res) {
  const db = getDb();
  const residentId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const { name, phone, email, roomId, bed, status, paymentStatus, emergencyContact, aadharNo } = req.body;

  // Find existing resident to handle room change logic
  const oldResident = await db.collection('residents').findOne({ _id: residentId, hostelId });
  if (!oldResident) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  const updates = {};
  if (name !== undefined)             updates.name = name.trim();
  if (phone !== undefined)            updates.phone = phone.trim();
  if (email !== undefined)            updates.email = email.trim();
  if (bed !== undefined)              updates.bed = bed;
  if (status !== undefined)           updates.status = status;
  if (paymentStatus !== undefined)    updates.paymentStatus = paymentStatus;
  if (emergencyContact !== undefined) updates.emergencyContact = emergencyContact;
  if (aadharNo !== undefined)         updates.aadharNo = aadharNo;

  let newRoomId = null;
  if (roomId !== undefined) {
    newRoomId = new ObjectId(roomId);
    updates.roomId = newRoomId;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields provided to update.' });
  }

  updates.updatedAt = new Date();

  // Perform the update
  const result = await db.collection('residents').findOneAndUpdate(
    { _id: residentId, hostelId },
    { $set: updates },
    { returnDocument: 'after' }
  );

  // If the room changed, we must update statuses for BOTH old and new rooms
  if (newRoomId && !newRoomId.equals(oldResident.roomId)) {
    await updateRoomStatus(db, hostelId, oldResident.roomId);
    await updateRoomStatus(db, hostelId, newRoomId);
  }

  return res.status(200).json({
    success: true,
    message: 'Resident updated.',
    resident: sanitizeResident(result),
  });
}

// ---------------------------------------------------------------
// DELETE /api/residents/:id
// Deletes a resident and vacates their bed (updates room status).
// ---------------------------------------------------------------
async function deleteResident(req, res) {
  const db = getDb();
  const residentId = new ObjectId(req.params.id);
  const hostelId = new ObjectId(req.user.hostelId);

  const resident = await db.collection('residents').findOne({ _id: residentId, hostelId });

  if (!resident) {
    return res.status(404).json({ success: false, message: 'Resident not found.' });
  }

  const roomId = resident.roomId;

  await db.collection('residents').deleteOne({ _id: residentId, hostelId });

  // Update room status now that a bed is vacant
  await updateRoomStatus(db, hostelId, roomId);

  return res.status(200).json({
    success: true,
    message: 'Resident deleted successfully and bed vacated.',
  });
}

module.exports = {
  getAllResidents,
  getResidentStats,
  getOneResident,
  addResident,
  updateResident,
  deleteResident,
};
