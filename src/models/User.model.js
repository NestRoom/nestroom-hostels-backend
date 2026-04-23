const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // ── System ────────────────────────────────────────────────────────────────
    userId: { type: String, required: true, unique: true, trim: true },

    // ── Auth ──────────────────────────────────────────────────────────────────
    userType: {
      type: String,
      enum: ["owner", "resident", "employee"],
      required: true,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    passwordEncrypted: { type: String, default: null }, // AES encrypted for admin view (residents only)
    whatsappNumber: { type: String, required: true, unique: true, trim: true },

    // ── Profile ───────────────────────────────────────────────────────────────
    fullName: { type: String, required: true, trim: true },
    profilePhoto: { type: String, default: null },
    coverPhoto: { type: String, default: null },

    // ── Verification ─────────────────────────────────────────────────────────
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    whatsappVerified: { type: Boolean, default: false },
    whatsappVerifiedAt: { type: Date, default: null },
    verificationToken: { type: String, default: null },
    verificationTokenExpiry: { type: Date, default: null },

    // ── WhatsApp OTP ─────────────────────────────────────────────────────────
    whatsappOtp: { type: String, default: null },
    whatsappOtpExpiry: { type: Date, default: null },

    // ── Security ─────────────────────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    suspensionReason: { type: String, default: null },

    // ── 2FA ───────────────────────────────────────────────────────────────────
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null },
    twoFactorSecretPending: { type: String, default: null }, // before verify

    // ── Password Reset ────────────────────────────────────────────────────────
    resetToken: { type: String, default: null },
    resetTokenExpiry: { type: Date, default: null },

    // ── Refresh Token ─────────────────────────────────────────────────────────
    refreshToken: { type: String, default: null },

    // ── Last Login ────────────────────────────────────────────────────────────
    lastLogin: { type: Date, default: null },

    // ── Preferences ───────────────────────────────────────────────────────────
    preferences: {
      notificationEmail: { type: Boolean, default: true },
      notificationWhatsapp: { type: Boolean, default: true },
      notificationApp: { type: Boolean, default: true },
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      language: { type: String, default: "en" },
      timezone: { type: String, default: "Asia/Kolkata" },
    },

    // ── Employee-only fields ──────────────────────────────────────────────────
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hostel", default: null },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────────────────
userSchema.index({ userType: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Strip sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordEncrypted;
  delete obj.twoFactorSecret;
  delete obj.twoFactorSecretPending;
  delete obj.verificationToken;
  delete obj.whatsappOtp;
  delete obj.resetToken;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
