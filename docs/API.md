# NestRoom Hostels — API Reference

**Base URL (Development):** `http://localhost:5001`  
**Base URL (Production):** `https://api.nestroom.in` *(to be configured)*  
**Content-Type:** All requests and responses use `application/json`  
**API Version:** v1

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Auth Endpoints](#2-auth-endpoints)
3. [Profile Endpoints](#3-profile-endpoints)
4. [Hostel Endpoints](#4-hostel-endpoints)
5. [Rooms Endpoints](#5-rooms-endpoints)
6. [Residents Endpoints](#6-residents-endpoints)
7. [Payments Endpoints](#7-payments-endpoints)
8. [Services Endpoints](#8-services-endpoints)
9. [Dashboard Endpoints](#9-dashboard-endpoints)
10. [Error Reference](#10-error-reference)

---

## 1. Authentication

All protected endpoints require a **Bearer JWT** in the `Authorization` header.

```
Authorization: Bearer <your_jwt_token>
```

### How to get a token
Call any of the login/register endpoints below. Every successful auth response includes a `token` field. Store this token in your frontend (e.g. `localStorage`) and attach it to every subsequent request.

### Token expiry
Tokens expire after **7 days** by default (configurable via `JWT_EXPIRES_IN` in `.env`). After expiry, the API returns `401 Token expired` and the user must log in again.

### Which endpoints need a token?
- ❌ **No token needed**: `/api/health`, all `/api/auth/*` endpoints
- ✅ **Token required**: Everything else

---

## 2. Auth Endpoints

### `GET /api/health`
Confirms the server and database are running. No auth required.

**Response `200`**
```json
{
  "success": true,
  "message": "NestRoom API is running 🏠"
}
```

---

### `POST /api/auth/register`
Creates a new admin account with email and password. Also creates the admin's hostel record.

**Auth required:** ❌ No

**Rate limit:** 10 requests / minute per IP

**Request body**
```json
{
  "name": "Vikram Singh",
  "hostelName": "NestRoom Bengaluru",
  "email": "vikram@nestroom.in",
  "password": "mypassword123"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | ✅ | Non-empty |
| `hostelName` | string | ✅ | Non-empty |
| `email` | string | ✅ | Valid email format |
| `password` | string | ✅ | Minimum 6 characters |

**Response `201` — Success**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "69c02c445fe4aba6aef7639a",
    "name": "Vikram Singh",
    "email": "vikram@nestroom.in",
    "phone": null,
    "role": "admin",
    "hostelId": "69c02c445fe4aba6aef7639b",
    "photoURL": null,
    "lastLogin": "2026-03-22T17:52:04.668Z"
  }
}
```

**Response `409` — Email already exists**
```json
{
  "success": false,
  "message": "An account with this email already exists."
}
```

---

### `POST /api/auth/login`
Logs in an existing admin using email and password.

**Auth required:** ❌ No

**Rate limit:** 10 requests / minute per IP

**Request body**
```json
{
  "email": "vikram@nestroom.in",
  "password": "mypassword123"
}
```

**Response `200` — Success**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "69c02c445fe4aba6aef7639a",
    "name": "Vikram Singh",
    "email": "vikram@nestroom.in",
    "phone": null,
    "role": "admin",
    "hostelId": "69c02c445fe4aba6aef7639b",
    "photoURL": null,
    "lastLogin": "2026-03-22T17:52:16.566Z"
  }
}
```

**Response `401` — Wrong credentials**
```json
{
  "success": false,
  "message": "Invalid email or password."
}
```

> **Note:** The error message is intentionally the same whether the email doesn't exist or the password is wrong. This prevents user enumeration attacks.

---

### `POST /api/auth/google`
Authenticates a user via Google Sign-In. The frontend handles the Google popup using Firebase SDK and obtains a Firebase ID Token. That token is sent here to be verified server-side, and our own JWT is issued.

**Auth required:** ❌ No

**Rate limit:** 10 requests / minute per IP

**Credentials required in `.env`:**
```
FIREBASE_PROJECT_ID=nestroom-hostels
FIREBASE_PRIVATE_KEY_ID=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@nestroom-hostels.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=...
```
> Get these from [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts → **Generate new private key**

**Request body**
```json
{
  "idToken": "<Firebase ID Token from client-side Google Sign-In>"
}
```

**Response `200` — Success**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "69c02c445fe4aba6aef7639a",
    "name": "Vikram Singh",
    "email": "vikram@gmail.com",
    "phone": null,
    "role": "admin",
    "hostelId": null,
    "photoURL": "https://lh3.googleusercontent.com/...",
    "lastLogin": "2026-03-22T17:55:00.000Z"
  }
}
```

> **Note:** `hostelId` may be `null` for first-time Google users. The frontend should redirect them to complete their hostel profile setup.

**Response `401` — Invalid Firebase token**
```json
{
  "success": false,
  "message": "Invalid Google token."
}
```

---

### `POST /api/auth/whatsapp/send-otp`
Sends a 6-digit OTP to the given phone number via WhatsApp using Meta's Cloud API.  
The OTP is valid for **5 minutes** and is single-use.

**Auth required:** ❌ No

**Rate limit:** 10 requests / minute per IP

**Credentials required in `.env`:**
```
META_WHATSAPP_API_VERSION=v21.0
META_PHONE_NUMBER_ID=<from Meta Business Manager → WhatsApp → API Setup>
META_WHATSAPP_TOKEN=<Permanent System User Token with whatsapp_business_messaging permission>
META_OTP_TEMPLATE_NAME=otp
META_TEMPLATE_LANGUAGE_CODE=en
```

**Request body**
```json
{
  "phone": "+919876543210"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `phone` | string | ✅ | E.164 format (e.g. `+919876543210`) |

**Response `200` — OTP sent**
```json
{
  "success": true,
  "message": "OTP sent to +919876543210 via WhatsApp",
  "expiresIn": "5 minutes"
}
```

> **Security note:** The OTP is never returned in the response. It is only delivered via WhatsApp.

---

### `POST /api/auth/whatsapp/verify-otp`
Verifies the OTP received via WhatsApp. On success, issues a JWT. The OTP session is deleted immediately — it cannot be reused.

**Auth required:** ❌ No

**Rate limit:** 10 requests / minute per IP

**Request body**
```json
{
  "phone": "+919876543210",
  "otp": "473821"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `phone` | string | ✅ | E.164 format |
| `otp` | string | ✅ | Exactly 6 numeric digits |

**Response `200` — Success**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "69c02c445fe4aba6aef7639a",
    "name": "Admin",
    "email": null,
    "phone": "+919876543210",
    "role": "admin",
    "hostelId": null,
    "photoURL": null,
    "lastLogin": "2026-03-22T17:58:00.000Z"
  }
}
```

**Response `400` — OTP not found**
```json
{
  "success": false,
  "message": "OTP not found. Please request a new one."
}
```

**Response `400` — OTP expired**
```json
{
  "success": false,
  "message": "OTP expired. Please request a new one."
}
```

**Response `400` — Wrong OTP**
```json
{
  "success": false,
  "message": "Invalid OTP."
}
```

---

### `GET /api/auth/me`
Returns the currently authenticated user's full profile from MongoDB.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "user": {
    "id": "69c02c445fe4aba6aef7639a",
    "name": "Vikram Singh",
    "email": "vikram@nestroom.in",
    "phone": null,
    "role": "admin",
    "hostelId": "69c02c445fe4aba6aef7639b",
    "photoURL": null,
    "lastLogin": "2026-03-22T17:52:16.566Z"
  }
}
```

---

## 3. Profile Endpoints

### `GET /api/profile`
Returns the logged-in admin's personal info + their linked hostel details in a single response.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "profile": {
    "user": {
      "id": "69c02c445fe4aba6aef7639a",
      "name": "Vikram Singh",
      "email": "vikram@nestroom.in",
      "phone": "+919876543210",
      "role": "admin",
      "photoURL": null
    },
    "hostel": {
      "id": "69c02c445fe4aba6aef7639b",
      "name": "NestRoom Bengaluru",
      "hostelId": "NR-1742659924668",
      "address": "12th Main, Indiranagar",
      "city": "Bengaluru",
      "state": "Karnataka",
      "totalRooms": 20,
      "amenities": ["Wi-Fi", "Laundry", "Mess"]
    }
  }
}
```

---

### `PUT /api/profile`
Updates the admin's personal information.

**Auth required:** ✅ Yes

**Request body** *(all fields optional — only send what you want to update)*
```json
{
  "name": "Vikram S.",
  "phone": "+919876543210"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Profile updated.",
  "user": { "...updated user object..." }
}
```

---

## 4. Hostel Endpoints

### `GET /api/hostels/me`
Returns the hostel linked to the logged-in admin.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "hostel": {
    "id": "69c02c445fe4aba6aef7639b",
    "name": "NestRoom Bengaluru",
    "hostelId": "NR-1742659924668",
    "address": "12th Main, Indiranagar",
    "city": "Bengaluru",
    "state": "Karnataka",
    "totalRooms": 20,
    "amenities": ["Wi-Fi", "Laundry", "Mess"],
    "logo": null
  }
}
```

---

### `PUT /api/hostels/me`
Updates hostel details. All fields are optional.

**Auth required:** ✅ Yes

**Request body** *(all fields optional)*
```json
{
  "name": "NestRoom Indiranagar",
  "address": "12th Main, Indiranagar, Bengaluru",
  "city": "Bengaluru",
  "state": "Karnataka",
  "totalRooms": 25,
  "amenities": ["Wi-Fi", "Laundry", "Mess", "Gym"],
  "logo": "https://cdn.nestroom.in/logos/nr-blr.png"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Hostel updated.",
  "hostel": { "...updated hostel object..." }
}
```

---

### `POST /api/hostels/setup`
**One-time endpoint** for Google SSO and WhatsApp OTP users who logged in without a hostel. Creates a new hostel and links it to their account.

**Auth required:** ✅ Yes

**Request body**
```json
{
  "name": "My Hostel"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | ✅ | Non-empty |

**Response `201`**
```json
{
  "success": true,
  "message": "Hostel created and linked to your account.",
  "hostel": {
    "id": "...",
    "name": "My Hostel",
    "hostelId": "NR-1774203200000",
    "address": "", "city": "", "state": "",
    "totalRooms": 0, "amenities": [], "logo": null
  }
}
```

**Response `409` — Hostel already exists**
```json
{
  "success": false,
  "message": "Your account already has a hostel. Use PUT /api/hostels/me to update it."
}
```

---

## 5. Rooms Endpoints

### `GET /api/rooms`
Returns all rooms for the logged-in admin's hostel. Supports filtering.

**Auth required:** ✅ Yes

**Query parameters**

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `status` | string | `VACANT` | Filter by status: `OCCUPIED`, `PARTIALLY VACANT`, `VACANT`, `MAINTENANCE` |
| `sharing` | string | `2-Sharing` | Filter by sharing type |

**Example request**
```
GET /api/rooms?status=VACANT&sharing=2-Sharing
```

**Response `200`**
```json
{
  "success": true,
  "count": 2,
  "rooms": [
    {
      "id": "69c01a...",
      "number": "103",
      "status": "VACANT",
      "sharing": "2-Sharing",
      "capacity": 2,
      "maintenanceInfo": null,
      "createdAt": "2026-03-24T18:00:00.000Z",
      "updatedAt": "2026-03-24T18:00:00.000Z"
    }
  ]
}
```

---

### `GET /api/rooms/stats`
Returns aggregated counts of rooms grouped by status.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "stats": {
    "total": 20,
    "occupied": 12,
    "partiallyVacant": 3,
    "vacant": 4,
    "maintenance": 1
  }
}
```

---

### `GET /api/rooms/:id`
Returns a single room with its list of current residents (Joined from `residents` collection).

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "room": {
    "id": "69c01a...",
    "number": "101",
    "status": "OCCUPIED",
    "sharing": "2-Sharing",
    "capacity": 2,
    "maintenanceInfo": null,
    "residents": [
      { "id": "69c03b...", "name": "Rohan Gupta", "bed": "Bed A", "paymentStatus": "Paid" }
    ]
  }
}
```

---

### `POST /api/rooms`
Creates a new room in the admin's hostel.

**Auth required:** ✅ Yes

**Request body**
```json
{
  "number": "204",
  "sharing": "4-Sharing",
  "capacity": 4,
  "status": "VACANT"
}
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `number` | string | ✅ | Must be unique within the hostel |
| `sharing` | string | ✅ | e.g. `"2-Sharing"`, `"4-Sharing"` |
| `capacity` | number | ✅ | Positive integer |
| `status` | string | ❌ | Defaults to `VACANT` |

**Response `201`**
```json
{
  "success": true,
  "message": "Room created successfully.",
  "room": { "id": "69c01a...", "number": "204", "status": "VACANT", "..." }
}
```

---

### `PUT /api/rooms/:id`
Updates a room's details (status, capacity, maintenance info, etc.). Only the fields provided in the body are updated.

**Auth required:** ✅ Yes

**Request body** *(all fields optional)*
```json
{
  "status": "MAINTENANCE",
  "maintenanceInfo": "Leaky tap fixing in progress"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Room updated.",
  "room": { "...updated room object..." }
}
```

---

### `DELETE /api/rooms/:id`
Deletes a room only if its status is **VACANT**.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "message": "Room deleted successfully."
}
```

**Response `400` — Room not vacant**
```json
{
  "success": false,
  "message": "Cannot delete a room that is not vacant. Please vacate the residents first."
}
```

---

## 6. Residents Endpoints

### `GET /api/residents`
Returns all residents for the admin's hostel. Supports filtering.

**Auth required:** ✅ Yes

**Query parameters**

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `status` | string | `Active` | Filter by status: `Active`, `Notice`, `New` |
| `paymentStatus` | string | `Overdue` | Filter by payment status: `Paid`, `Overdue`, `Partial`, `Pending` |
| `roomId` | string | `69c01a...` | Filter by room MongoDB ID |

**Response `200`**
```json
{
  "success": true,
  "count": 5,
  "residents": [
    {
      "id": "69c03b...",
      "name": "Anjali Rao",
      "phone": "+919876543210",
      "email": "anjali@example.com",
      "roomId": "69c01a...",
      "bed": "Bed A",
      "joinDate": "2024-01-12T00:00:00.000Z",
      "status": "Active",
      "paymentStatus": "Paid",
      "avatarUrl": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### `GET /api/residents/stats`
Returns resident counts grouped by status.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "stats": {
    "total": 18,
    "active": 14,
    "notice": 3,
    "new": 1
  }
}
```

---

### `GET /api/residents/:id`
Returns a single resident's full document details.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "resident": {
    "id": "69c03b...",
    "name": "Anjali Rao",
    "phone": "+919876543210",
    "email": "anjali@example.com",
    "roomId": "69c01a...",
    "bed": "Bed A",
    "joinDate": "2024-01-12T00:00:00.000Z",
    "status": "Active",
    "paymentStatus": "Paid",
    "avatarUrl": null,
    "emergencyContact": "+919000000001",
    "aadharNo": "XXXX-XXXX-1234",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### `POST /api/residents`
Adds a new resident and assigns them to a bed in a room.

**Auth required:** ✅ Yes

**Request body**
```json
{
  "name": "Siddharth Malhotra",
  "phone": "+919823100982",
  "email": "sid@example.com",
  "roomId": "69c01a...",
  "bed": "Bed C",
  "joinDate": "2024-02-05",
  "emergencyContact": "+919000000002",
  "aadharNo": "1234-5678-9012"
}
```

**Response `201`**
```json
{
  "success": true,
  "message": "Resident added successfully and room occupancy updated.",
  "resident": { "id": "69c03b...", "name": "Siddharth Malhotra", "..." }
}
```

---

### `PUT /api/residents/:id`
Updates a resident's details or status. All fields are optional.

**Auth required:** ✅ Yes

**Request body** *(all fields optional)*
```json
{
  "status": "Notice",
  "paymentStatus": "Overdue"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Resident updated.",
  "resident": { "...updated resident object..." }
}
```

---

### `DELETE /api/residents/:id`
Removes a resident and vacates their bed (automatic room update).

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "message": "Resident deleted successfully and bed vacated."
}
```

---

## 7. Payments Endpoints

### `GET /api/payments`
Returns all payment records for the admin's hostel. Supports filtering by status, method, and date range.

**Auth required:** ✅ Yes

**Query parameters**

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `status` | string | `Pending` | `Successful`, `Pending`, `Failed` |
| `method` | string | `UPI` | `UPI`, `Cash`, `Transfer` |
| `from` | string | `2024-01-01` | Start date (ISO format) |
| `to` | string | `2024-03-31` | End date (ISO format) |

**Response `200`**
```json
{
  "success": true,
  "count": 4,
  "payments": [
    {
      "id": "69c05f...",
      "residentId": "69c03b...",
      "roomId": "69c01a...",
      "amount": 12500,
      "method": "UPI",
      "date": "2023-10-12T07:15:00.000Z",
      "dueDate": null,
      "status": "Successful",
      "type": "Rent",
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### `GET /api/payments/stats`
Returns summary statistics for the payments dashboard.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "stats": {
    "totalCollected": 842500,
    "totalDues": 112000,
    "upcomingRenewals": 24,
    "overdueResidents": 8
  }
}
```

---

### `GET /api/payments/revenue-chart`
Returns monthly revenue totals for the current year.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "data": [
    { "month": "Jan", "revenue": 210000 },
    { "month": "Feb", "revenue": 380000 }
  ]
}
```

---

### `GET /api/payments/disputes`
Returns payments with status `Failed` (failed/unregistered transactions).

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "count": 3,
  "disputes": [ { "...payment objects with status Failed..." } ]
}
```

---

### `GET /api/payments/:id`
Returns a single payment record.

**Auth required:** ✅ Yes

---

### `POST /api/payments`
Records a new payment transaction.

**Auth required:** ✅ Yes

**Request body**
```json
{
  "residentId": "69c03b...",
  "roomId": "69c01a...",
  "amount": 12500,
  "method": "UPI",
  "date": "2024-03-22",
  "dueDate": "2024-04-22",
  "type": "Rent",
  "status": "Successful"
}
```

**Response `201`**
```json
{
  "success": true,
  "message": "Payment recorded successfully.",
  "payment": { "id": "69c05f...", "amount": 12500, "..." }
}
```

---

### `PUT /api/payments/:id`
Updates a payment's status (e.g. from `Pending` to `Successful` after manual verification).

**Auth required:** ✅ Yes

**Request body**
```json
{
  "status": "Successful"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Payment marked as Successful.",
  "payment": { "...updated payment object..." }
}
```

---

## 8. Services Endpoints

### `GET /api/services/tickets`
Returns all service tickets (complaints/maintenance) for the admin's hostel.

**Auth required:** ✅ Yes

**Query parameters**

| Param | Type | Example | Description |
|-------|------|---------|-------------|
| `status` | string | `Pending` | `Pending`, `In Progress`, `Resolved`, `Closed` |

**Response `200`**
```json
{
  "success": true,
  "count": 2,
  "tickets": [
    {
      "id": "69c07a...",
      "ticketId": "T-1002",
      "residentId": "69c03b...",
      "roomId": "69c01a...",
      "category": "Plumbing",
      "title": "Leaky tap in bathroom",
      "description": "The bathroom tap has been dripping continuously since last night.",
      "priority": "Medium",
      "status": "In Progress",
      "createdAt": "...",
      "resolvedAt": null,
      "updatedAt": "..."
    }
  ]
}
```

---

### `GET /api/services/stats`
Returns organizational metrics for the maintenance department.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "stats": {
    "openTickets": 12,
    "averageResolutionTimeHours": 4.5
  }
}
```

---

### `GET /api/services/tickets/:id`
Returns a single service ticket's details.

**Auth required:** ✅ Yes

---

### `POST /api/services/tickets`
Creates a new service ticket. Sequential IDs (e.g. `T-1003`) are auto-generated.

**Auth required:** ✅ Yes

**Request body**
```json
{
  "residentId": "69c03b...",
  "roomId": "69c01a...",
  "category": "Plumbing",
  "title": "Leaky tap in bathroom",
  "description": "The bathroom tap has been dripping continuously.",
  "priority": "Medium"
}
```

**Response `201`**
```json
{
  "success": true,
  "message": "Ticket created successfully.",
  "ticket": { "id": "69c07a...", "ticketId": "T-1003", "..." }
}
```

---

### `PUT /api/services/tickets/:id`
Updates a ticket's status or priority. If status is set to `Resolved`, the `resolvedAt` timestamp is automatically recorded.

**Auth required:** ✅ Yes

**Request body** *(all fields optional)*
```json
{
  "status": "Resolved",
  "priority": "Low"
}
```

**Response `200`**
```json
{
  "success": true,
  "message": "Ticket updated to Resolved.",
  "ticket": { "...updated ticket object..." }
}
```

---

### `DELETE /api/services/tickets/:id`
Deletes a ticket record from the database.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "message": "Ticket deleted successfully."
}
```

---

## 9. Dashboard Endpoints

### `GET /api/dashboard/stats`
Returns a combined summary of all key metrics for the dashboard homepage. This is a single aggregated call so the frontend doesn't need to make 5 separate requests.

**Auth required:** ✅ Yes

**Response `200`**
```json
{
  "success": true,
  "stats": {
    "rooms": {
      "total": 20,
      "occupied": 12,
      "vacant": 5,
      "maintenance": 1
    },
    "residents": {
      "total": 18,
      "active": 14,
      "onNotice": 3
    },
    "payments": {
      "collectedThisMonth": 420000,
      "pendingDues": 112000,
      "overdueCount": 8
    },
    "services": {
      "openTickets": 14
    }
  }
}
```

---

## 10. Error Reference

All error responses follow this shape:
```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

Validation errors also include an `errors` array:
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email is required" },
    { "field": "password", "message": "Password must be at least 6 characters" }
  ]
}
```

### HTTP Status Code Reference

| Code | Meaning | When it happens |
|------|---------|-----------------|
| `200` | OK | Successful GET / PUT |
| `201` | Created | Successful POST (new resource created) |
| `400` | Bad Request | Validation failed, OTP invalid/expired |
| `401` | Unauthorized | No token, expired token, wrong credentials |
| `403` | Forbidden | Valid token but insufficient permissions |
| `404` | Not Found | Resource with given ID doesn't exist |
| `409` | Conflict | Duplicate (e.g. email already registered) |
| `429` | Too Many Requests | Rate limit exceeded (10 req/min on auth routes) |
| `500` | Internal Server Error | Unhandled server error |

---

## Quick Start — Testing the API

### 1. Register
```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Admin","hostelName":"My Hostel","email":"admin@test.com","password":"secret123"}'
```

### 2. Log in and save the token
```bash
TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"secret123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 3. Use the token on protected routes
```bash
curl http://localhost:5001/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:5001/api/rooms \
  -H "Authorization: Bearer $TOKEN"
```
