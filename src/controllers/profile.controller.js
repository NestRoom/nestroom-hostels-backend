/**
 * src/controllers/profile.controller.js
 *
 * WHY THIS FILE EXISTS:
 * The Profile API lets the logged-in admin view and update their personal
 * information (name, phone). It also provides a combined endpoint that
 * returns both the user document and the linked hostel document in one
 * response — so the frontend Profile page doesn't need to make two separate
 * API calls.
 *
 * DATA ISOLATION:
 * Every query here uses `req.user.userId` (injected by the auth middleware
 * from the verified JWT). This guarantees one admin can never see or modify
 * another admin's profile — even if they somehow know their MongoDB ID.
 *
 * WHAT IS NEVER RETURNED:
 * - `passwordHash` — never exposed to the client
 * - `googleUid` — internal field, not needed by the frontend
 * - Raw `_id` fields — we always convert to string `.toString()`
 */

const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// ---------------------------------------------------------------
// HELPER: Sanitize user object for API responses
// Mirrors the same function in auth.controller.js — kept here to
// avoid a shared-state dependency between controller files.
// ---------------------------------------------------------------
function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    hostelId: user.hostelId?.toString() || null,
    photoURL: user.photoURL,
    lastLogin: user.lastLogin,
  };
}

// ---------------------------------------------------------------
// HELPER: Sanitize hostel object for API responses
// ---------------------------------------------------------------
function sanitizeHostel(hostel) {
  if (!hostel) return null;
  return {
    id: hostel._id.toString(),
    name: hostel.name,
    hostelId: hostel.hostelId,
    address: hostel.address,
    city: hostel.city,
    state: hostel.state,
    totalRooms: hostel.totalRooms,
    amenities: hostel.amenities || [],
    logo: hostel.logo || null,
    createdAt: hostel.createdAt,
  };
}

// ---------------------------------------------------------------
// GET /api/profile
// Returns the logged-in admin's user data + their hostel in one response.
//
// WHY COMBINE: The frontend Profile page needs both the user's personal
// info and hostel details to render. A single aggregate call is more
// efficient than two sequential requests.
// ---------------------------------------------------------------
async function getProfile(req, res) {
  const db = getDb();

  const user = await db.collection('users').findOne({
    _id: new ObjectId(req.user.userId),
  });

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  // Fetch hostel only if user has one linked
  let hostel = null;
  if (user.hostelId) {
    hostel = await db.collection('hostels').findOne({ _id: user.hostelId });
  }

  return res.status(200).json({
    success: true,
    profile: {
      user: sanitizeUser(user),
      hostel: sanitizeHostel(hostel),
    },
  });
}

// ---------------------------------------------------------------
// PUT /api/profile
// Updates the admin's personal info: name and/or phone.
//
// WHY PARTIAL UPDATES ($set):
// We use MongoDB's $set operator instead of replacing the entire document.
// This means only the fields explicitly sent in the request body are changed —
// all other fields (email, hostelId, role, etc.) remain untouched.
// ---------------------------------------------------------------
async function updateProfile(req, res) {
  const db = getDb();
  const { name, phone } = req.body;

  // Build the update object with only the fields that were sent
  // WHY NOT HARDCODE: If only `name` is sent, we should not set `phone` to undefined.
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (phone !== undefined) updates.phone = phone.trim();

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields provided to update.' });
  }

  updates.updatedAt = new Date();

  // Check for phone uniqueness if phone is being updated
  if (updates.phone) {
    const existing = await db.collection('users').findOne({
      phone: updates.phone,
      _id: { $ne: new ObjectId(req.user.userId) }, // Exclude current user
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'This phone number is already in use.' });
    }
  }

  const result = await db.collection('users').findOneAndUpdate(
    { _id: new ObjectId(req.user.userId) },
    { $set: updates },
    { returnDocument: 'after' } // Return the updated document, not the old one
  );

  return res.status(200).json({
    success: true,
    message: 'Profile updated.',
    user: sanitizeUser(result),
  });
}

module.exports = { getProfile, updateProfile };
