# Profile & Hostel API Documentation

This document covers the endpoints for managing admin profiles and hostel details in the NestRoom backend.

---

## 1. Profile API
Base path: `/api/profile`

These endpoints allow the logged-in admin to view and update their personal information.

### `GET /api/profile`
Returns the logged-in admin's user data combined with their linked hostel details in a single response.

**Auth Required:** ✅ Yes (Bearer JWT)

**Sample Response (200 OK):**
```json
{
  "success": true,
  "profile": {
    "user": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d1",
      "name": "Sourashis Roy",
      "email": "admin@nestroom.in",
      "phone": "+919876543210",
      "role": "admin",
      "hostelId": "65f1a2b3c4d5e6f7a8b9c0d2",
      "photoURL": null,
      "lastLogin": "2026-03-24T10:33:59.000Z"
    },
    "hostel": {
      "id": "65f1a2b3c4d5e6f7a8b9c0d2",
      "name": "NestRoom Indiranagar",
      "hostelId": "NR-1711281234567",
      "address": "12th Main, Indiranagar",
      "city": "Bengaluru",
      "state": "Karnataka",
      "totalRooms": 20,
      "amenities": ["Wi-Fi", "Laundry", "Mess"],
      "logo": null,
      "createdAt": "2026-03-22T17:52:04.715Z"
    }
  }
}
```

### `PUT /api/profile`
Updates the admin's personal information.

**Auth Required:** ✅ Yes (Bearer JWT)

**Accepted Fields (all optional):**
- `name`: (string) New display name.
- `phone`: (string) New phone number in E.164 format.

**Sample Request:**
```json
{
  "name": "Sourashis G. Roy",
  "phone": "+919876543211"
}
```

**Sample Response (200 OK):**
```json
{
  "success": true,
  "message": "Profile updated.",
  "user": { ...updated user object... }
}
```

---

## 2. Hostel API
Base path: `/api/hostels`

These endpoints manage the hostel details linked to the admin's account.

### `GET /api/hostels/me`
Returns the full details of the hostel linked to the logged-in admin.

**Auth Required:** ✅ Yes (Bearer JWT)

**Sample Response (200 OK):**
```json
{
  "success": true,
  "hostel": {
    "id": "65f1a2b3c4d5e6f7a8b9c0d2",
    "name": "NestRoom Indiranagar",
    "hostelId": "NR-1711281234567",
    "address": "12th Main, Indiranagar",
    "city": "Bengaluru",
    "state": "Karnataka",
    "totalRooms": 20,
    "amenities": ["Wi-Fi", "Laundry", "Mess"],
    "logo": null,
    "createdAt": "2026-03-22T17:52:04.715Z",
    "updatedAt": "2026-03-24T10:33:59.000Z"
  }
}
```

### `PUT /api/hostels/me`
Updates the details of the admin's hostel.

**Auth Required:** ✅ Yes (Bearer JWT)

**Accepted Fields (all optional):**
- `name`: (string) Hostel name.
- `address`: (string) Street address.
- `city`: (string) City name.
- `state`: (string) State name.
- `totalRooms`: (number) Total bed capacity.
- `amenities`: (array of strings) List of amenities.
- `logo`: (string) URL to the hostel logo.

**Sample Request:**
```json
{
  "totalRooms": 25,
  "amenities": ["Wi-Fi", "Laundry", "Mess", "Gym"]
}
```

### `POST /api/hostels/setup`
Used for one-time setup by accounts created via Google SSO or WhatsApp OTP that don't yet have a hostel.

**Auth Required:** ✅ Yes (Bearer JWT)

**Required Fields:**
- `name`: (string) Name for the new hostel.

**Sample Response (201 Created):**
```json
{
  "success": true,
  "message": "Hostel created and linked to your account.",
  "token": "...", // New JWT containing the newly created hostelId
  "hostel": { ...newly created hostel object... }
}
```

---

## Technical Notes

- **Stale Tokens:** Since `hostelId` is stored in the JWT, users who just completed `POST /api/hostels/setup` will receive a new JWT in the response. The frontend should replace the old token with this new one.
- **Data Isolation:** All queries are performed based on the `userId` extracted from the JWT, ensuring admins can only access their own profile and their own hostel.
- **Partial Updates:** All `PUT` requests use MongoDB's `$set` operator, allowing for partial updates without overwriting unspecified fields.
