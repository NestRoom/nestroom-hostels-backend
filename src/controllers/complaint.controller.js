const Complaint = require("../models/Complaint.model");
const Resident = require("../models/Resident.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const { generateComplaintId } = require("../utils/idGenerator");

// ─── 11.1 Raise Complaint (Resident) ─────────────────────────────────────────
const raiseComplaint = asyncHandler(async (req, res) => {
  const { title, description, category, priority, location } = req.body;

  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  // Collect uploaded attachment URLs
  const attachments = (req.files || []).map((f) => ({
    fileName: f.originalname,
    fileUrl: f.path,
    fileType: f.mimetype,
  }));

  const complaintId = generateComplaintId();
  const complaint = await Complaint.create({
    complaintId,
    residentId: resident._id,
    hostelId: resident.hostelId,
    title,
    description,
    category,
    priority,
    location: location || null,
    attachments,
    status: "Open",
    statusHistory: [{ status: "Open", changedBy: req.user._id }],
  });

  return sendSuccess(res, {
    complaintId: complaint.complaintId,
    status: "Open",
    message: "Complaint raised successfully",
  }, 201);
});

// ─── 11.2 Get My Complaints (Resident) ───────────────────────────────────────
const getMyComplaints = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  const complaints = await Complaint.find({ residentId: resident._id })
    .select("-communicationLog")
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, { complaints });
});

// ─── 11.3 Get All Complaints (Owner/Employee) ─────────────────────────────────
const getAllComplaints = asyncHandler(async (req, res) => {
  const { status, category, priority, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filter = { hostelId: req.params.hostelId };
  if (status) filter.status = status;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate({
        path: "residentId",
        select: "residentId fullName roomId",
        populate: {
          path: "roomId",
          select: "roomNumber"
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    complaints,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// ─── 11.4 Update Complaint Status ─────────────────────────────────────────────
const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;

  const complaint = await Complaint.findOne({
    _id: req.params.complaintId,
    hostelId: req.params.hostelId,
  });
  if (!complaint) throw createError("Complaint not found", 404, "COMPLAINT_NOT_FOUND");

  const previous = complaint.status;
  complaint.status = status;
  complaint.statusHistory.push({ status, changedBy: req.user._id, remarks: remarks || null });

  if (status === "Resolved") {
    complaint.resolutionDate = new Date();
    complaint.resolutionNotes = remarks || null;
  }

  // Add message to communication log
  if (remarks) {
    complaint.communicationLog.push({
      from: req.user._id,
      fromType: req.user.userType === "owner" ? "Owner" : "Employee",
      message: remarks,
      timestamp: new Date(),
    });
  }

  await complaint.save();

  return sendSuccess(res, {
    complaintId: complaint.complaintId,
    previousStatus: previous,
    newStatus: status,
    message: "Complaint status updated",
  });
});

// ─── 11.5 Add Message to Complaint ───────────────────────────────────────────
const addComplaintMessage = asyncHandler(async (req, res) => {
  const { message } = req.body;

  const resident = await Resident.findOne({ userId: req.user._id }).lean();

  const filter = {
    _id: req.params.complaintId,
    ...(resident ? { residentId: resident._id } : { hostelId: req.params.hostelId }),
  };

  const complaint = await Complaint.findOne(filter);
  if (!complaint) throw createError("Complaint not found", 404, "COMPLAINT_NOT_FOUND");

  const fromType = req.user.userType === "resident" ? "Resident"
    : req.user.userType === "owner" ? "Owner" : "Employee";

  complaint.communicationLog.push({
    from: req.user._id,
    fromType,
    message,
    timestamp: new Date(),
  });

  await complaint.save();

  return sendSuccess(res, { message: "Message added to complaint thread" });
});

// ─── 11.6 Delete Complaint ─────────────────────────────────────────────────────
const deleteComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findOne({
    _id: req.params.complaintId,
    hostelId: req.params.hostelId,
  });
  
  if (!complaint) throw createError("Complaint not found", 404, "COMPLAINT_NOT_FOUND");

  await complaint.deleteOne();

  return sendSuccess(res, { message: "Complaint removed successfully" });
});

module.exports = {
  raiseComplaint, getMyComplaints, getAllComplaints, updateComplaintStatus, addComplaintMessage, deleteComplaint,
};
