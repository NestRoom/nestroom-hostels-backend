/**
 * src/middleware/errorHandler.js
 *
 * WHY THIS FILE EXISTS:
 * Without a centralized error handler, every controller would need to handle
 * errors individually. When something goes wrong and a controller calls
 * `next(error)` (or asyncHandler catches a thrown error), Express looks for
 * a middleware with 4 arguments: (err, req, res, next). This is that middleware.
 *
 * HOW TO TRIGGER IT:
 * - From asyncHandler: any unhandled throw inside an async controller
 * - Explicitly: next(new Error('something failed'))
 * - Explicitly with status: const e = new Error('Not found'); e.statusCode = 404; next(e);
 *
 * WHY SEND JSON (not HTML):
 * This is a REST API. Clients are JavaScript applications (our Next.js frontend).
 * They expect JSON. Express's default error handler sends HTML — we override it.
 *
 * NODE_ENV LOGIC:
 * - In development: we include err.stack in the response so developers
 *   can see exactly where the error occurred.
 * - In production: we never expose the stack trace (information leakage risk).
 */

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;
  const isDev = process.env.NODE_ENV === 'development';

  console.error(`[Error] ${req.method} ${req.originalUrl} — ${err.message}`);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Only include stack trace in development — never in production
    ...(isDev && { stack: err.stack }),
  });
}

module.exports = errorHandler;
