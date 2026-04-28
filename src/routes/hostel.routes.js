const express = require("express");
const router = express.Router();

const authenticate = require("../middlewares/authenticate");
const { requireOwner, requireOwnerOrEmployee, validateHostelOwnership } = require("../middlewares/rbac");
const validate = require("../middlewares/validate");
const auditLog = require("../middlewares/auditLog");
const { uploadHostelImages, uploadRoomImages, uploadComplaintAttachments } = require("../middlewares/upload");

// ── Validators ────────────────────────────────────────────────────────────────
const {
  updateHostelSchema, updateBankDetailsSchema,
  addEmployeeSchema, createBuildingSchema, createRoomSchema, updateRoomSchema,
} = require("../utils/validators/hostel.validator");
const {
  addResidentSchema, updateResidentSchema, kycActionSchema,
  manualPaymentSchema, attendanceConfigSchema,
  approveLeaveSchema, rejectLeaveSchema,
  sendNotificationSchema, updateComplaintStatusSchema, addComplaintMessageSchema,
  createFoodScheduleSchema,
} = require("../utils/validators/domain.validator");

// ── Controllers ───────────────────────────────────────────────────────────────
const {
  getAllHostels, getHostelProfile, updateHostelProfile, updateBankDetails,
  getProfileCompletion, addEmployee, getEmployees,
  getBuildings, createBuilding, getRooms, createRoom, updateRoom, deleteRoom,
} = require("../controllers/hostel.controller");

const { addResident, getResidents, getResidentById, updateResident, processKYC } = require("../controllers/resident.controller");
const { recordManualPayment, getPaymentHistory, getRevenueDashboard } = require("../controllers/payment.controller");
const { setAttendanceConfig, requestAttendance, getAttendanceHistory } = require("../controllers/attendance.controller");
const { getAllLeaves, approveLeave, rejectLeave } = require("../controllers/leave.controller");
const { sendNotification, getNotificationAnalytics, getHostelNotifications } = require("../controllers/notification.controller");
const { getAllComplaints, updateComplaintStatus, addComplaintMessage, deleteComplaint } = require("../controllers/complaint.controller");
const { createFoodSchedule, getCurrentFoodSchedule, getFoodSchedules } = require("../controllers/food.controller");

// All hostel routes require authentication
router.use(authenticate);

// ─── Hostel List (owner only) ─────────────────────────────────────────────────
// GET /v1/hostels
router.get("/", requireOwner, getAllHostels);

// ─── Per-hostel routes ────────────────────────────────────────────────────────
// Validate hostel ownership / employee hostel membership for all /:hostelId routes
router.use("/:hostelId", validateHostelOwnership);

// ── Hostel Profile ────────────────────────────────────────────────────────────
router.get("/:hostelId", getHostelProfile);
router.put("/:hostelId", requireOwner, validate(updateHostelSchema), auditLog("UPDATE", "Hostel"), updateHostelProfile);
router.put("/:hostelId/bank-details", requireOwner, validate(updateBankDetailsSchema), auditLog("UPDATE", "Hostel"), updateBankDetails);
router.get("/:hostelId/profile-completion", getProfileCompletion);

// ── Employees ─────────────────────────────────────────────────────────────────
router.post("/:hostelId/employees", requireOwner, validate(addEmployeeSchema), auditLog("CREATE", "Employee"), addEmployee);
router.get("/:hostelId/employees", requireOwnerOrEmployee("canManageEmployees"), getEmployees);

// ── Buildings ─────────────────────────────────────────────────────────────────
router.get("/:hostelId/buildings", getBuildings);
router.post("/:hostelId/buildings", requireOwner, validate(createBuildingSchema), auditLog("CREATE", "Building"), createBuilding);

// ── Rooms ─────────────────────────────────────────────────────────────────────
router.get("/:hostelId/rooms", getRooms);
router.post("/:hostelId/rooms", requireOwnerOrEmployee("canManageRooms"), validate(createRoomSchema), auditLog("CREATE", "Room"), createRoom);
router.put("/:hostelId/rooms/:roomId", requireOwnerOrEmployee("canManageRooms"), validate(updateRoomSchema), auditLog("UPDATE", "Room"), updateRoom);
router.delete("/:hostelId/rooms/:roomId", requireOwner, auditLog("DELETE", "Room"), deleteRoom);

// ── Residents ─────────────────────────────────────────────────────────────────
// POST /v1/hostels/:id/residents
router.post("/:hostelId/residents", requireOwnerOrEmployee("canAddResidents"), validate(addResidentSchema), auditLog("CREATE", "Resident"), addResident);
// GET  /v1/hostels/:id/residents
router.get("/:hostelId/residents", requireOwnerOrEmployee("canViewPayments"), getResidents);
// GET  /v1/hostels/:id/residents/:residentId
router.get("/:hostelId/residents/:residentId", requireOwnerOrEmployee("canEditResidents"), getResidentById);
// PUT  /v1/hostels/:id/residents/:residentId
router.put("/:hostelId/residents/:residentId", requireOwnerOrEmployee("canEditResidents"), validate(updateResidentSchema), auditLog("UPDATE", "Resident"), updateResident);
// PUT  /v1/hostels/:id/residents/:residentId/kyc
router.put("/:hostelId/residents/:residentId/kyc", requireOwnerOrEmployee("canApproveKYC"), validate(kycActionSchema), auditLog("APPROVE", "Resident"), processKYC);

// ── Payments ──────────────────────────────────────────────────────────────────
// GET  /v1/hostels/:id/revenue
router.get("/:hostelId/revenue", requireOwnerOrEmployee("canViewRevenue"), getRevenueDashboard);
// GET  /v1/hostels/:id/payments
router.get("/:hostelId/payments", requireOwnerOrEmployee("canViewPayments"), getPaymentHistory);
// POST /v1/hostels/:id/payments/manual
router.post("/:hostelId/payments/manual", requireOwnerOrEmployee("canMarkPaymentManual"), validate(manualPaymentSchema), auditLog("CREATE", "Payment"), recordManualPayment);

// ── Attendance ────────────────────────────────────────────────────────────────
// POST /v1/hostels/:id/attendance/config
router.post("/:hostelId/attendance/config", requireOwner, validate(attendanceConfigSchema), setAttendanceConfig);
// POST /v1/hostels/:id/attendance/request
router.post("/:hostelId/attendance/request", requireOwnerOrEmployee("canInitiateAttendance"), auditLog("CREATE", "AttendanceRecord"), requestAttendance);
// GET  /v1/hostels/:id/attendance
router.get("/:hostelId/attendance", requireOwnerOrEmployee("canViewAttendance"), getAttendanceHistory);

// ── Leaves ────────────────────────────────────────────────────────────────────
// GET  /v1/hostels/:id/leaves
router.get("/:hostelId/leaves", requireOwnerOrEmployee("canApproveLeaves"), getAllLeaves);
// PUT  /v1/hostels/:id/leaves/:leaveId/approve
router.put("/:hostelId/leaves/:leaveId/approve", requireOwnerOrEmployee("canApproveLeaves"), validate(approveLeaveSchema), auditLog("APPROVE", "LeaveApplication"), approveLeave);
// PUT  /v1/hostels/:id/leaves/:leaveId/reject
router.put("/:hostelId/leaves/:leaveId/reject", requireOwnerOrEmployee("canRejectLeaves"), validate(rejectLeaveSchema), auditLog("REJECT", "LeaveApplication"), rejectLeave);

// ── Notifications ─────────────────────────────────────────────────────────────
// POST /v1/hostels/:id/notifications
router.post("/:hostelId/notifications", requireOwnerOrEmployee("canSendNotifications"), validate(sendNotificationSchema), auditLog("CREATE", "Notification"), sendNotification);
// GET  /v1/hostels/:id/notifications
router.get("/:hostelId/notifications", requireOwnerOrEmployee("canViewNotifications"), getHostelNotifications);
// GET  /v1/hostels/:id/notifications/:notificationId/analytics
router.get("/:hostelId/notifications/:notificationId/analytics", requireOwnerOrEmployee("canViewNotificationAnalytics"), getNotificationAnalytics);

// ── Complaints ────────────────────────────────────────────────────────────────
// GET  /v1/hostels/:id/complaints
router.get("/:hostelId/complaints", requireOwnerOrEmployee("canViewComplaints"), getAllComplaints);
// PUT  /v1/hostels/:id/complaints/:complaintId/status
router.put("/:hostelId/complaints/:complaintId/status", requireOwnerOrEmployee("canUpdateComplaintStatus"), validate(updateComplaintStatusSchema), auditLog("UPDATE", "Complaint"), updateComplaintStatus);
// POST /v1/hostels/:id/complaints/:complaintId/message
router.post("/:hostelId/complaints/:complaintId/message", requireOwnerOrEmployee("canViewComplaints"), validate(addComplaintMessageSchema), addComplaintMessage);
// DELETE /v1/hostels/:id/complaints/:complaintId
router.delete("/:hostelId/complaints/:complaintId", requireOwnerOrEmployee("canUpdateComplaintStatus"), auditLog("DELETE", "Complaint"), deleteComplaint);

// ── Food Schedule ─────────────────────────────────────────────────────────────
// POST /v1/hostels/:id/food-schedule
router.post("/:hostelId/food-schedule", requireOwnerOrEmployee("canManageFoodSchedule"), validate(createFoodScheduleSchema), auditLog("CREATE", "FoodSchedule"), createFoodSchedule);
// GET  /v1/hostels/:id/food-schedule  (current week)
router.get("/:hostelId/food-schedule", getCurrentFoodSchedule);
// GET  /v1/hostels/:id/food-schedule/all
router.get("/:hostelId/food-schedule/all", getFoodSchedules);

// ── Ping ──────────────────────────────────────────────────────────────────────
router.get("/ping", (req, res) => res.json({ success: true, data: { module: "hostels" } }));

module.exports = router;
