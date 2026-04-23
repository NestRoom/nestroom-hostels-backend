const Notification = require("../models/Notification.model");
const Resident = require("../models/Resident.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const { generateNotificationId } = require("../utils/idGenerator");

// ─── 10.1 Send Notification ───────────────────────────────────────────────────
const sendNotification = asyncHandler(async (req, res) => {
  const { title, message, type, recipientType, recipientIds, attachmentUrl, poll } = req.body;

  const hostelId = req.params.hostelId;

  // Resolve recipients
  let recipients = [];
  if (recipientType === "AllResidents") {
    const all = await Resident.find({ hostelId, residentStatus: "Active" }).select("_id").lean();
    recipients = all.map((r) => r._id);
  } else if (recipientType === "SelectedResidents" && recipientIds?.length) {
    recipients = recipientIds;
  }

  const notificationId = generateNotificationId();

  const notification = await Notification.create({
    notificationId,
    hostelId,
    senderId: req.user._id,
    title,
    message,
    type,
    recipientType,
    recipients,
    attachmentUrl: attachmentUrl || null,
    poll: poll || { isPoll: false },
    deliveryStatus: "Delivered",
    "deliverChannels.inApp": { status: "Delivered", timestamp: new Date() },
    sentAt: new Date(),
  });

  return sendSuccess(res, {
    notificationId: notification.notificationId,
    recipientCount: recipients.length,
    message: "Notification sent successfully",
  }, 201);
});

// ─── 10.2 Get My Notifications (Resident) ────────────────────────────────────
const getMyNotifications = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notificationsRaw, total] = await Promise.all([
    Notification.find({ recipients: resident._id })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Notification.countDocuments({ recipients: resident._id }),
  ]);

  const notifications = notificationsRaw.map(n => ({
    ...n,
    isRead: n.viewedBy?.some(v => String(v.residentId) === String(resident._id)) || false,
    viewedBy: undefined,
    poll: n.poll?.isPoll ? { ...n.poll, pollResponses: undefined } : n.poll
  }));

  return sendSuccess(res, {
    notifications,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// ─── 10.3 Mark Notification as Read ──────────────────────────────────────────
const markAsRead = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  const notification = await Notification.findById(req.params.notificationId);
  if (!notification) throw createError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");

  // Add to viewedBy if not already present
  const alreadyViewed = notification.viewedBy.some(
    (v) => String(v.residentId) === String(resident._id)
  );

  if (!alreadyViewed) {
    notification.viewedBy.push({
      residentId: resident._id,
      residentName: resident.fullName,
      viewedAt: new Date(),
    });
    notification.totalViewCount += 1;
    notification.viewRate = parseFloat(
      ((notification.totalViewCount / notification.recipients.length) * 100).toFixed(1)
    );
    await notification.save();
  }

  return sendSuccess(res, { message: "Marked as read" });
});

// ─── 10.4 Submit Poll Response ────────────────────────────────────────────────
const submitPollResponse = asyncHandler(async (req, res) => {
  const { selectedOption } = req.body;

  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  const notification = await Notification.findOne({
    _id: req.params.notificationId,
    "poll.isPoll": true,
    recipients: resident._id,
  });
  if (!notification) throw createError("Poll not found", 404, "POLL_NOT_FOUND");

  // Check deadline
  if (notification.poll.pollDeadline && new Date() > new Date(notification.poll.pollDeadline)) {
    throw createError("Poll deadline has passed", 400, "POLL_CLOSED");
  }

  // Check already responded
  const alreadyResponded = notification.poll.pollResponses.some(
    (r) => String(r.respondentId) === String(resident._id)
  );
  if (alreadyResponded) throw createError("You have already responded to this poll", 409, "ALREADY_RESPONDED");

  // Validate option
  if (notification.poll.pollOptions?.length && !notification.poll.pollOptions.includes(selectedOption)) {
    throw createError("Invalid poll option", 400, "INVALID_OPTION");
  }

  notification.poll.pollResponses.push({
    respondentId: resident._id,
    respondentName: resident.fullName,
    selectedOption,
    timestamp: new Date(),
  });
  notification.poll.totalResponses += 1;
  notification.poll.responseRate = parseFloat(
    ((notification.poll.totalResponses / notification.recipients.length) * 100).toFixed(1)
  );

  // Update breakdown
  const breakdown = notification.poll.responseBreakdown || {};
  breakdown[selectedOption] = (breakdown[selectedOption] || 0) + 1;
  notification.poll.responseBreakdown = breakdown;

  await notification.save();

  return sendSuccess(res, { message: "Poll response recorded" });
});

// ─── 10.5 Notification Analytics ─────────────────────────────────────────────
const getNotificationAnalytics = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.notificationId,
    hostelId: req.params.hostelId,
  })
    .select("title type recipients totalViewCount viewRate poll sentAt")
    .lean();

  if (!notification) throw createError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");

  return sendSuccess(res, {
    notificationId: req.params.notificationId,
    title: notification.title,
    type: notification.type,
    sentAt: notification.sentAt,
    totalRecipients: notification.recipients.length,
    views: {
      total: notification.totalViewCount,
      rate: `${notification.viewRate}%`,
    },
    poll: notification.poll?.isPoll ? {
      totalResponses: notification.poll.totalResponses,
      responseRate: `${notification.poll.responseRate}%`,
      breakdown: notification.poll.responseBreakdown,
    } : null,
  });
});

// ─── 10.6 Get Hostel Notifications (Admin) ───────────────────────────────────
const getHostelNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [notifications, total] = await Promise.all([
    Notification.find({ hostelId: req.params.hostelId })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("title message type recipients totalViewCount viewRate poll sentAt deliveryStatus viewedBy")
      .lean(),
    Notification.countDocuments({ hostelId: req.params.hostelId }),
  ]);

  return sendSuccess(res, {
    notifications,
    pagination: { 
      page: parseInt(page), 
      limit: parseInt(limit), 
      total, 
      pages: Math.ceil(total / parseInt(limit)) 
    },
  });
});

module.exports = {
  sendNotification, getMyNotifications, markAsRead, submitPollResponse, getNotificationAnalytics, getHostelNotifications
};
