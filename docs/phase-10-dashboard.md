# Phase 10: Dashboard API — Developer Notes

> **Status:** ✅ Complete and implemented
> **Base URL:** `http://localhost:5001/api/dashboard`
> All endpoints in this phase require `Authorization: Bearer <token>`

---

## Overview

The Dashboard API is the "heart" of the frontend application. Instead of requiring the frontend to make 4-5 separate API calls upon logging in, this API provides a single, high-performance aggregated snapshot.

**Collections Queried:**
1. `rooms` (Counts by status)
2. `residents` (Counts by status)
3. `payments` (Financial sums and overdue counts)
4. `services_tickets` (Open ticket counts)

---

## Endpoints

### `GET /api/dashboard/stats`
Returns the complete summary of hostel health.

**Aggregation Logic:**
- **Rooms:** Aggregates by `status` (OCCUPIED / VACANT / MAINTENANCE).
- **Residents:** Aggregates by `status` (Active / Notice).
- **Payments:** Calculates:
    - `collectedThisMonth`: Sum of successful payments since the 1st of the month.
    - `pendingDues`: Sum of all `Pending` payments.
    - `overdueCount`: Count of `Pending` payments with a `dueDate` in the past.
- **Services:** Simple count of tickets NOT in `Resolved` or `Closed` status.

**Response `200`**
```json
{
  "success": true,
  "stats": {
    "rooms": {
      "total": 20,
      "occupied": 12,
      "vacant": 7,
      "maintenance": 1
    },
    "residents": {
      "total": 18,
      "active": 15,
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

## Data Model (MongoDB Integration)

The Dashboard API does not have its own collection. It acts as an **aggregator** over the primary business collections.

- **Speed:** The implementation uses `Promise.all()` to fire all 4 aggregation queries concurrently across the database cluster.
- **TENANCY:** Every query includes `{ hostelId: new ObjectId(req.user.hostelId) }` to ensure data privacy.
