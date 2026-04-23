const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

const Hostel = require("../models/Hostel.model");
const Building = require("../models/Building.model");
const Room = require("../models/Room.model");
const Bed = require("../models/Bed.model");
const Employee = require("../models/Employee.model");
const User = require("../models/User.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const {
  generateBuildingId,
  generateRoomId,
  generateBedIds,
  generateEmployeeId,
  generateEmployeeCode,
  generateUsername,
  generateTempPassword,
  generateEmployeeUserId,
} = require("../utils/idGenerator");
const { encrypt, decrypt } = require("../services/encryption");
const { sendCredentialsEmail } = require("../services/email");
const { sendCredentialsWhatsapp } = require("../services/whatsapp");

// ─── Helper: compute profile completion ───────────────────────────────────────
const computeProfileCompletion = (hostel, owner) => {
  const sections = {
    BasicInfo: !!(hostel.hostelName && hostel.hostelType && hostel.description),
    ProfilePhoto: !!hostel.profilePhoto,
    CoverPhoto: !!hostel.coverPhoto,
    BankDetails: !!(hostel.bankDetails?.accountNumber && hostel.bankDetails?.ifscCode),
    Location: !!(hostel.location?.coordinates?.[0] && hostel.city),
    TwoFactorAuth: !!(owner?.twoFactorEnabled),
  };
  const completed = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);
  const pending = Object.entries(sections).filter(([, v]) => !v).map(([k]) => k);
  const percentage = Math.round((completed.length / Object.keys(sections).length) * 100);
  return { percentage, sections, completed, pending };
};

// ─── 2.1 Get All Hostels ──────────────────────────────────────────────────────
const getAllHostels = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { ownerId: req.user._id };
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;
  if (search) filter.hostelName = { $regex: search, $options: "i" };

  const [hostels, total] = await Promise.all([
    Hostel.find(filter)
      .select("hostelId hostelCode hostelName city bedCount occupiedBeds totalRevenue isActive")
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Hostel.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    hostels,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// ─── 2.2 Get Hostel Profile ────────────────────────────────────────────────────
const getHostelProfile = asyncHandler(async (req, res) => {
  const hostel = req.hostel || await Hostel.findById(req.params.hostelId).lean();
  if (!hostel) throw createError("Hostel not found", 404, "HOSTEL_NOT_FOUND");

  const owner = await User.findById(hostel.ownerId).select("twoFactorEnabled").lean();
  const profileCompletion = computeProfileCompletion(hostel, owner);

  // Decrypt bank account for owner only
  const bankDetails = { ...hostel.bankDetails };
  if (bankDetails.accountNumber) {
    bankDetails.accountNumber = req.user.userType === "owner"
      ? decrypt(bankDetails.accountNumber)
      : "XXXX" + decrypt(bankDetails.accountNumber)?.slice(-4);
  }

  return sendSuccess(res, { ...hostel, bankDetails, profileCompletion });
});

// ─── 2.3 Update Hostel Profile ────────────────────────────────────────────────
const updateHostelProfile = asyncHandler(async (req, res) => {
  const { location, ...rest } = req.body;

  const update = { ...rest };
  if (location) {
    update.location = {
      type: "Point",
      coordinates: [location.longitude, location.latitude],
    };
  }

  await Hostel.findByIdAndUpdate(req.params.hostelId, { $set: update });

  return sendSuccess(res, { message: "Hostel profile updated successfully" });
});

// ─── 2.4 Update Bank Details ──────────────────────────────────────────────────
const updateBankDetails = asyncHandler(async (req, res) => {
  const { accountNumber, ...rest } = req.body;

  const encryptedAccount = encrypt(accountNumber);

  await Hostel.findByIdAndUpdate(req.params.hostelId, {
    $set: { bankDetails: { ...rest, accountNumber: encryptedAccount } },
  });

  return sendSuccess(res, { message: "Bank details updated successfully" });
});

// ─── 2.5 Get Profile Completion ───────────────────────────────────────────────
const getProfileCompletion = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.hostelId).lean();
  if (!hostel) throw createError("Hostel not found", 404, "HOSTEL_NOT_FOUND");

  const owner = await User.findById(hostel.ownerId).select("twoFactorEnabled").lean();
  const { percentage, sections, completed, pending } = computeProfileCompletion(hostel, owner);

  const sectionMap = Object.fromEntries(
    Object.entries(sections).map(([k, v]) => [k, { percentage: v ? 100 : 0, status: v ? "completed" : "pending" }])
  );

  return sendSuccess(res, { overallCompletion: percentage, sections: sectionMap, completed, pending });
});

// ─── 2.6 Add Employee ─────────────────────────────────────────────────────────
const addEmployee = asyncHandler(async (req, res) => {
  const { fullName, email, whatsappNumber, position, department, hireDate, employmentType, permissions } = req.body;

  const hostel = req.hostel || await Hostel.findById(req.params.hostelId).lean();

  // Check email unique
  const existingUser = await User.findOne({ email });
  if (existingUser) throw createError("Email already in use", 409, "EMAIL_EXISTS");

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const username = generateUsername(fullName);
  const employeeId = generateEmployeeId();
  const employeeCode = generateEmployeeCode(hostel.hostelCode, employeeId);
  const userId = generateEmployeeUserId();

  // Create User record
  const user = await User.create({
    userId,
    userType: "employee",
    email,
    passwordHash,
    whatsappNumber,
    fullName,
  });

  // Create Employee record
  const employee = await Employee.create({
    employeeId,
    employeeCode,
    userId: user._id,
    hostelId: hostel._id || hostel,
    fullName,
    email,
    whatsappNumber,
    position,
    department,
    hireDate: hireDate ? new Date(hireDate) : null,
    employmentType,
    credentials: {
      username,
      passwordHash,
      passwordLastChanged: new Date(),
      passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    permissions,
  });

  // Link user → employee
  user.employeeId = employee._id;
  user.hostelId = hostel._id || hostel;
  user.permissions = permissions;
  await user.save();

  // Send credentials
  try {
    await sendCredentialsEmail(email, { 
      fullName, email, password: tempPassword, 
      code: employee.employeeCode, role: "employee" 
    });
    await sendCredentialsWhatsapp(whatsappNumber, { fullName, email, password: tempPassword });
  } catch (e) {
    console.error("Credential delivery failed:", e.message);
  }

  return sendSuccess(
    res,
    {
      employeeId: employee.employeeId,
      employeeCode: employee.employeeCode,
      username,
      temporaryPassword: tempPassword,
      message: "Employee added. Credentials sent via email and WhatsApp",
    },
    201
  );
});

// ─── 2.7 Get Employees ────────────────────────────────────────────────────────
const getEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find({ hostelId: req.params.hostelId, isActive: true })
    .select("employeeId fullName position email whatsappNumber isActive lastLogin")
    .lean();

  return sendSuccess(res, { employees });
});

// ─── 3.1 Get Buildings ────────────────────────────────────────────────────────
const getBuildings = asyncHandler(async (req, res) => {
  const buildings = await Building.find({ hostelId: req.params.hostelId, isActive: true }).lean();

  // Attach room/bed counts
  const enriched = await Promise.all(
    buildings.map(async (b) => {
      const rooms = await Room.find({ buildingId: b._id, isActive: true }).lean();
      const totalBeds = rooms.reduce((acc, r) => acc + r.bedCount, 0);
      return { ...b, roomCount: rooms.length, totalBeds };
    })
  );

  return sendSuccess(res, { buildings: enriched });
});

// ─── 3.2 Create Building ──────────────────────────────────────────────────────
const createBuilding = asyncHandler(async (req, res) => {
  const { buildingName, buildingNumber, floorCount, address, amenities, buildingManager, managerPhone } = req.body;

  const buildingId = generateBuildingId();

  const building = await Building.create({
    buildingId,
    hostelId: req.params.hostelId,
    buildingName,
    buildingNumber,
    floorCount,
    address,
    amenities,
    buildingManager,
    managerPhone,
  });

  // Increment hostel building count
  await Hostel.findByIdAndUpdate(req.params.hostelId, { $inc: { buildingCount: 1 } });

  return sendSuccess(res, { buildingId: building.buildingId, buildingName, message: "Building created successfully" }, 201);
});

// ─── 3.3 Get Rooms (grid layout) ──────────────────────────────────────────────
const getRooms = asyncHandler(async (req, res) => {
  const { buildingId, floorNumber, status } = req.query;
  const hostelId = new mongoose.Types.ObjectId(req.params.hostelId);

  // Use Aggregation for reliable joining of Beds
  const rooms = await Room.aggregate([
    { 
      $match: { 
        hostelId, 
        isActive: true,
        ...(buildingId ? { buildingId: new mongoose.Types.ObjectId(buildingId) } : {}),
        ...(floorNumber !== undefined ? { floorNumber: parseInt(floorNumber) } : {}),
        ...(status ? { roomStatus: status } : {})
      } 
    },
    {
      $lookup: {
        from: "beds",
        localField: "_id",
        foreignField: "roomId",
        as: "beds"
      }
    }
  ]);

  const buildings = await Building.find({
    hostelId: req.params.hostelId,
    ...(buildingId ? { _id: buildingId } : {}),
  }).lean();

  // Group by building → floor
  const byBuilding = {};
  for (const room of rooms) {
    const bKey = String(room.buildingId);
    if (!byBuilding[bKey]) byBuilding[bKey] = {};
    const fKey = room.floorNumber;
    if (!byBuilding[bKey][fKey]) byBuilding[bKey][fKey] = [];
    byBuilding[bKey][fKey].push(room);
  }

  const result = buildings.map((b) => ({
    buildingId: b.buildingId, // Code
    buildingName: b.buildingName,
    _id: b._id, // Mongo ID
    floors: Object.entries(byBuilding[String(b._id)] || {}).map(([floor, floorRooms]) => ({
      floorNumber: parseInt(floor),
      rooms: floorRooms,
    })).sort((a, b) => a.floorNumber - b.floorNumber),
  }));

  return sendSuccess(res, { buildings: result });
});

// ─── 3.4 Create Room ──────────────────────────────────────────────────────────
const createRoom = asyncHandler(async (req, res) => {
  const {
    buildingId, floorNumber, roomNumber, roomType, bedCount,
    monthlyFee, quarterlyFee, yearlyFee,
    amenities, hasAttachedBathroom, hasWindowView, hasBalcony,
    genderRestriction, smokingAllowed,
  } = req.body;

  const building = await Building.findById(buildingId).lean();
  if (!building) throw createError("Building not found", 404, "BUILDING_NOT_FOUND");

  // Check duplicate room number in same building+floor
  const exists = await Room.findOne({ buildingId, floorNumber, roomNumber, isActive: true });
  if (exists) throw createError("Room number already exists on this floor", 409, "ROOM_EXISTS");

  const roomId = generateRoomId(building.buildingNumber || "X", floorNumber, roomNumber);

  const room = await Room.create({
    roomId,
    hostelId: req.params.hostelId,
    buildingId,
    floorNumber,
    roomNumber,
    roomType,
    bedCount,
    availableBeds: bedCount,
    pricing: {
      monthly: { amount: monthlyFee },
      quarterly: { amount: quarterlyFee || monthlyFee * 3 },
      yearly: { amount: yearlyFee || monthlyFee * 12 },
    },
    amenities,
    hasAttachedBathroom,
    hasWindowView,
    hasBalcony,
    genderRestriction,
    smokingAllowed,
  });

  // Auto-create beds
  const bedIds = generateBedIds(roomId, bedCount);
  const bedDocs = bedIds.map((bedId, i) => ({
    bedId,
    roomId: room._id,
    hostelId: req.params.hostelId,
    buildingId,
    bedNumber: String.fromCharCode(65 + i), // A, B, C...
  }));
  await Bed.insertMany(bedDocs);

  // Update hostel room + bed counts
  await Hostel.findByIdAndUpdate(req.params.hostelId, {
    $inc: { roomCount: 1, bedCount },
  });

  return sendSuccess(res, {
    roomId: room.roomId,
    roomNumber,
    beds: bedIds,
    message: `Room created successfully with ${bedCount} beds`,
  }, 201);
});

// ─── 3.5 Update Room ──────────────────────────────────────────────────────────
const updateRoom = asyncHandler(async (req, res) => {
  const { monthlyFee, quarterlyFee, yearlyFee, ...rest } = req.body;

  const update = { ...rest };
  if (monthlyFee !== undefined) {
    update["pricing.monthly.amount"] = monthlyFee;
    update["pricing.quarterly.amount"] = quarterlyFee || monthlyFee * 3;
    update["pricing.yearly.amount"] = yearlyFee || monthlyFee * 12;
  }

  await Room.findOneAndUpdate({ _id: req.params.roomId, hostelId: req.params.hostelId }, { $set: update });

  return sendSuccess(res, { message: "Room updated successfully" });
});

// ─── 3.6 Delete (Archive) Room ────────────────────────────────────────────────
const deleteRoom = asyncHandler(async (req, res) => {
  const room = await Room.findOne({ _id: req.params.roomId, hostelId: req.params.hostelId });
  if (!room) throw createError("Room not found", 404, "ROOM_NOT_FOUND");

  if (room.occupiedBeds > 0) {
    throw createError("Cannot archive a room with active residents", 400, "ROOM_OCCUPIED");
  }

  room.isActive = false;
  room.roomStatus = "Blocked";
  await room.save();

  // Update hostel counts
  await Hostel.findByIdAndUpdate(req.params.hostelId, {
    $inc: { roomCount: -1, bedCount: -room.bedCount },
  });

  return sendSuccess(res, { message: "Room archived successfully" });
});

module.exports = {
  getAllHostels,
  getHostelProfile,
  updateHostelProfile,
  updateBankDetails,
  getProfileCompletion,
  addEmployee,
  getEmployees,
  getBuildings,
  createBuilding,
  getRooms,
  createRoom,
  updateRoom,
  deleteRoom,
};
