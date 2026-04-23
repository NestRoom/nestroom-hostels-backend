const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Resident = require("../models/Resident.model");
const User = require("../models/User.model");
const Room = require("../models/Room.model");
const Bed = require("../models/Bed.model");
const Hostel = require("../models/Hostel.model");
const Building = require("../models/Building.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const { generateResidentId, generateResidentUserId, generateTempPassword } = require("../utils/idGenerator");
const { encrypt, decrypt } = require("../services/encryption");
const { sendCredentialsEmail } = require("../services/email");

// ─── 6.1 Add Resident ─────────────────────────────────────────────────────────
const addResident = asyncHandler(async (req, res) => {
  const {
    fullName, email, whatsappNumber, dateOfBirth, gender,
    college, enrollmentNumber, courseYear, major,
    idCardType, idCardNumber,
    feeAmount, feeFrequency, foodEnabled, securityDeposit, securityDepositPaid,
    roomId, bedId, emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    dietaryPreferences, specialRequests, internalNotes, checkInDate,
  } = req.body;

  const hostelId = req.params.hostelId;

  // Validate room belongs to this hostel
  const room = await Room.findOne({ _id: roomId, hostelId, isActive: true });
  if (!room) throw createError("Room not found or not in this hostel", 404, "ROOM_NOT_FOUND");

  const bed = await Bed.findOne({ _id: bedId, roomId: room._id, bedStatus: "Vacant" });
  if (!bed) throw createError("Bed not found or not available", 400, "BED_UNAVAILABLE");

  // Unique email check
  const existingUser = await User.findOne({ email });
  if (existingUser) throw createError("Email already in use", 409, "EMAIL_EXISTS");

  // Create User
  const tempPassword = generateTempPassword();
  const user = await User.create({
    userId: generateResidentUserId(),
    userType: "resident",
    email,
    passwordHash: await bcrypt.hash(tempPassword, 12),
    passwordEncrypted: encrypt(tempPassword), // Store encrypted password for admin view
    whatsappNumber,
    fullName,
  });

  const hostel = await Hostel.findById(hostelId).lean();

  // Build residentId: RES_<hostelCode>_<year>_<seq>
  const residentId = generateResidentId(hostel?.hostelCode || hostelId, new Date().getFullYear());

  // Compute next due date
  const checkIn = checkInDate ? new Date(checkInDate) : new Date();
  const nextDueDate = new Date(checkIn);
  if (feeFrequency === "Monthly") nextDueDate.setMonth(nextDueDate.getMonth() + 1);
  else if (feeFrequency === "Quarterly") nextDueDate.setMonth(nextDueDate.getMonth() + 3);
  else nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);

  // Create Resident
  const buildingId = room.buildingId;
  const resident = await Resident.create({
    residentId,
    userId: user._id,
    hostelId,
    buildingId,
    roomId: room._id,
    bedId: bed._id,
    fullName,
    email,
    whatsappNumber,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    gender,
    emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    college, enrollmentNumber, courseYear, major,
    idCardType,
    idCardNumber: idCardNumber ? encrypt(idCardNumber) : null,
    feeAmount,
    feeFrequency,
    nextDueDate,
    securityDeposit,
    securityDepositPaid,
    foodEnabled,
    dietaryPreferences,
    specialRequests,
    internalNotes,
    checkInDate: checkIn,
    residentStatus: "Active",
  });

  // Allocate bed
  bed.bedStatus = "Occupied";
  bed.currentResidentId = resident._id;
  bed.allocationDate = checkIn;
  await bed.save();

  // Update room occupied count
  room.occupiedBeds += 1;
  room.availableBeds -= 1;
  if (room.occupiedBeds >= room.bedCount) room.roomStatus = "Occupied";
  await room.save();

  // Update hostel counters
  await Hostel.findByIdAndUpdate(hostelId, {
    $inc: { occupiedBeds: 1, totalResidents: 1 },
  });

  // Send credentials
  try {
    await sendCredentialsEmail(email, {
      fullName, email, password: tempPassword,
      code: resident.residentId, role: "resident",
    });
  } catch (e) {
    console.error("Resident credential email failed:", e.message);
  }

  return sendSuccess(res, {
    residentId: resident.residentId,
    fullName: resident.fullName,
    email: resident.email,
    temporaryPassword: tempPassword,
    message: "Resident added. Login credentials sent via email.",
  }, 201);
});

// ─── 6.2 Get All Residents ────────────────────────────────────────────────────
const getResidents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, search, roomId } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { hostelId: req.params.hostelId };
  if (status) filter.residentStatus = status;
  if (roomId) filter.roomId = roomId;
  if (search) filter.fullName = { $regex: search, $options: "i" };

  const [residents, total, newJoinees, noticePeriod, activeResidents] = await Promise.all([
    Resident.find(filter)
      .populate("roomId", "roomNumber floorNumber")
      .populate("bedId", "bedNumber")
      .populate("userId", "passwordEncrypted")
      .select("-idCardNumber")
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Resident.countDocuments(filter),
    Resident.countDocuments({
      hostelId: req.params.hostelId,
      checkInDate: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    }),
    Resident.countDocuments({
      hostelId: req.params.hostelId,
      residentStatus: "TerminatedWithNotice"
    }),
    Resident.countDocuments({
      hostelId: req.params.hostelId,
      residentStatus: "Active"
    })
  ]);

  // Decrypt passwords for admin view
  residents.forEach(res => {
    if (res.userId && res.userId.passwordEncrypted) {
      res.plainPassword = decrypt(res.userId.passwordEncrypted);
    }
  });

  return sendSuccess(res, {
    residents,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
    stats: {
      newJoinees,
      noticePeriod,
      activeResidents
    }
  });
});

// ─── 6.3 Get Single Resident ──────────────────────────────────────────────────
const getResidentById = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ _id: req.params.residentId, hostelId: req.params.hostelId })
    .populate("roomId", "roomNumber floorNumber")
    .populate("bedId", "bedNumber")
    .populate("userId", "passwordEncrypted")
    .lean();

  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  // Decrypt sensitive fields for authorized roles
  if (["owner", "employee"].includes(req.user.userType)) {
    if (resident.idCardNumber) resident.idCardNumber = decrypt(resident.idCardNumber);
    if (resident.userId && resident.userId.passwordEncrypted) {
      resident.plainPassword = decrypt(resident.userId.passwordEncrypted);
    }
  } else {
    delete resident.idCardNumber;
  }

  return sendSuccess(res, { resident });
});

// ─── 6.4 Update Resident ──────────────────────────────────────────────────────
const updateResident = asyncHandler(async (req, res) => {
  await Resident.findOneAndUpdate(
    { _id: req.params.residentId, hostelId: req.params.hostelId },
    { $set: req.body }
  );

  return sendSuccess(res, { message: "Resident updated successfully" });
});

// ─── 6.5 Get My Profile (resident self) ───────────────────────────────────────
const getMyProfile = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id })
    .populate("roomId", "roomNumber floorNumber amenities")
    .populate("bedId", "bedNumber bedPosition")
    .populate("hostelId", "hostelName address city whatsappNumber")
    .lean();

  if (!resident) throw createError("Resident profile not found", 404, "PROFILE_NOT_FOUND");

  // Never expose idCardNumber to resident themselves in full
  delete resident.idCardNumber;

  return sendSuccess(res, { resident });
});

// ─── 6.6 Upload KYC ──────────────────────────────────────────────────────────
const uploadKYC = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id });
  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  const updates = {};
  if (req.files?.profilePhoto?.[0]) updates["kyc.profilePhoto"] = req.files.profilePhoto[0].path;
  if (req.files?.collegeIdPhoto?.[0]) updates["kyc.collegeIdPhoto"] = req.files.collegeIdPhoto[0].path;
  if (req.files?.aadhaarPhoto?.[0]) updates.idCardPhoto = req.files.aadhaarPhoto[0].path;

  updates["kyc.kycStatus"] = "Pending";

  await Resident.findByIdAndUpdate(resident._id, { $set: updates });

  return sendSuccess(res, { message: "KYC documents uploaded. Awaiting verification." });
});

// ─── 6.7 Approve/Reject KYC ──────────────────────────────────────────────────
const processKYC = asyncHandler(async (req, res) => {
  const { action, rejectionReason } = req.body;

  const resident = await Resident.findOne({ _id: req.params.residentId, hostelId: req.params.hostelId });
  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  if (action === "approve") {
    resident.kyc.kycStatus = "Verified";
    resident.kyc.kycVerifiedAt = new Date();
    resident.kyc.kycVerifiedBy = req.user._id;
    resident.kyc.rejectionReason = null;
  } else {
    resident.kyc.kycStatus = "Rejected";
    resident.kyc.rejectionReason = rejectionReason;
  }

  await resident.save();

  return sendSuccess(res, { message: `KYC ${action === "approve" ? "approved" : "rejected"} successfully` });
});

module.exports = {
  addResident, getResidents, getResidentById, updateResident,
  getMyProfile, uploadKYC, processKYC,
};
