# Phase 7: Residents API — Developer Notes

> **Status:** ✅ Complete and implemented
> **Base URL:** `http://localhost:5001/api/residents`
> All endpoints in this phase require `Authorization: Bearer <token>`

---

## Overview

The Residents API handles the profiles, occupancy data, and stay status of the hostel's inhabitants. 

**Key Feature - Automatic Room Updates:** This API is tightly integrated with the Rooms API. When a resident is added (`POST`), removed (`DELETE`), or moved (`PUT` with different `roomId`), the corresponding room's status (`VACANT`, `PARTIALLY VACANT`, or `OCCUPIED`) is automatically re-calculated and updated in the database.

---

## Endpoints

### `GET /api/residents`
Returns all residents for the admin's hostel with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by 'Active', 'Notice', or 'New'.
- `paymentStatus` (optional): Filter by 'Paid', 'Overdue', 'Partial', or 'Pending'.
- `roomId` (optional): Filter by a specific room ID.

**Response `200`**
```json
{
  "success": true,
  "count": 5,
  "residents": [
    {
      "id": "...",
      "name": "Anjali Rao",
      "phone": "+919876543210",
      "email": "anjali@example.com",
      "roomId": "...",
      "bed": "Bed A",
      "joinDate": "...",
      "status": "Active",
      "paymentStatus": "Paid"
    }
  ]
}
```

---

### `GET /api/residents/stats`
Returns aggregated resident counts grouped by status.

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
Returns a single resident's full profile details (Aadhar, emergency contact, etc.).

---

### `POST /api/residents`
Adds a new resident and assigns them to a bed.

**Side Effects:**
1. Verifies if the selected room has available capacity.
2. Updates the room's status (e.g., from `VACANT` to `PARTIALLY VACANT`).
3. Defaults `status` to `New` and `paymentStatus` to `Pending`.

---

### `PUT /api/residents/:id`
Updates resident details.

**Special Logic:** 
If the `roomId` is changed, the backend will automatically update the status for both the **old room** and the **new room**.

---

### `DELETE /api/residents/:id`
Deletes a resident record.

**Side Effects:**
1. Frees up a bed in the assigned room.
2. Updates the room's status accordingly.

---

## Data Model (MongoDB)

### Collection: `residents`
```js
{
  _id: ObjectId,
  hostelId: ObjectId,       // Index: 1
  roomId: ObjectId,         // Index: 1
  name: String,
  phone: String,
  email: String,
  bed: String,              // label, e.g., "Bed A"
  joinDate: Date,
  status: String,           // Active | Notice | New
  paymentStatus: String,    // Paid | Overdue | Partial | Pending
  avatarUrl: String,
  emergencyContact: String,
  aadharNo: String,
  createdAt: Date,
  updatedAt: Date
}
```
