# Phase 6: Rooms API — Developer Notes

> **Status:** ✅ Complete and implementated
> **Base URL:** `http://localhost:5001/api/rooms`
> All endpoints in this phase require `Authorization: Bearer <token>`

---

## Overview

The Rooms API is responsible for managing the inventory of physical rooms within a hostel. Each room has a status (Occupied, Vacant, etc.), sharing type, and capacity.

Data is strictly isolated: an admin can only access rooms belonging to their own hostel (enforced by `hostelId` in the JWT).

---

## Endpoints

### `GET /api/rooms`
Returns all rooms for the admin's hostel with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by 'OCCUPIED', 'VACANT', etc.
- `sharing` (optional): Filter by '2-Sharing', etc.

**Response `200`**
```json
{
  "success": true,
  "count": 2,
  "rooms": [
    {
      "id": "...",
      "number": "101",
      "status": "OCCUPIED",
      "sharing": "2-Sharing",
      "capacity": 2,
      "maintenanceInfo": null,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### `GET /api/rooms/stats`
Returns aggregated room counts grouped by status.

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
Returns a single room's details and includes the **current residents** (Joined from the `residents` collection).

**Response `200`**
```json
{
  "success": true,
  "room": {
    "id": "...",
    "number": "101",
    "status": "OCCUPIED",
    "sharing": "2-Sharing",
    "capacity": 2,
    "maintenanceInfo": null,
    "residents": [
      { "id": "...", "name": "Rohan Gupta", "bed": "Bed A", "paymentStatus": "Paid" }
    ]
  }
}
```

---

### `POST /api/rooms`
Creates a new room. Room numbers must be unique within a single hostel.

**Request Body:**
```json
{
  "number": "204",
  "sharing": "4-Sharing",
  "capacity": 4,
  "status": "VACANT"
}
```

**Response `201`**
```json
{
  "success": true,
  "message": "Room created successfully.",
  "room": { ...newly created room... }
}
```

---

### `PUT /api/rooms/:id`
Updates room details. All fields are optional.

**Response `200`**
```json
{
  "success": true,
  "message": "Room updated.",
  "room": { ...updated room... }
}
```

---

### `DELETE /api/rooms/:id`
Deletes a room only if its status is **VACANT**. This is a safety measure to prevent orphaned resident records.

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

## Data Model (MongoDB)

### Collection: `rooms`
```js
{
  _id: ObjectId,
  hostelId: ObjectId,       // Index: 1
  number: String,           // Index: 1 (Composite)
  status: String,           // OCCUPIED | PARTIALLY VACANT | VACANT | MAINTENANCE
  sharing: String,          // e.g., "2-Sharing"
  capacity: Number,
  maintenanceInfo: String,
  createdAt: Date,
  updatedAt: Date
}
```
