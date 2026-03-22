/**
 * src/utils/jwt.js
 *
 * WHY THIS FILE EXISTS:
 * JSON Web Tokens (JWTs) are our session mechanism. After any successful login
 * (Google, email/password, WhatsApp OTP), we issue a JWT that the frontend
 * stores and sends with every subsequent request.
 *
 * WHY JWTS (not sessions/cookies):
 * - JWTs are stateless — the server doesn't need to store session data in a DB
 * - They work naturally across multiple servers (horizontal scaling)
 * - The frontend (Next.js) can easily attach them as Authorization headers
 *
 * HOW A JWT WORKS:
 * A JWT has 3 base64-encoded parts separated by dots:
 *   header.payload.signature
 *
 * The `payload` contains our data (user ID, role, hostelId).
 * The `signature` is created by hashing (header + payload) with JWT_SECRET.
 * On every request, we re-verify the signature — if the payload was tampered
 * with, the signature check fails and we reject the request.
 *
 * SECURITY NOTE:
 * The payload is NOT encrypted — it is only signed. Do not put sensitive data
 * (passwords, OTPs) in a JWT payload. We only put: userId, role, hostelId.
 */

const jwt = require('jsonwebtoken');

/**
 * Creates a signed JWT containing the user's identity.
 *
 * @param {Object} payload - Data to encode in the token
 * @param {string} payload.userId - MongoDB _id of the user (as string)
 * @param {string} payload.role - User's role (e.g., 'admin')
 * @param {string} payload.hostelId - MongoDB _id of their hostel (as string)
 * @returns {string} Signed JWT string
 */
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

/**
 * Verifies a JWT and returns its decoded payload.
 * Throws a JsonWebTokenError if invalid, TokenExpiredError if expired.
 *
 * @param {string} token - JWT string from Authorization header
 * @returns {Object} Decoded payload ({ userId, role, hostelId, iat, exp })
 */
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
