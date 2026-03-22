/**
 * src/middleware/validate.js
 *
 * WHY THIS FILE EXISTS:
 * When a client sends a POST or PUT request, the body might be missing fields,
 * have wrong types, or contain malicious data. `express-validator` lets us
 * declare validation rules in routes, and this middleware checks if any rules
 * failed — and sends a 400 Bad Request response if they did.
 *
 * HOW express-validator WORKS:
 * 1. In routes, you declare an array of validator rules:
 *      body('email').isEmail().normalizeEmail()
 * 2. Those rules run before the controller but they don't stop execution.
 *    They accumulate errors in an internal store.
 * 3. THIS middleware calls validationResult(req) to read those accumulated errors.
 *    If there are errors, it returns 400 with details. Otherwise it calls next().
 *
 * USAGE IN A ROUTE:
 *   const { body } = require('express-validator');
 *   const validate = require('../middleware/validate');
 *
 *   router.post('/register',
 *     [
 *       body('email').isEmail().withMessage('Valid email required'),
 *       body('password').isLength({ min: 6 }).withMessage('Min 6 chars'),
 *     ],
 *     validate,           // ← this middleware checks the results
 *     asyncHandler(authController.register)
 *   );
 */

const { validationResult } = require('express-validator');

/**
 * Reads express-validator results and returns 400 if any validation failed.
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
}

module.exports = validate;
