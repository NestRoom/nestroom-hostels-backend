/**
 * src/middleware/auth.js
 *
 * WHY THIS FILE EXISTS:
 * Most of our API routes should only be accessible to logged-in users.
 * Instead of checking authentication inside every controller, we extract it
 * into a middleware function that runs BEFORE the controller.
 *
 * HOW MIDDLEWARE WORKS IN EXPRESS:
 * In Express, request processing is a pipeline. Each middleware function
 * receives (req, res, next). Calling next() passes control to the next step.
 * Not calling next() (and sending a response instead) stops the pipeline.
 *
 * Usage in routes:
 *   const protect = require('../middleware/auth');
 *   router.get('/rooms', protect, roomsController.getAll);
 *   // protect runs first. If it calls next(), roomsController.getAll runs.
 *   // If protect sends a 401 response, roomsController.getAll never runs.
 *
 * WHAT THIS MIDDLEWARE DOES:
 * 1. Reads the Authorization header: "Bearer <token>"
 * 2. Extracts the token string
 * 3. Verifies the JWT signature using verifyToken()
 * 4. If valid: attaches the decoded payload to req.user, calls next()
 * 5. If invalid/missing: sends 401 Unauthorized
 *
 * WHY req.user:
 * Attaching to req.user is the Express convention for "the authenticated user".
 * Controllers can then access req.user.userId, req.user.hostelId, etc. without
 * re-reading the token or hitting the database on every request.
 */

const { verifyToken } = require('../utils/jwt');

/**
 * Express middleware that verifies the JWT and attaches the user payload to req.
 */
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  // WHY CHECK FORMAT: Header must be "Bearer <token>", not just the token.
  // This is the OAuth 2.0 Bearer Token specification (RFC 6750).
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1]; // Extract token after "Bearer "

  try {
    // verifyToken() throws if the token is expired or has an invalid signature
    const decoded = verifyToken(token);

    // Attach the decoded payload so controllers can access req.user
    req.user = decoded;
    next();
  } catch (err) {
    // WHY SPECIFIC MESSAGES: Helps developers debug. In production you may
    // want to return the same generic message for both cases (security hardening).
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
}

module.exports = protect;
