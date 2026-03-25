# Phase 9: Services API — Developer Notes

> **Status:** ✅ Complete and implemented
> **Base URL:** `http://localhost:5001/api/services`
> All endpoints in this phase require `Authorization: Bearer <token>`

---

## Overview

The Services API is a ticketing and maintenance management system. It allows residents (via admins) to log complaints, track their resolution status, and analyze service performance.

**Key Features:**
- **Auto-Generated Ticket IDs:** Sequential IDs (e.g., `T-1002`, `T-1003`) are automatically created for every new request.
- **Performance Metrics:** Real-time calculation of open tickets and average resolution time in hours using MongoDB aggregation.
- **Priority Tracking:** Allows categorization by `category` (Plumbing, Electrical, etc.) and `priority` (Low, Medium, High).

---

## Endpoints

### `GET /api/services/tickets`
Returns all service requests for the admin's hostel.

**Query Parameters:**
- `status` (optional): `Pending`, `In Progress`, `Resolved`, `Closed`.

---

### `GET /api/services/stats`
Returns organizational metrics for the service department.

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

### `POST /api/services/tickets`
Creates a new maintenance ticket.

**Side Effects:** 
Fetches the last ticket in the collection to determine the next sequential `ticketId` (starting from `T-1001`).

---

### `PUT /api/services/tickets/:id`
Updates ticket status or priority.

**Automation:** 
If `status` is set to `Resolved`, the `resolvedAt` timestamp is automatically set to the current time.

---

### `DELETE /api/services/tickets/:id`
Deletes a ticket record from the database.

---

## Data Model (MongoDB)

### Collection: `services_tickets`
```js
{
  _id: ObjectId,
  hostelId: ObjectId,       // Index: 1
  residentId: ObjectId,     // Index: 1
  roomId: ObjectId,
  ticketId: String,         // Human-friendly, e.g., "T-1004"
  category: String,         // e.g., "Plumbing"
  title: String,
  description: String,
  priority: String,         // Low | Medium | High
  status: String,           // Pending | In Progress | Resolved | Closed
  createdAt: Date,
  resolvedAt: Date,         // Set automatically on resolution
  updatedAt: Date
}
```
