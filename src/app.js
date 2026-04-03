/**
 * src/app.js
 *
 * WHY THIS FILE EXISTS:
 * We separate the Express app configuration (app.js) from the HTTP server
 * startup (server.js). This separation matters because:
 * 1. Tests can import `app` without starting a real server
 * 2. server.js can handle non-Express concerns (DB connection, graceful shutdown)
 *    while app.js purely configures Express
 *
 * ORDER OF MIDDLEWARE MATTERS:
 * Express middleware runs in the order it is registered. The order below is:
 *   security headers → cors → request logging → body parsing → routes → error handler
 * The error handler MUST be last because it handles errors thrown by routes.
 */

require('dotenv').config(); // WHY FIRST: All other requires may need env vars
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');
const { connectDb } = require('./config/db');
const { initFirebase } = require('./config/firebase');

// --- Route imports (we'll add these as we build each feature) ---
const authRoutes    = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const hostelRoutes  = require('./routes/hostel.routes');
const roomRoutes      = require('./routes/room.routes');
const residentRoutes  = require('./routes/resident.routes');
const paymentRoutes   = require('./routes/payment.routes');
const serviceRoutes   = require('./routes/service.routes');
const dashboardRoutes = require('./routes/dashboard.routes'); 

const app = express();

// -------------------------------------------------------------------
// 0. SERVERLESS INITIALIZATION
// WHY: When deployed locally, server.js handles DB/Firebase initialization.
// In Serverless environments like Vercel, server.js is bypassed and Vercel
// invokes app.js directly. This middleware guarantees they are initialized.
// -------------------------------------------------------------------
app.use(async (req, res, next) => {
  try {
    await connectDb();
    try {
      initFirebase();
    } catch (firebaseErr) {
      console.warn('⚠️  Firebase Admin not initialized (Google SSO unavailable):', firebaseErr.message);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------------
// 1. SECURITY HEADERS (helmet)
// WHY: Browsers have many attack surfaces (clickjacking, MIME sniffing,
// XSS via scripts, etc.). Helmet adds ~14 HTTP response headers that
// instruct browsers to be more restrictive. This is a one-liner that
// protects against a whole category of common web vulnerabilities.
// -------------------------------------------------------------------
app.use(helmet());

// -------------------------------------------------------------------
// 2. CORS (Cross-Origin Resource Sharing)
// WHY: Our frontend runs on localhost:3000 (dev) or nestroom.in (prod).
// Our backend runs on localhost:5000. By default, browsers BLOCK requests
// from one origin (port 3000) to another (port 5000). CORS configures the
// browser to allow these requests, but ONLY from our trusted frontend URL.
// -------------------------------------------------------------------
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true, // Allow cookies/Authorization headers
}));

// -------------------------------------------------------------------
// 3. REQUEST LOGGING (morgan)
// WHY: During development, it is invaluable to see every HTTP request
// printed in the terminal: method, path, status code, and timing.
// In production we'd use 'combined' format (Apache-style detailed logs).
// -------------------------------------------------------------------
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// -------------------------------------------------------------------
// 4. BODY PARSING
// WHY: HTTP request bodies arrive as raw bytes. Express needs to parse
// them into JavaScript objects (req.body). express.json() handles
// Content-Type: application/json requests (all our API calls).
// The limit prevents extremely large payloads from crashing the server.
// -------------------------------------------------------------------
app.use(express.json({ limit: '10kb' }));

// -------------------------------------------------------------------
// 5. GLOBAL RATE LIMITER
// WHY: Prevents denial-of-service attacks and general API abuse.
// Here we set a broad limit of 100 requests per 15 min per IP.
// Auth routes additionally have their own stricter limits (see auth.routes.js).
// -------------------------------------------------------------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,    // Include rate limit info in response headers
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api', globalLimiter);

// -------------------------------------------------------------------
// 6. HEALTH CHECK
// WHY: A simple endpoint that returns 200 OK. Used by deployment platforms
// (e.g., Railway, Render) to confirm the server is alive. Also useful for
// manual testing: `curl http://localhost:5000/api/health`
// -------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'NestRoom API is running 🏠' });
});

// -------------------------------------------------------------------
// 7. ROUTES
// Each feature gets its own router. The prefix (/api/auth, /api/rooms, etc.)
// is defined here so the route files only define their relative paths
// (e.g. '/' for GET all, '/:id' for GET one).
// -------------------------------------------------------------------
app.use('/api/auth',    authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/hostels', hostelRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/residents', residentRoutes);
app.use('/api/payments',  paymentRoutes);
app.use('/api/services',  serviceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// -------------------------------------------------------------------
// 8. 404 HANDLER
// WHY: If a request reaches here, no route matched. We return a clean
// JSON 404 rather than Express's default HTML "Cannot GET /path".
// -------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// -------------------------------------------------------------------
// 9. GLOBAL ERROR HANDLER (must be LAST)
// WHY LAST: Express identifies 4-argument middleware as error handlers.
// It must be registered after all routes so it can catch errors from them.
// -------------------------------------------------------------------
app.use(errorHandler);

module.exports = app;
