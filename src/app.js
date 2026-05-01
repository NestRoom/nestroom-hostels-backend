const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");

const { errorHandler } = require("./middlewares/errorHandler");

const app = express();

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl)
      // Allow any localhost port for local development
      // Allow explicitly configured FRONTEND_URL for production
      const allowedOrigins = [
        "https://nestroom-hostels-web.vercel.app",
        process.env.FRONTEND_URL?.replace(/\/$/, "")
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, "")) || origin.startsWith("http://localhost")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── NoSQL Injection Prevention ───────────────────────────────────────────────
app.use((req, res, next) => {
  ['body', 'params', 'headers', 'query'].forEach((key) => {
    if (req[key]) {
      mongoSanitize.sanitize(req[key]);
    }
  });
  next();
});

// ─── HTTP Logging ─────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── Global Rate Limiter ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
});
app.use(globalLimiter);

// ─── Auth-specific Rate Limiter ───────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Increased to prevent lockout during development
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many auth attempts. Try again in 15 minutes." } },
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      service: "nestRoom Hostels API",
      version: "v1",
      status: "running",
      timestamp: new Date().toISOString(),
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, data: { status: "healthy", uptime: process.uptime() } });
});

// ─── API v1 Routes ────────────────────────────────────────────────────────────
// Auth routes (stricter rate limit)
app.use("/v1/auth", authLimiter, require("./routes/auth.routes"));

// Hostel management
app.use("/v1/hostels", require("./routes/hostel.routes"));

// Resident self-service
app.use("/v1/residents", require("./routes/resident.routes"));

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.originalUrl} not found` },
  });
});

// ─── Global Error Handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

module.exports = app;
