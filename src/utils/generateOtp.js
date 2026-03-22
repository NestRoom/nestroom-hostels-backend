/**
 * src/utils/generateOtp.js
 *
 * WHY THIS FILE EXISTS:
 * We need to generate a 6-digit OTP for WhatsApp verification. It is critical
 * that this is NOT using Math.random().
 *
 * WHY NOT Math.random():
 * Math.random() is a pseudorandom number generator (PRNG). Its output is
 * deterministic given the internal seed. An attacker who knows enough about
 * the PRNG state could predict future OTPs. This is a real attack class
 * (PRNG prediction attacks).
 *
 * WHY crypto.randomInt():
 * Node.js's built-in `crypto` module provides cryptographically secure random
 * numbers from the operating system's entropy source (/dev/urandom on Linux/Mac).
 * These cannot be predicted even with knowledge of previous values.
 *
 * HOW IT WORKS:
 * crypto.randomInt(min, max) returns a random integer: min <= result < max.
 * We use range [0, 1000000) to get all 6-digit combinations (000000–999999).
 * .toString().padStart(6, '0') ensures leading zeros are preserved
 * (e.g. 42 becomes "000042").
 */

const { randomInt } = require('crypto');

/**
 * Generates a cryptographically secure 6-digit OTP.
 * @returns {string} A 6-digit string like "047231"
 */
function generateOtp() {
  const otp = randomInt(0, 1_000_000); // 0 to 999999
  return otp.toString().padStart(6, '0');
}

module.exports = generateOtp;
