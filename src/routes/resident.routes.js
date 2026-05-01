const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const { requireOwner, requireOwnerOrEmployee, requireResident } = require("../middlewares/rbac");
const validate = require("../middlewares/validate");
const auditLog = require("../middlewares/auditLog");
const { uploadKYCDocuments, uploadComplaintAttachments } = require("../middlewares/upload");

const {
  addResidentSchema, updateResidentSchema, kycActionSchema,
  verifyPaymentSchema, manualPaymentSchema,
  attendanceConfigSchema, submitAttendanceSchema,
  applyLeaveSchema, approveLeaveSchema, rejectLeaveSchema,
  sendNotificationSchema, pollResponseSchema,
  raiseComplaintSchema, updateComplaintStatusSchema, addComplaintMessageSchema,
  createFoodScheduleSchema, mealFeedbackSchema,
} = require("../utils/validators/domain.validator");

const { addResident, getResidents, getResidentById, updateResident, getMyProfile, uploadKYC, processKYC } = require("../controllers/resident.controller");
const { initializePayment, verifyPayment, getPaymentHistory, getUpcomingPayment, downloadInvoice } = require("../controllers/payment.controller");
const { submitAttendance, getMyAttendance, getActiveAttendanceRequest } = require("../controllers/attendance.controller");
const { applyLeave, getMyLeaves } = require("../controllers/leave.controller");
const { getMyNotifications, markAsRead, submitPollResponse } = require("../controllers/notification.controller");
const { raiseComplaint, getMyComplaints, addComplaintMessage } = require("../controllers/complaint.controller");
const { getCurrentFoodSchedule, getFoodSchedules, submitMealFeedback } = require("../controllers/food.controller");

// All resident self-service routes require authentication
router.use(authenticate);

// ── Resident Profile ──────────────────────────────────────────────────────────
// GET  /v1/residents/profile
router.get("/profile", requireResident, getMyProfile);

// POST /v1/residents/kyc-upload
router.post("/kyc-upload", requireResident, uploadKYCDocuments, auditLog("UPDATE", "Resident"), uploadKYC);

// ── Payments ──────────────────────────────────────────────────────────────────
// POST /v1/residents/payments/initialize
router.post("/payments/initialize", requireResident, auditLog("CREATE", "Payment"), initializePayment);

// POST /v1/residents/payments/verify
router.post("/payments/verify", requireResident, validate(verifyPaymentSchema), auditLog("UPDATE", "Payment"), verifyPayment);

// GET  /v1/residents/payments/history
router.get("/payments/history", requireResident, getPaymentHistory);

// GET  /v1/residents/payments/upcoming
router.get("/payments/upcoming", requireResident, getUpcomingPayment);

// GET  /v1/residents/payments/invoice/:paymentId
router.get("/payments/invoice/:paymentId", requireResident, downloadInvoice);

// ── Attendance ────────────────────────────────────────────────────────────────
// GET  /v1/residents/attendance/active
router.get("/attendance/active", requireResident, getActiveAttendanceRequest);

// POST /v1/residents/attendance/submit
router.post("/attendance/submit", requireResident, validate(submitAttendanceSchema), auditLog("CREATE", "AttendanceRecord"), submitAttendance);

// GET  /v1/residents/attendance/history
router.get("/attendance/history", requireResident, getMyAttendance);

// ── Leaves ────────────────────────────────────────────────────────────────────
// POST /v1/residents/leaves
router.post("/leaves", requireResident, validate(applyLeaveSchema), auditLog("CREATE", "LeaveApplication"), applyLeave);

// GET  /v1/residents/leaves
router.get("/leaves", requireResident, getMyLeaves);

// ── Notifications ─────────────────────────────────────────────────────────────
// GET  /v1/residents/notifications
router.get("/notifications", requireResident, getMyNotifications);

// PUT  /v1/residents/notifications/:notificationId/read
router.put("/notifications/:notificationId/read", requireResident, markAsRead);

// POST /v1/residents/notifications/:notificationId/poll-response
router.post(
  "/notifications/:notificationId/poll-response",
  requireResident,
  validate(pollResponseSchema),
  submitPollResponse
);

// ── Complaints ────────────────────────────────────────────────────────────────
// POST /v1/residents/complaints
router.post(
  "/complaints",
  requireResident,
  uploadComplaintAttachments,
  validate(raiseComplaintSchema),
  auditLog("CREATE", "Complaint"),
  raiseComplaint
);

// GET  /v1/residents/complaints
router.get("/complaints", requireResident, getMyComplaints);

// POST /v1/residents/complaints/:complaintId/message
router.post(
  "/complaints/:complaintId/message",
  requireResident,
  validate(addComplaintMessageSchema),
  addComplaintMessage
);

// ── Food Schedule ─────────────────────────────────────────────────────────────
// GET  /v1/residents/food-schedule  (current week)
router.get("/food-schedule", requireResident, getCurrentFoodSchedule);

// GET  /v1/residents/food-schedule/all
router.get("/food-schedule/all", requireResident, getFoodSchedules);

// POST /v1/residents/food-schedule/feedback
router.post(
  "/food-schedule/feedback",
  requireResident,
  validate(mealFeedbackSchema),
  submitMealFeedback
);

// ── Ping ──────────────────────────────────────────────────────────────────────
router.get("/ping", (req, res) => res.json({ success: true, data: { module: "residents" } }));

module.exports = router;
