# NestRoom Hostels — Backend Architecture & Developer Guide

> **Purpose of this file**: This document explains *why* every decision in this backend was made. It is not just a "how" — it is a "why". Every developer reading this should understand the reasoning behind every choice.

---

## Table of Contents
1. [Tech Stack & Why](#1-tech-stack--why)
2. [Authentication Architecture](#2-authentication-architecture)
3. [Database — Why Native MongoDB Driver](#3-database--why-native-mongodb-driver)
4. [MongoDB Atlas Setup](#4-mongodb-atlas-setup)
5. [Project Folder Structure](#5-project-folder-structure)
6. [Environment Variables](#6-environment-variables)
7. [Collection Schemas](#7-collection-schemas)
8. [API Design Decisions](#8-api-design-decisions)
9. [Security Decisions](#9-security-decisions)

---

## 1. Tech Stack & Why

| Technology | Why we chose it |
|---|---|
| **Node.js** | Same language as the Next.js frontend. No context switch for developers. Well-suited for I/O-heavy workloads (DB reads, API calls). |
| **Express.js** | Minimal, unopinionated, and widely understood. Gives us full control over middleware, routing, and error handling. |
| **MongoDB** | Hostel data (rooms, residents, payments) is naturally document-shaped — each hostel's data is largely self-contained. MongoDB's flexible schema allows rapid iteration as the product evolves. |
| **Native `mongodb` driver** | We deliberately avoided Mongoose (ODM/ORM layer). Mongoose adds schema validation, virtuals, and middleware that are useful in large codebases but add abstraction overhead. Since we are starting fresh and control the shape of data entirely through `express-validator` in the API layer, the native driver is simpler, faster, and gives us direct access to MongoDB's full query capabilities. |
| **Firebase Admin SDK** | Only for verifying Google SSO tokens. Firebase handles the complex OAuth 2.0 flow with Google on the frontend. We verify the resulting ID token server-side to ensure it was not tampered with. |
| **bcryptjs** | Industry-standard for hashing passwords. Uses the bcrypt algorithm with a configurable salt rounds value. We hash OTPs too — so even if someone reads your database, they can never recover an OTP. |
| **jsonwebtoken (JWT)** | After verifying any auth method (Google, email, WhatsApp OTP), we issue our own JWT. This is the only token the frontend needs to communicate with our backend — it decouples authentication from Firebase entirely for all API calls. |
| **axios** | HTTP client used to call Meta's WhatsApp Cloud API. Cleaner syntax than raw `fetch` for JSON API calls, and it handles response error status codes more predictably. |

---

## 2. Authentication Architecture

### Why this hybrid approach?

We use Firebase only for Google SSO because:
- Google OAuth 2.0 involves multiple redirect flows and token exchanges that Firebase handles perfectly
- Replicating this from scratch would require significant OAuth infrastructure maintenance
- Firebase's ID tokens are cryptographically signed and easily verifiable via `firebase-admin`

For **email/password** and **WhatsApp OTP**, we do NOT use Firebase because:
- Firebase charges per active user at scale
- We have no need for Firebase's realtime auth state sync on the backend
- Our own JWT + MongoDB gives us full control over session lifecycle, claims, and expiry

### Auth Flow Diagram

```
GOOGLE SSO:
  Browser → Firebase SDK (Google popup) → Firebase ID Token
         → POST /api/auth/google (sends token in body)
         → Backend: firebase-admin.verifyIdToken()
         → Upsert user in MongoDB users collection
         → Issue our JWT → return to frontend
         → From here, frontend uses only our JWT

EMAIL/PASSWORD:
  POST /api/auth/register → bcrypt.hash(password) → insert user
  POST /api/auth/login    → bcrypt.compare()       → issue JWT

WHATSAPP OTP:
  POST /api/auth/whatsapp/send-otp
    → generate 6-digit OTP
    → bcrypt.hash(OTP)
    → store { phone, otpHash, expiresAt: now+5min } in otp_sessions
    → axios.post(Meta Cloud API) with OTP authentication template
  POST /api/auth/whatsapp/verify-otp
    → find otp_sessions doc by phone
    → check expiresAt > now
    → bcrypt.compare(submittedOtp, otpHash)
    → delete otp_sessions doc (one-time use)
    → upsert user in users collection
    → issue JWT
```

### The Firebase ↔ MongoDB Mutual Reference

The `users` MongoDB collection has a nullable field `googleUid` (Firebase's UID string).

- For Google SSO users: `googleUid` is set, `passwordHash` is `null`
- For email/password users: `googleUid` is `null`, `passwordHash` is set
- For WhatsApp OTP users: `googleUid` is `null`, `passwordHash` is `null`

If the same person signs in via Google AND registers by email (same email address), we detect the collision and link both methods to the same MongoDB document.

---

## 3. Database — Why Native MongoDB Driver

We use `mongodb` (the official Node.js driver) **without** Mongoose for the following reasons:

1. **No schema lock-in at the DB layer**: We enforce data shape at the API boundary via `express-validator`. MongoDB's schema-free nature is a feature, not a bug. We can add new fields to documents without running migrations.

2. **Direct aggregation pipeline access**: The dashboard requires aggregations (monthly revenue totals, status counts). MongoDB's aggregation pipeline is more naturally expressed in the native driver than through Mongoose's abstraction.

3. **Single `getDb()` pattern**: We connect once at startup and export a `getDb()` helper. Controllers call `getDb().collection('rooms').find(...)` directly — this is clean, predictable, and requires no model registration.

4. **Fewer abstractions = easier to understand**: Since this codebase is meant to be deeply understood by its team, we avoid layers that hide what is actually happening.

### How the DB connection works

```
server.js
  → calls connectDb() from config/db.js
  → MongoClient.connect(MONGODB_URI)
  → stores the connected client in a module-level variable
  → app.js registers all routes AFTER connection is established

Any controller:
  → import { getDb } from '../config/db.js'
  → const db = getDb()
  → db.collection('rooms').find({ hostelId }).toArray()
```

---

## 4. MongoDB Atlas Setup

Atlas is MongoDB's fully managed cloud database. We use it instead of running MongoDB locally for the following reasons:
- No local installation or maintenance
- Free M0 tier is sufficient for development and early production
- Built-in backups, monitoring, and connection management
- Accessible from any machine — frontend and backend developers share the same dev database

### Steps (one-time setup)
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) → Sign up
2. Create a cluster: **M0 Free** → Provider: **AWS** → Region: **Mumbai (ap-south-1)**
3. Name: `nestroom-cluster`
4. Create DB user: username `nestroom-admin`, strong password (copy it!)
5. Network Access: Add IP `0.0.0.0/0` for development
6. Connect → Drivers → Node.js → Copy the URI
7. Replace `<password>` and append `/nestroom` before `?`: `.../nestroom?retryWrites=...`
8. Paste into `MONGODB_URI` in your `.env`

---

## 5. Project Folder Structure

```
src/
├── server.js          # Starts the HTTP server. Only job: call connectDb(), then start Express.
├── app.js             # Configures Express: CORS, security headers, body parsing, all routes.
├── config/
│   ├── db.js          # MongoClient singleton. Exports connectDb() and getDb().
│   └── firebase.js    # Firebase Admin SDK. Exports admin.auth() for token verification.
├── middleware/
│   ├── auth.js        # Reads JWT from Authorization header. Verifies it. Attaches req.user.
│   ├── errorHandler.js# Last Express middleware. Catches anything thrown in controllers.
│   └── validate.js    # Runs express-validator checks. Returns 400 if any fail.
├── routes/            # Thin layer. Maps HTTP method + path → controller function.
├── controllers/       # Business logic. Reads req, calls DB, returns res.
└── utils/
    ├── asyncHandler.js # Wraps async controller fns so unhandled rejections go to errorHandler.
    ├── jwt.js          # signToken(payload), verifyToken(token) — hides JWT implementation.
    ├── generateOtp.js  # Cryptographically random 6-digit OTP using crypto.randomInt().
    └── whatsapp.js     # sendWhatsAppOtp(phone, otp) — sends via Meta Cloud API.
```

**Why this structure?**
- **Routes are separate from controllers**: Routes only declare what URL maps to what function. Controllers contain the actual logic. This separation makes testing and reading individual features much easier.
- **Middleware is centralized**: Auth checking, validation, and error handling are in one place. Adding them to a new route is a one-liner.
- **Utils are pure functions**: No dependencies on Express or MongoDB. Easy to unit test.

---

## 6. Environment Variables

All configuration is injected through environment variables. This means:
- The same code runs in development (local) and production (server) with different configs
- Secrets (API keys, passwords) are never committed to Git

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | Full Atlas connection string including database name |
| `JWT_SECRET` | Random secret used to sign/verify all JWTs. Must be long and random. |
| `FIREBASE_*` | Service account credentials for Firebase Admin SDK |
| `META_PHONE_NUMBER_ID` | The specific phone number in your WhatsApp Business account |
| `META_WHATSAPP_TOKEN` | Permanent system user token from Meta Business Manager |
| `META_OTP_TEMPLATE_NAME` | The name of your approved OTP template in WhatsApp Manager |

---

## 7. Collection Schemas

Shapes are not enforced by MongoDB — they are enforced by our API validators. Always add `express-validator` rules when adding new POST/PUT endpoints.

### `users`
```js
{
  _id: ObjectId,        // Auto-generated by MongoDB
  googleUid: String,    // Firebase UID (null for non-Google users)
  name: String,
  email: String,        // Unique index
  phone: String,        // Unique index (null until set)
  passwordHash: String, // bcrypt hash (null for OAuth/OTP users)
  role: 'admin',
  hostelId: ObjectId,   // Reference to hostels._id
  photoURL: String,
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### `otp_sessions` (TTL — auto-deleted by MongoDB after expiry)
```js
{
  _id: ObjectId,
  phone: String,
  otpHash: String,      // bcrypt hash of the OTP — never stored plain
  expiresAt: Date,      // MongoDB TTL index on this field (expires after 5 min)
  createdAt: Date
}
```

### `hostels`
```js
{
  _id: ObjectId,
  name: String,
  hostelId: String,     // Human-readable slug, e.g. "NR-BLR-001" — unique
  address: String,
  city: String, state: String,
  adminUserId: ObjectId,
  totalRooms: Number,
  amenities: [String],
  logo: String,
  createdAt: Date, updatedAt: Date
}
```

### `rooms`
```js
{
  _id: ObjectId,
  hostelId: ObjectId,
  number: String,                       // e.g. "101"
  status: String,                       // OCCUPIED | PARTIALLY VACANT | VACANT | MAINTENANCE
  sharing: String,                      // "2-Sharing" | "4-Sharing"
  capacity: Number,
  maintenanceInfo: String,
  createdAt: Date, updatedAt: Date
}
// Compound unique index: { hostelId: 1, number: 1 }
```

### `residents`
```js
{
  _id: ObjectId,
  hostelId: ObjectId, roomId: ObjectId,
  name: String, phone: String, email: String,
  bed: String,
  joinDate: Date,
  status: String,        // Active | Notice | New
  paymentStatus: String, // Paid | Overdue | Partial
  avatarUrl: String,
  emergencyContact: String,
  aadharNo: String,
  createdAt: Date, updatedAt: Date
}
```

### `payments`
```js
{
  _id: ObjectId,
  hostelId: ObjectId, residentId: ObjectId, roomId: ObjectId,
  amount: Number,        // in INR (full rupees)
  method: String,        // UPI | Cash | Transfer
  date: Date, dueDate: Date,
  status: String,        // Successful | Pending | Failed
  type: String,          // Rent | Service
  createdAt: Date, updatedAt: Date
}
```

### `service_tickets`
```js
{
  _id: ObjectId,
  hostelId: ObjectId, residentId: ObjectId,
  ticketId: String,      // e.g. "SR-1024" — auto-generated
  service: String,       // Wi-Fi | Laundry | Mess | Plumbing | ...
  description: String,
  status: String,        // PENDING | IN-PROGRESS | RESOLVED
  createdAt: Date,
  resolvedAt: Date       // null until status becomes RESOLVED
}
```

---

## 8. API Design Decisions

- **All routes are scoped to `hostelId`**: Every DB query includes `{ hostelId: req.user.hostelId }` as a filter. This ensures one hostel's admin can never see another hostel's data.
- **Specific routes before parameterized routes**: `GET /api/rooms/stats` is registered before `GET /api/rooms/:id` — otherwise Express would match `stats` as an `:id` parameter.
- **Aggregation for statistics**: Dashboard and summary endpoints use MongoDB's aggregation pipeline (`.aggregate([...])`) rather than loading all documents and computing in JavaScript.

---

## 9. Security Decisions

| Concern | Solution |
|---|---|
| Password storage | `bcryptjs` with 12 salt rounds — computationally expensive to brute-force |
| OTP storage | OTPs are hashed with bcryptjs before storage — a DB leak never exposes OTPs |
| OTP expiry | TTL index + `expiresAt` check — OTPs auto-delete and are rejected if expired |
| JWT falsification | `JWT_SECRET` signs tokens — tampered tokens fail `jwt.verify()` |
| Rate limiting | `express-rate-limit` on all auth endpoints — max 10 requests/min per IP |
| Data isolation | All queries scoped to `req.user.hostelId` — multi-tenant isolation |
| HTTPS headers | `helmet` adds CSP, HSTS, and other security headers automatically |
