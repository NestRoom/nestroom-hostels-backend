# Phase 8: Payments API — Developer Notes

> **Status:** ✅ Complete and implemented
> **Base URL:** `http://localhost:5001/api/payments`
> All endpoints in this phase require `Authorization: Bearer <token>`

---

## Overview

The Payments API handles financial tracking for the hostel. It tracks resident payments, dues, and provides data for executive dashboards (revenue charts and collection summaries).

**Key Features:**
- **Financial Stats:** Aggregates totals for collections and dues in real-time.
- **Revenue Overview:** Groups successful payments by month for chart visualization.
- **Dispute Tracking:** Direct endpoint to retrieve payments with 'Failed' status.

---

## Endpoints

### `GET /api/payments`
Returns all payment records for the admin's hostel.

**Query Parameters:**
- `status` (optional): `Successful`, `Pending`, `Failed`.
- `method` (optional): `UPI`, `Cash`, `Transfer`.
- `from` & `to` (optional): ISO8601 date range filters for the payment date.

---

### `GET /api/payments/stats`
Returns total amount collected, total outstanding dues, and upcoming renewals.

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
Returns monthly revenue totals for the current year. Used by the Recharts dashboard.

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
Returns all payments where `status === 'Failed'`.

---

### `POST /api/payments`
Records a new payment transaction.

**Accepted Type Values:** `Rent`, `Deposit`, `Service`.

---

### `PUT /api/payments/:id`
Updates the status of a payment (e.g., from `Pending` to `Successful` after verification).

---

## Data Model (MongoDB)

### Collection: `payments`
```js
{
  _id: ObjectId,
  hostelId: ObjectId,       // Index: 1
  residentId: ObjectId,     // Index: 1
  roomId: ObjectId,
  amount: Number,           // in INR
  method: String,           // UPI | Cash | Transfer
  date: Date,               // Date of transaction (defaults now)
  dueDate: Date,            // null for non-recurring
  status: Array,            // Successful | Pending | Failed
  type: String,             // Rent | Deposit | Service
  createdAt: Date,
  updatedAt: Date
}
```
