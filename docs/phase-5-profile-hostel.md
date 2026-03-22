# Phase 5: Profile & Hostel API — Developer Notes

> **Status:** ✅ Complete and live-tested  
> **Base URL:** `http://localhost:5001`  
> All endpoints in this phase require `Authorization: Bearer <token>`

---

## Why these endpoints exist

The frontend **Profile page** needs two things simultaneously:
1. The admin's **personal info** (name, email, phone)
2. Their **hostel's details** (address, amenities, total rooms)

Rather than making the frontend fire two sequential requests (first `/auth/me`, then hostel info), `GET /api/profile` returns both in a single call — making the page load faster and simpler.

The **Hostel** endpoints exist separately because hostel info is also needed in other parts of the dashboard (room list headers, payment receipts, etc.) and should be independently updatable.

---

## Files Added

| File | Purpose |
|---|---|
| `src/controllers/profile.controller.js` | Business logic for GET and PUT profile |
| `src/controllers/hostel.controller.js` | Business logic for GET, PUT hostel + setup |
| `src/routes/profile.routes.js` | Maps `/api/profile` → controller |
| `src/routes/hostel.routes.js` | Maps `/api/hostels/*` → controller |

---

## Endpoints

### `GET /api/profile`
Returns the admin's personal info combined with their hostel info.

**Auth required:** ✅ Yes

```bash
curl http://localhost:5001/api/profile \
  -H "Authorization: Bearer <token>"
```

**Response `200`**
```json
{
  "success": true,
  "profile": {
    "user": {
      "id": "69c02c445fe4aba6aef7639a",
      "name": "Sourashis Roy",
      "email": "admin@nestroom.in",
      "phone": "+919876543210",
      "role": "admin",
      "hostelId": "69c02c445fe4aba6aef7639b",
      "photoURL": null,
      "lastLogin": "2026-03-22T18:12:13.612Z"
    },
    "hostel": {
      "id": "69c02c445fe4aba6aef7639b",
      "name": "NestRoom Bengaluru",
      "hostelId": "NR-1774201924715",
      "address": "12th Main, Indiranagar",
      "city": "Bengaluru",
      "state": "Karnataka",
      "totalRooms": 20,
      "amenities": ["Wi-Fi", "Laundry", "Mess"],
      "logo": null
    }
  }
}
```

> **Implementation note:** If the user has no hostel yet (Google SSO / WhatsApp OTP first-time login), the `hostel` field in the response is `null`. The frontend should detect `hostel === null` and show an onboarding screen.

---

### `PUT /api/profile`
Updates the admin's personal info. All fields are **optional** — only send what you want to change.

**Auth required:** ✅ Yes

```bash
curl -X PUT http://localhost:5001/api/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Sourashis Roy", "phone": "+919876543210"}'
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | ❌ | Non-empty if provided |
| `phone` | string | ❌ | E.164 format; unique across all users |

**Response `200`**
```json
{
  "success": true,
  "message": "Profile updated.",
  "user": { "...updated user object..." }
}
```

**Response `409` — Phone already in use**
```json
{
  "success": false,
  "message": "This phone number is already in use."
}
```

> **Implementation note:** The backend uses MongoDB's `$set` operator — only the fields sent in the request body are modified. Sending `{"name":"foo"}` will NOT overwrite the phone number.

---

### `GET /api/hostels/me`
Returns only the hostel document (without user info).

**Auth required:** ✅ Yes

```bash
curl http://localhost:5001/api/hostels/me \
  -H "Authorization: Bearer <token>"
```

**Response `200`**
```json
{
  "success": true,
  "hostel": {
    "id": "69c02c445fe4aba6aef7639b",
    "name": "NestRoom Bengaluru",
    "hostelId": "NR-1774201924715",
    "address": "12th Main, Indiranagar",
    "city": "Bengaluru",
    "state": "Karnataka",
    "totalRooms": 20,
    "amenities": ["Wi-Fi", "Laundry", "Mess"],
    "logo": null,
    "createdAt": "2026-03-22T17:52:04.715Z",
    "updatedAt": "2026-03-22T18:19:19.763Z"
  }
}
```

**Response `404` — No hostel linked yet**
```json
{
  "success": false,
  "message": "No hostel linked to your account. Please complete hostel setup."
}
```

---

### `PUT /api/hostels/me`
Updates hostel details. All fields are **optional**.

**Auth required:** ✅ Yes

```bash
curl -X PUT http://localhost:5001/api/hostels/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "12th Main, Indiranagar",
    "city": "Bengaluru",
    "state": "Karnataka",
    "totalRooms": 20,
    "amenities": ["Wi-Fi", "Laundry", "Mess", "Gym"]
  }'
```

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | ❌ | Non-empty if provided |
| `address` | string | ❌ | — |
| `city` | string | ❌ | — |
| `state` | string | ❌ | — |
| `totalRooms` | number | ❌ | Non-negative integer |
| `amenities` | string[] | ❌ | Array of strings |
| `logo` | string | ❌ | URL to logo image |

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
**One-time endpoint** for Google SSO and WhatsApp OTP users who logged in without going through the registration form. Creates a new hostel and links it to their account.

**Auth required:** ✅ Yes

```bash
curl -X POST http://localhost:5001/api/hostels/setup \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Hostel"}'
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

## Design Decisions

### Why partial updates ($set)?
We use MongoDB's `$set` operator for all PUT operations. This means:
- Sending `{"city":"Mumbai"}` only changes the city
- All other hostel fields remain exactly as they were
- The frontend can update one field at a time without re-sending the entire object

### Why is phone uniqueness checked manually?
MongoDB has a unique sparse index on `users.phone`. We could let MongoDB throw a duplicate key error and catch it. Instead, we check proactively and return `409` with a clear human message — better UX for the frontend.

### Why is hostelId auto-generated as `NR-{timestamp}`?
The `hostelId` field (e.g. `NR-1774201924715`) is a human-readable slug used in receipts and references. It is distinct from the MongoDB `_id` (ObjectId) used for DB joins. In production this could be a sequential counter like `NR-0001`.

---

## Live Test Results (2026-03-22)

| Test | Endpoint | Result |
|------|----------|--------|
| Combined profile GET | `GET /api/profile` | ✅ Returns user + hostel |
| Hostel only GET | `GET /api/hostels/me` | ✅ Returns hostel with updated fields |
| Update profile name | `PUT /api/profile` `{"name":"Sourashis Roy"}` | ✅ Name updated in MongoDB |
| Update hostel address | `PUT /api/hostels/me` `{"address":"...","totalRooms":20}` | ✅ Address and totalRooms updated |
