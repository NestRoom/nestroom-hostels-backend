const transporter = require("../config/mailer");

const FROM = process.env.EMAIL_FROM || "nestRoom <noreply@nestroom.app>";

/**
 * Send an OTP verification email.
 */
const sendOTPEmail = async (to, otp, userName = "User") => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "nestRoom — Email Verification OTP",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1d4ed8;">nestRoom</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Your email verification OTP is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1d4ed8;margin:16px 0;">${otp}</div>
        <p style="color:#6b7280;font-size:13px;">Valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
};

/**
 * Send welcome + login credentials email (for residents / employees).
 */
const sendCredentialsEmail = async (to, { fullName, email, password, code, role = "resident" }) => {
  const codeLabel = role === "resident" ? "Resident Code" : "Employee Code";
  
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `nestRoom — Your ${role.charAt(0).toUpperCase() + role.slice(1)} Credentials`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1d4ed8;">Welcome to nestRoom 🏠</h2>
        <p>Hi <strong>${fullName}</strong>,</p>
        <p>Your ${role} account has been created. Here are your login credentials:</p>
        <table style="width:100%;border-collapse:collapse;margin:12px 0;">
          <tr><td style="padding:8px;background:#f9fafb;"><strong>Email</strong></td><td style="padding:8px;">${email}</td></tr>
          <tr><td style="padding:8px;background:#f9fafb;"><strong>Password</strong></td><td style="padding:8px;font-family:monospace;">${password}</td></tr>
          ${code ? `<tr><td style="padding:8px;background:#f9fafb;"><strong>${codeLabel}</strong></td><td style="padding:8px;">${code}</td></tr>` : ""}
        </table>
        <p style="color:#dc2626;font-size:13px;">⚠️ Please change your password immediately after first login.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">nestRoom — Hostel Management Platform</p>
      </div>
    `,
  });
};

/**
 * Send a password reset OTP email.
 */
const sendPasswordResetEmail = async (to, otp, userName = "User") => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: "nestRoom — Password Reset OTP",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#1d4ed8;">nestRoom</h2>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Your password reset OTP is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#dc2626;margin:16px 0;">${otp}</div>
        <p style="color:#6b7280;font-size:13px;">Valid for <strong>10 minutes</strong>. Do not share this OTP with anyone.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">If you did not request a password reset, please secure your account immediately.</p>
      </div>
    `,
  });
};

/**
 * Send a payment receipt email.
 */
const sendPaymentReceiptEmail = async (to, { residentName, amount, period, receiptUrl, nextDueDate }, attachments = []) => {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `nestRoom — Payment Receipt for ${period}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="color:#16a34a;">Payment Successful ✅</h2>
        <p>Hi <strong>${residentName}</strong>,</p>
        <p>Your hostel fee payment of <strong>₹${amount}</strong> for <strong>${period}</strong> has been received.</p>
        <p>Next due date: <strong>${nextDueDate}</strong></p>
        ${receiptUrl ? `<p><a href="${receiptUrl}" style="color:#1d4ed8;">Download Receipt →</a></p>` : ""}
        <p>Please find the invoice attached to this email.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
        <p style="color:#9ca3af;font-size:12px;">nestRoom — Hostel Management Platform</p>
      </div>
    `,
    attachments,
  });
};

module.exports = {
  sendOTPEmail,
  sendCredentialsEmail,
  sendPasswordResetEmail,
  sendPaymentReceiptEmail,
};
