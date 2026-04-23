const crypto = require("crypto");
const mongoose = require("mongoose");
const razorpay = require("../config/razorpay");
const Payment = require("../models/Payment.model");
const Resident = require("../models/Resident.model");
const Hostel = require("../models/Hostel.model");

const { asyncHandler, createError } = require("../middlewares/errorHandler");
const { sendSuccess } = require("../utils/responseHelper");
const { generatePaymentId } = require("../utils/idGenerator");
const { sendPaymentReceiptEmail } = require("../services/email");

// ─── 7.1 Initialize Razorpay Payment ─────────────────────────────────────────
const initializePayment = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  const amount = resident.feeAmount * 100; // paise
  const paymentId = generatePaymentId();

  // Create Razorpay order
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: paymentId,
    notes: {
      residentId: resident.residentId,
      hostelId: String(resident.hostelId),
    },
  });

  // Store pending payment
  await Payment.create({
    paymentId,
    residentId: resident._id,
    hostelId: resident.hostelId,
    userId: req.user._id,
    amount: resident.feeAmount,
    currency: "INR",
    paymentStatus: "Pending",
    paymentMethod: "Razorpay",
    dueDate: resident.nextDueDate,
    forPeriod: {
      frequencyType: resident.feeFrequency,
    },
    "razorpay.orderId": order.id,
    createdBy: req.user._id,
  });

  return sendSuccess(res, {
    orderId: order.id,
    amount: resident.feeAmount,
    currency: "INR",
    paymentId,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
});

// ─── 7.2 Verify Razorpay Payment ──────────────────────────────────────────────
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // HMAC-SHA256 signature verification
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw createError("Payment signature verification failed", 400, "INVALID_SIGNATURE");
  }

  const payment = await Payment.findOne({ "razorpay.orderId": razorpay_order_id });
  if (!payment) throw createError("Payment record not found", 404, "PAYMENT_NOT_FOUND");

  payment.paymentStatus = "Success";
  payment.razorpay.paymentId = razorpay_payment_id;
  payment.razorpay.signature = razorpay_signature;
  payment.amountPaid = payment.amount;
  payment.amountDue = 0;
  payment.paidDate = new Date();
  payment.paymentStatusHistory.push({ status: "Success", changedBy: "razorpay" });
  await payment.save();

  // Advance resident's next due date
  const resident = await Resident.findById(payment.residentId);
  if (resident) {
    const next = new Date(resident.nextDueDate || new Date());
    if (resident.feeFrequency === "Monthly") next.setMonth(next.getMonth() + 1);
    else if (resident.feeFrequency === "Quarterly") next.setMonth(next.getMonth() + 3);
    else next.setFullYear(next.getFullYear() + 1);
    resident.nextDueDate = next;
    await resident.save();

    // Update hostel total revenue
    await Hostel.findByIdAndUpdate(payment.hostelId, {
      $inc: { totalRevenue: payment.amount },
    });

    // Send receipt email
    try {
      await sendPaymentReceiptEmail(resident.email, {
        residentName: resident.fullName,
        amount: payment.amount,
        period: resident.feeFrequency,
        nextDueDate: next.toDateString(),
        receiptUrl: null,
      });
    } catch (e) {
      console.error("Receipt email failed:", e.message);
    }
  }

  return sendSuccess(res, {
    paymentId: payment.paymentId,
    status: "Success",
    paidDate: payment.paidDate,
    message: "Payment verified and recorded successfully",
  });
});

// ─── 7.3 Mark Manual Payment ──────────────────────────────────────────────────
const recordManualPayment = asyncHandler(async (req, res) => {
  const { residentId, amount, mode, referenceNumber, remarks } = req.body;

  const resident = await Resident.findOne({ _id: residentId, hostelId: req.params.hostelId });
  if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");

  const paymentId = generatePaymentId();
  const payment = await Payment.create({
    paymentId,
    residentId: resident._id,
    hostelId: req.params.hostelId,
    userId: resident.userId,
    amount,
    amountPaid: amount,
    currency: "INR",
    paymentStatus: "Success",
    paymentMethod: "Manual",
    paidDate: new Date(),
    dueDate: resident.nextDueDate,
    remarks,
    manualPayment: { isManual: true, mode, referenceNumber, checkedBy: req.user._id, verifiedAt: new Date() },
    createdBy: req.user._id,
    paymentStatusHistory: [{ status: "Success", changedBy: String(req.user._id) }],
  });

  // Advance due date
  const next = new Date(resident.nextDueDate || new Date());
  if (resident.feeFrequency === "Monthly") next.setMonth(next.getMonth() + 1);
  else if (resident.feeFrequency === "Quarterly") next.setMonth(next.getMonth() + 3);
  else next.setFullYear(next.getFullYear() + 1);
  resident.nextDueDate = next;
  await resident.save();

  await Hostel.findByIdAndUpdate(req.params.hostelId, { $inc: { totalRevenue: amount } });

  return sendSuccess(res, { paymentId: payment.paymentId, message: "Manual payment recorded" }, 201);
});

// ─── 7.4 Payment History ──────────────────────────────────────────────────────
const getPaymentHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Resident self-service
  const filter = {};
  if (req.user.userType === "resident") {
    const resident = await Resident.findOne({ userId: req.user._id }).lean();
    if (!resident) throw createError("Resident not found", 404, "RESIDENT_NOT_FOUND");
    filter.residentId = resident._id;
  } else {
    filter.hostelId = req.params.hostelId;
  }
  if (status) filter.paymentStatus = status;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .select("-razorpay.signature -razorpay.responseData")
      .populate("residentId", "fullName residentId kyc.profilePhoto")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Payment.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    payments,
    pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
  });
});

// ─── 7.5 Upcoming Payment ─────────────────────────────────────────────────────
const getUpcomingPayment = asyncHandler(async (req, res) => {
  const resident = await Resident.findOne({ userId: req.user._id }).lean();
  if (!resident) throw createError("Resident not found", 404);

  return sendSuccess(res, {
    residentId: resident.residentId,
    feeAmount: resident.feeAmount,
    feeFrequency: resident.feeFrequency,
    nextDueDate: resident.nextDueDate,
    daysRemaining: Math.ceil((new Date(resident.nextDueDate) - new Date()) / (1000 * 60 * 60 * 24)),
  });
});

// ─── 7.6 Revenue Dashboard ────────────────────────────────────────────────────
const getRevenueDashboard = asyncHandler(async (req, res) => {
  const hostelId = req.params.hostelId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    monthly, 
    yearly, 
    totalPending, 
    outstanding, 
    hostel,
    rooms,
    residentsCount,
    upcomingRenewalsCount
  ] = await Promise.all([
    Payment.aggregate([
      { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), paymentStatus: "Success", paidDate: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), paymentStatus: "Success", paidDate: { $gte: startOfYear } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.countDocuments({ hostelId, paymentStatus: "Pending" }),
    Payment.aggregate([
      { $match: { hostelId: new mongoose.Types.ObjectId(hostelId), paymentStatus: "Pending" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Hostel.findById(hostelId).select("totalRevenue").lean(),
    mongoose.model("Room").find({ hostelId, isActive: true }).select("bedCount pricing").lean(),
    Resident.countDocuments({ hostelId, residentStatus: "Active" }),
    Resident.countDocuments({ 
      hostelId, 
      residentStatus: "Active", 
      nextDueDate: { $gte: now, $lte: sevenDaysFromNow } 
    }),
  ]);

  // Potential Income calculation
  let potentialMonthlyIncome = 0;
  rooms.forEach(room => {
    potentialMonthlyIncome += (room.bedCount * (room.pricing?.monthly?.amount || 0));
  });

  // Submission Statistics
  const submittedCount = await Resident.countDocuments({ 
    hostelId, 
    residentStatus: "Active", 
    nextDueDate: { $gt: new Date(now.getFullYear(), now.getMonth() + 1, 1) } 
  });

  const nonSubmittedCount = residentsCount - submittedCount;

  // Monthly trends
  const trendsResponse = await Payment.aggregate([
    { 
      $match: { 
        hostelId: new mongoose.Types.ObjectId(hostelId), 
        paymentStatus: "Success", 
        paidDate: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } 
      } 
    },
    {
      $group: {
        _id: { month: { $month: "$paidDate" }, year: { $year: "$paidDate" } },
        earnings: { $sum: "$amount" }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);

  return sendSuccess(res, {
    allTimeRevenue: hostel?.totalRevenue || 0,
    monthlyRevenue: monthly[0]?.total || 0,
    monthlyPayments: monthly[0]?.count || 0,
    yearlyRevenue: yearly[0]?.total || 0,
    pendingPayments: totalPending,
    outstandingAmount: outstanding[0]?.total || 0,
    potentialMonthlyIncome,
    stats: {
      submitted: submittedCount,
      nonSubmitted: nonSubmittedCount,
      totalResidents: residentsCount,
      upcomingRenewals: upcomingRenewalsCount
    },
    trends: trendsResponse.map(t => ({
      month: new Date(t._id.year, t._id.month - 1).toLocaleString('default', { month: 'short' }),
      earnings: t.earnings
    }))
  });
});



module.exports = {
  initializePayment, verifyPayment, recordManualPayment,
  getPaymentHistory, getUpcomingPayment, getRevenueDashboard,
};
