/**
 * src/utils/asyncHandler.js
 *
 * WHY THIS FILE EXISTS:
 * Express route handlers can be synchronous or asynchronous. If an async
 * function throws an error (or a promise rejects), Express does NOT catch
 * it automatically — it causes an "UnhandledPromiseRejection" crash or hangs.
 *
 * The traditional fix is wrapping every controller in try/catch:
 *   router.get('/rooms', async (req, res) => {
 *     try { ... } catch (err) { next(err); }
 *   });
 *
 * asyncHandler eliminates the boilerplate. Instead:
 *   router.get('/rooms', asyncHandler(async (req, res) => {
 *     // Any thrown error automatically calls next(err)
 *   }));
 *
 * HOW IT WORKS:
 * asyncHandler is a higher-order function — it takes a function (fn) and
 * returns a new function. The new function calls fn, and if the returned
 * promise rejects, it passes the error to Express's next() — which routes
 * it to our errorHandler middleware.
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
