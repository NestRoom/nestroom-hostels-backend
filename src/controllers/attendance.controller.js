const mongoose = require("mongoose");
const AttendanceRecord = require("../models/AttendanceRecord.model");
const Resident = require("../models/Resident.model");
const Hostel = require("../models/Hostel.model");
const LeaveApplication = require("../models/LeaveApplication.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const { generateAttendanceId } = require("../utils/idGenerator");
const { checkGeofence } = require("../services/geofence");
const { triggerAttendanceForHostel } = require("../services/attendanceTrigger");

// ─── 8.1 Configure Attendance (Owner/Employee) ────────────────────────────────
const setAttendanceConfig = asyncHandler(async (req, res) => {
  const { location, geofenceRadius, startTime, windowMinutes, enabled, daysOfWeek } = req.body;

  const hostel = await Hostel.findById(req.params.hostelId);
  if (!hostel) throw createError("Hostel not found", 404);

  // Update hostel location and geofence
  if (location) {
    hostel.location.coordinates = [location.longitude, location.latitude];
  }
  if (geofenceRadius) {
    hostel.geofenceRadius = geofenceRadius;
  }

  // Update attendance config
  hostel.attendanceConfig = {
    ...hostel.attendanceConfig,
    enabled: enabled ?? hostel.attendanceConfig.enabled,
    startTime: startTime ?? hostel.attendanceConfig.startTime,
    windowMinutes: windowMinutes ?? hostel.attendanceConfig.windowMinutes,
    daysOfWeek: daysOfWeek ?? hostel.attendanceConfig.daysOfWeek,
  };

  await hostel.save();

  return sendSuccess(res, { message: "Attendance configuration saved", config: hostel.attendanceConfig });
});

// ─── 8.2 Request Attendance from All Residents ────────────────────────────────
const requestAttendance = asyncHandler(async (req, res) => {
  const hostelId = req.params.hostelId;
  const isSurprise = req.query.isSurprise === "true";

  const result = await triggerAttendanceForHostel(hostelId, isSurprise);

  if (!result.success) {
    throw createError(result.message, 400, "ATTENDANCE_TRIGGER_FAILED");
  }

  return sendSuccess(res, result);
});

// ─── 8.3 Submit Attendance (Resident) ─────────────────────────────────────────
const submitAttendance = asyncHandler(async (req, res) => {
  const { status, latitude, longitude, accuracy } = req.body;

  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  // Find most recent pending attendance request
  const record = await AttendanceRecord.findOne({
    residentId: resident._id,
    status: "NotResponded",
  }).sort({ createdAt: -1 });

  if (!record) throw createError("No pending attendance request found", 404, "NO_ATTENDANCE_REQUEST");

  // Geofence check
  const hostel = await Hostel.findById(resident.hostelId).lean();
  const hostelCoords = hostel?.location?.coordinates || [0, 0];
  const geoResult = checkGeofence(
    { latitude, longitude },
    { latitude: hostelCoords[1], longitude: hostelCoords[0] },
    hostel?.geofenceRadius || 500
  );

  // Residents can only mark Present if within geofence
  const finalStatus = status === "Present" && !geoResult.isWithin ? "Absent" : status;

  record.status = finalStatus;
  record.responseReceivedAt = new Date();
  record.responseType = "Manual";
  record.locationData = { latitude, longitude, accuracy, timestamp: new Date(), isWithinGeofence: geoResult.isWithin };
  record.geofenceCheck = {
    hostelLocation: {
      type: "Point",
      coordinates: hostelCoords,
    },
    geofenceRadius: hostel?.geofenceRadius || 500,
    distanceFromHostel: geoResult.distanceMetres,
    withinGeofence: geoResult.isWithin,
    calculatedDistance: geoResult.distanceMetres,
    verificationTimestamp: new Date(),
  };

  await record.save();

  return sendSuccess(res, {
    attendanceId: record.attendanceId,
    status: finalStatus,
    withinGeofence: geoResult.isWithin,
    distanceFromHostel: `${geoResult.distanceMetres}m`,
    message: finalStatus === "Absent" && status === "Present"
      ? "Marked as Absent: you are outside the hostel geofence"
      : `Attendance marked as ${finalStatus}`,
  });
});

// ─── 8.4 Get Attendance History (owner/employee view) ─────────────────────────
const getAttendanceHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, residentId, fromDate, toDate, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { hostelId: req.params.hostelId };
  if (residentId) filter.residentId = residentId;
  if (status) filter.status = status;
  if (fromDate || toDate) {
    filter.attendanceDate = {};
    if (fromDate) filter.attendanceDate.$gte = new Date(fromDate);
    if (toDate) filter.attendanceDate.$lte = new Date(toDate);
  }

  const [records, total] = await Promise.all([
    AttendanceRecord.find(filter)
      .populate({
        path: "residentId",
        select: "residentId fullName roomId profilePhoto",
        populate: { path: "roomId", select: "roomNumber" }
      })
      .sort({ attendanceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    AttendanceRecord.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    records,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// ─── 8.5 Get My Attendance (resident) ─────────────────────────────────────────
const getMyAttendance = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  const { page = 1, limit = 30 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [records, total] = await Promise.all([
    AttendanceRecord.find({ residentId: resident._id })
      .sort({ attendanceDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    AttendanceRecord.countDocuments({ residentId: resident._id }),
  ]);

  const present = records.filter((r) => r.status === "Present").length;
  const absent = records.filter((r) => r.status === "Absent").length;
  const onLeave = records.filter((r) => r.status === "OnLeave").length;
  const attendanceRate = records.length ? ((present / records.length) * 100).toFixed(1) : "0.0";

  return sendSuccess(res, {
    summary: { total: records.length, present, absent, onLeave, attendanceRate: `${attendanceRate}%` },
    records,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// ─── 8.6 Get Active Attendance Requests (Resident) ───────────────────────────
const getActiveAttendanceRequest = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const latestRecord = await AttendanceRecord.findOne({
    residentId: resident._id,
    attendanceDate: { $gte: today }
  }).sort({ createdAt: -1 }).lean();

  let activeRequest = null;
  if (latestRecord && latestRecord.status === "NotResponded") {
    activeRequest = latestRecord;
  }

  return sendSuccess(res, { activeRequest });
});

module.exports = {
  setAttendanceConfig, requestAttendance, submitAttendance,
  getAttendanceHistory, getMyAttendance, getActiveAttendanceRequest
};
