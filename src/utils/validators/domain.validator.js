const Joi = require("joi");

const phoneSchema = Joi.string().pattern(/^\+[1-9]\d{6,14}$/).message("Use E.164 format e.g. +919876543210");

// ── Add Resident ──────────────────────────────────────────────────────────────
const addResidentSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).trim().required(),
  email: Joi.string().email().lowercase().trim().required(),
  whatsappNumber: phoneSchema.required(),
  dateOfBirth: Joi.string().isoDate().allow(null, "").default(null),
  gender: Joi.string().valid("Male", "Female", "Other").allow(null, "").default(null),
  college: Joi.string().max(200).allow(null, "").default(null),
  enrollmentNumber: Joi.string().max(50).allow(null, "").default(null),
  courseYear: Joi.string().max(20).allow(null, "").default(null),
  major: Joi.string().max(100).allow(null, "").default(null),
  idCardType: Joi.string().valid("Aadhaar", "PAN", "DL", "Passport", "Other").allow(null, "").default(null),
  idCardNumber: Joi.string().max(50).allow(null, "").default(null),
  feeAmount: Joi.number().min(0).required(),
  feeFrequency: Joi.string().valid("Monthly", "Quarterly", "Yearly").default("Monthly"),
  foodEnabled: Joi.boolean().default(false),
  securityDeposit: Joi.number().min(0).default(0),
  securityDepositPaid: Joi.boolean().default(false),
  roomId: Joi.string().required(),
  bedId: Joi.string().required(),
  emergencyContactName: Joi.string().max(100).allow(null, "").default(null),
  emergencyContactPhone: phoneSchema.allow(null, "").default(null),
  emergencyContactRelation: Joi.string().max(50).allow(null, "").default(null),
  dietaryPreferences: Joi.array().items(Joi.string()).default([]),
  specialRequests: Joi.string().max(500).allow(null, "").default(null),
  internalNotes: Joi.string().max(500).allow(null, "").default(null),
  checkInDate: Joi.string().isoDate().allow(null, "").default(null),
});

// ── Update Resident ───────────────────────────────────────────────────────────
const updateResidentSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).trim(),
  whatsappNumber: phoneSchema,
  college: Joi.string().max(200).allow(null),
  enrollmentNumber: Joi.string().max(50).allow(null),
  courseYear: Joi.string().max(20).allow(null),
  feeAmount: Joi.number().min(0),
  feeFrequency: Joi.string().valid("Monthly", "Quarterly", "Yearly"),
  foodEnabled: Joi.boolean(),
  emergencyContactName: Joi.string().max(100).allow(null),
  emergencyContactPhone: phoneSchema.allow(null),
  emergencyContactRelation: Joi.string().max(50).allow(null),
  specialRequests: Joi.string().max(500).allow(null),
  internalNotes: Joi.string().max(500).allow(null),
  residentStatus: Joi.string().valid("Active","Inactive","OnLeave","TerminatedWithNotice","TerminatedImmediate"),
});

// ── KYC Approve/Reject ────────────────────────────────────────────────────────
const kycActionSchema = Joi.object({
  action: Joi.string().valid("approve", "reject").required(),
  rejectionReason: Joi.when("action", {
    is: "reject",
    then: Joi.string().min(5).max(300).required(),
    otherwise: Joi.string().allow(null, "").default(null),
  }),
});

// ── Payment Init ──────────────────────────────────────────────────────────────
const verifyPaymentSchema = Joi.object({
  razorpay_order_id: Joi.string().required(),
  razorpay_payment_id: Joi.string().required(),
  razorpay_signature: Joi.string().required(),
});

// ── Manual Payment ────────────────────────────────────────────────────────────
const manualPaymentSchema = Joi.object({
  residentId: Joi.string().required(),
  amount: Joi.number().min(1).required(),
  mode: Joi.string().valid("Cash","Check","BankTransfer").required(),
  referenceNumber: Joi.string().max(100).allow(null),
  remarks: Joi.string().max(300).allow(null),
});

// ── Attendance Config ─────────────────────────────────────────────────────────
const attendanceConfigSchema = Joi.object({
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),
  geofenceRadius: Joi.number().min(50).max(10000).default(500),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).default("21:00"),
  windowMinutes: Joi.number().min(5).max(1440).default(120),
  enabled: Joi.boolean().default(false),
  daysOfWeek: Joi.array().items(Joi.string().valid("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")),
});

// ── Submit Attendance ─────────────────────────────────────────────────────────
const submitAttendanceSchema = Joi.object({
  status: Joi.string().valid("Present","Absent").required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().min(0).required(),
});

// ── Leave Application ─────────────────────────────────────────────────────────
const applyLeaveSchema = Joi.object({
  leaveType: Joi.string().valid("Sick","Personal","Medical","Emergency","Maternity","Paternity","Other").required(),
  fromDate: Joi.string().isoDate().required(),
  toDate: Joi.string().isoDate().required(),
  reason: Joi.string().min(10).max(500).required(),
  attachmentUrl: Joi.string().uri().allow(null),
});

// ── Leave Approve/Reject ──────────────────────────────────────────────────────
const approveLeaveSchema = Joi.object({
  remarks: Joi.string().max(300).allow(null),
});

const rejectLeaveSchema = Joi.object({
  rejectionReason: Joi.string().min(5).max(300).required(),
});

// ── Notifications ─────────────────────────────────────────────────────────────
const sendNotificationSchema = Joi.object({
  title: Joi.string().min(2).max(200).trim().required(),
  message: Joi.string().min(2).max(1000).trim().required(),
  type: Joi.string().valid("Announcement","Attendance","Payment","Leave","Food","Emergency","Survey").required(),
  recipientType: Joi.string().valid("AllResidents","SelectedResidents","ByRoom","ByFloor","ByBuilding").default("AllResidents"),
  recipientIds: Joi.array().items(Joi.string()).when("recipientType", {
    is: "SelectedResidents", then: Joi.required(),
  }),
  attachmentUrl: Joi.string().uri().allow(null),
  poll: Joi.object({
    isPoll: Joi.boolean().default(false),
    pollType: Joi.string().valid("MultiChoice","YesNo","Rating","OpenEnded").allow(null),
    pollQuestion: Joi.string().max(300).allow(null),
    pollOptions: Joi.array().items(Joi.string()).allow(null),
    pollDeadline: Joi.string().isoDate().allow(null),
  }).default({ isPoll: false }),
});

// ── Poll Response ─────────────────────────────────────────────────────────────
const pollResponseSchema = Joi.object({
  selectedOption: Joi.string().required(),
});

// ── Complaints ────────────────────────────────────────────────────────────────
const raiseComplaintSchema = Joi.object({
  title: Joi.string().min(5).max(200).trim().required(),
  description: Joi.string().min(10).max(1000).trim().required(),
  category: Joi.string().valid("Maintenance","Cleanliness","Staff","Food","Safety","Other").required(),
  priority: Joi.string().valid("Low","Medium","High","Critical").default("Medium"),
  location: Joi.string().max(200).allow(null),
});

const updateComplaintStatusSchema = Joi.object({
  status: Joi.string().valid("Open","InProgress","OnHold","Resolved","Closed","Rejected").required(),
  remarks: Joi.string().max(500).allow(null),
});

const addComplaintMessageSchema = Joi.object({
  message: Joi.string().min(1).max(1000).required(),
});

// ── Food Schedule ─────────────────────────────────────────────────────────────
const mealSchema = Joi.object({
  mealType: Joi.string().valid("Breakfast","Lunch","Dinner","Snacks").required(),
  time: Joi.string().allow(null),
  menu: Joi.array().items(Joi.string()).default([]),
  ingredients: Joi.array().items(Joi.string()).default([]),
  calories: Joi.number().allow(null),
  dietaryTags: Joi.array().items(Joi.string()).default([]),
  servingSize: Joi.string().allow(null),
  preparedBy: Joi.string().allow(null),
});

const dayScheduleSchema = Joi.object({
  dayOfWeek: Joi.string().valid("Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday").required(),
  date: Joi.string().isoDate().allow(null),
  meals: Joi.array().items(mealSchema).required(),
});

const createFoodScheduleSchema = Joi.object({
  weekNumber: Joi.number().integer().min(1).max(53).required(),
  weekStartDate: Joi.string().isoDate().required(),
  weekEndDate: Joi.string().isoDate().required(),
  schedule: Joi.array().items(dayScheduleSchema).min(1).required(),
  isVegetarian: Joi.boolean().default(true),
  isNonVegetarian: Joi.boolean().default(false),
  hasVeganOptions: Joi.boolean().default(false),
  hasGlutenFreeOptions: Joi.boolean().default(false),
  hasHalal: Joi.boolean().default(false),
  specialNotes: Joi.string().max(500).allow(null),
});

// ── Meal Feedback ─────────────────────────────────────────────────────────────
const mealFeedbackSchema = Joi.object({
  mealType: Joi.string().valid("Breakfast","Lunch","Dinner","Snacks").required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(300).allow(null),
});

module.exports = {
  addResidentSchema, updateResidentSchema, kycActionSchema,
  verifyPaymentSchema, manualPaymentSchema,
  attendanceConfigSchema, submitAttendanceSchema,
  applyLeaveSchema, approveLeaveSchema, rejectLeaveSchema,
  sendNotificationSchema, pollResponseSchema,
  raiseComplaintSchema, updateComplaintStatusSchema, addComplaintMessageSchema,
  createFoodScheduleSchema, mealFeedbackSchema,
};
