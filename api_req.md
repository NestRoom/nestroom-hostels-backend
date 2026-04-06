# nestRoom - API Documentation

## Base URL
```
Production: https://api.nestroom.app/v1
Development: http://localhost:5000/v1
```

## Authentication
All endpoints (except auth endpoints) require JWT Bearer token in header:
```
Authorization: Bearer {access_token}
```

---

## 1. AUTHENTICATION ENDPOINTS

### 1.1 Owner Sign-Up
**POST** `/auth/owner/signup`

Request Body:
```json
{
  "hostelName": "XYZ Hostel",
  "ownerName": "John Doe",
  "numberOfHostels": 1,
  "whatsappNumber": "+919876543210",
  "email": "owner@example.com",
  "password": "SecurePassword123!",
  "confirmPassword": "SecurePassword123!"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "userId": "USR_OWN_001",
    "email": "owner@example.com",
    "message": "Verification email sent to your email address"
  }
}
```

---

### 1.2 Verify Email OTP
**POST** `/auth/owner/verify-email`

Request Body:
```json
{
  "email": "owner@example.com",
  "otp": "123456"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

---

### 1.3 Verify WhatsApp OTP
**POST** `/auth/owner/verify-whatsapp`

Request Body:
```json
{
  "whatsappNumber": "+919876543210",
  "otp": "123456"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "userId": "USR_OWN_001",
      "email": "owner@example.com",
      "userType": "owner"
    }
  }
}
```

---

### 1.4 Resident Login
**POST** `/auth/resident/login`

Request Body:
```json
{
  "hostelCode": "XYZ_001_Bangalore",
  "email": "resident@example.com",
  "password": "StudentPassword123!"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "residentId": "RES_001_2024",
      "fullName": "John Student",
      "email": "resident@example.com",
      "roomNumber": "101",
      "bedNumber": "A"
    }
  }
}
```

---

### 1.5 General Login (Owner/Employee)
**POST** `/auth/login`

Request Body:
```json
{
  "email": "owner@example.com",
  "password": "SecurePassword123!"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": { ... }
  }
}
```

---

### 1.6 Logout
**POST** `/auth/logout`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

### 1.7 Refresh Token
**POST** `/auth/refresh-token`

Request Body:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### 1.8 Setup 2FA
**POST** `/auth/setup-2fa`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "secret": "JBSWY3DPEBLW64TMMQ======",
    "qrCode": "https://api.qrserver.com/v1/create-qr-code?size=300x300&data=...",
    "message": "Scan QR code with Google Authenticator"
  }
}
```

---

### 1.9 Verify 2FA
**POST** `/auth/verify-2fa`

Request Body:
```json
{
  "token": "123456",
  "secret": "JBSWY3DPEBLW64TMMQ======"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "2FA enabled successfully"
  }
}
```

---

## 2. HOSTEL MANAGEMENT ENDPOINTS

### 2.1 Get All Hostels
**GET** `/hostels`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?page=1&limit=10&status=active&search=XYZ
```

Response (200):
```json
{
  "success": true,
  "data": {
    "hostels": [
      {
        "hostelId": "HST_001",
        "hostelCode": "XYZ_001_Bangalore",
        "hostelName": "XYZ Hostel",
        "city": "Bangalore",
        "bedCount": 50,
        "occupiedBeds": 45,
        "totalRevenue": 150000,
        "isActive": true
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "pages": 1
    }
  }
}
```

---

### 2.2 Get Hostel Profile
**GET** `/hostels/:hostelId`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "hostelId": "HST_001",
    "hostelName": "XYZ Hostel",
    "hostelCode": "XYZ_001_Bangalore",
    "description": "Budget-friendly hostel in Bangalore",
    "location": {
      "coordinates": [77.6245, 12.9352],
      "address": "123 Main Street, Bangalore"
    },
    "contact": {
      "phone": "+919876543210",
      "email": "contact@xyzhostel.com",
      "whatsapp": "+919876543211"
    },
    "bankDetails": {
      "accountHolderName": "XYZ Hostel Pvt Ltd",
      "ifscCode": "IBKL0001",
      "bankName": "ICICI Bank"
    },
    "facilities": {
      "bedCount": 50,
      "roomCount": 20,
      "buildingCount": 2,
      "occupiedBeds": 45
    },
    "profileCompletion": {
      "percentage": 85,
      "completed": ["Basic Info", "Location", "Bank Details"],
      "pending": ["Cover Photo", "2FA"]
    }
  }
}
```

---

### 2.3 Update Hostel Profile
**PUT** `/hostels/:hostelId`

Headers: `Authorization: Bearer {access_token}`
Content-Type: `application/json`

Request Body:
```json
{
  "hostelName": "XYZ Hostel Premium",
  "description": "Premium hostel with modern amenities",
  "contactPhone": "+919876543210",
  "location": {
    "address": "123 Main Street",
    "latitude": 12.9352,
    "longitude": 77.6245
  }
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Hostel profile updated successfully"
  }
}
```

---

### 2.4 Update Bank Details
**PUT** `/hostels/:hostelId/bank-details`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "accountHolderName": "XYZ Hostel Pvt Ltd",
  "accountNumber": "1234567890",
  "ifscCode": "IBKL0001",
  "bankName": "ICICI Bank",
  "accountType": "Current"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Bank details updated successfully"
  }
}
```

---

### 2.5 Get Profile Completion Status
**GET** `/hostels/:hostelId/profile-completion`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "overallCompletion": 75,
    "sections": {
      "BasicInfo": { "percentage": 100, "status": "completed" },
      "ProfilePhoto": { "percentage": 100, "status": "completed" },
      "BankDetails": { "percentage": 100, "status": "completed" },
      "Location": { "percentage": 100, "status": "completed" },
      "TwoFactorAuth": { "percentage": 0, "status": "pending" },
      "CoverPhoto": { "percentage": 0, "status": "pending" }
    }
  }
}
```

---

### 2.6 Add Employee
**POST** `/hostels/:hostelId/employees`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "fullName": "Rajesh Kumar",
  "email": "rajesh@xyzhostel.com",
  "whatsappNumber": "+919876543210",
  "position": "Hostel Manager",
  "hireDate": "2023-06-01",
  "permissions": {
    "canManageRooms": true,
    "canManageResidents": true,
    "canViewPayments": true,
    "canInitiateAttendance": true
  }
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "employeeId": "EMP_001",
    "employeeCode": "XYZ_001_EMP_001",
    "username": "rajesh.kumar",
    "temporaryPassword": "TempPass@2024",
    "message": "Employee added. Credentials sent via email and WhatsApp"
  }
}
```

---

### 2.7 Get Employees
**GET** `/hostels/:hostelId/employees`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "employees": [
      {
        "employeeId": "EMP_001",
        "fullName": "Rajesh Kumar",
        "position": "Hostel Manager",
        "email": "rajesh@xyzhostel.com",
        "isActive": true,
        "lastLogin": "2024-01-20T14:25:00Z"
      }
    ]
  }
}
```

---

## 3. ROOM MANAGEMENT ENDPOINTS

### 3.1 Get Buildings
**GET** `/hostels/:hostelId/buildings`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "buildings": [
      {
        "buildingId": "BLD_001",
        "buildingName": "Building A - Main Wing",
        "floorCount": 5,
        "roomCount": 15,
        "totalBeds": 30
      }
    ]
  }
}
```

---

### 3.2 Create Building
**POST** `/hostels/:hostelId/buildings`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "buildingName": "Building B - Annex",
  "floorCount": 4,
  "address": "123 Main Street, Floor 1-4"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "buildingId": "BLD_002",
    "buildingName": "Building B - Annex",
    "message": "Building created successfully"
  }
}
```

---

### 3.3 Get Rooms (with Grid Layout)
**GET** `/hostels/:hostelId/rooms`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?buildingId=BLD_001&floorNumber=1&status=Vacant
```

Response (200):
```json
{
  "success": true,
  "data": {
    "building": {
      "buildingId": "BLD_001",
      "buildingName": "Building A",
      "floors": [
        {
          "floorNumber": 1,
          "rooms": [
            {
              "roomId": "RM_A_01_01",
              "roomNumber": "101",
              "roomType": "Double",
              "bedCount": 2,
              "occupiedBeds": 2,
              "status": "Occupied",
              "monthlyFee": 5000,
              "amenities": ["AC", "WiFi", "Bathroom"]
            }
          ]
        }
      ]
    }
  }
}
```

---

### 3.4 Create Room
**POST** `/hostels/:hostelId/rooms`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "buildingId": "BLD_001",
  "floorNumber": 1,
  "roomNumber": "101",
  "roomType": "Double",
  "bedCount": 2,
  "monthlyFee": 5000,
  "amenities": ["AC", "WiFi", "Bathroom"],
  "hasAttachedBathroom": true
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "roomId": "RM_A_01_01",
    "roomNumber": "101",
    "beds": ["BD_A_01_01_A", "BD_A_01_01_B"],
    "message": "Room created successfully with 2 beds"
  }
}
```

---

### 3.5 Update Room
**PUT** `/hostels/:hostelId/rooms/:roomId`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "roomType": "Double",
  "monthlyFee": 5500,
  "amenities": ["AC", "WiFi", "Bathroom", "Wardrobe"]
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Room updated successfully"
  }
}
```

---

### 3.6 Delete Room (Archive)
**DELETE** `/hostels/:hostelId/rooms/:roomId`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Room archived successfully"
  }
}
```

---

## 4. RESIDENT MANAGEMENT ENDPOINTS

### 4.1 Get Residents
**GET** `/hostels/:hostelId/residents`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?page=1&limit=20&status=Active&room=101&paymentStatus=Pending&search=John
```

Response (200):
```json
{
  "success": true,
  "data": {
    "residents": [
      {
        "residentId": "RES_001_2024",
        "fullName": "John Student",
        "email": "john@example.com",
        "roomNumber": "101",
        "bedNumber": "A",
        "residentStatus": "Active",
        "feeAmount": 5000,
        "feeFrequency": "Monthly",
        "nextDueDate": "2024-02-15",
        "foodEnabled": true,
        "kycStatus": "Verified"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
  }
}
```

---

### 4.2 Add Resident
**POST** `/hostels/:hostelId/residents`

Headers: `Authorization: Bearer {access_token}`
Content-Type: `multipart/form-data`

Request Body:
```json
{
  "fullName": "John Student",
  "email": "john@example.com",
  "whatsappNumber": "+919876543200",
  "college": "ABC Engineering College",
  "enrollmentNumber": "2021CSE123",
  "idCardType": "Aadhaar",
  "idCardNumber": "1234567890123456",
  "feeAmount": 5000,
  "feeFrequency": "Monthly",
  "foodEnabled": true,
  "roomId": "RM_A_01_01",
  "bedId": "BD_A_01_01_A"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "residentId": "RES_001_2024",
    "fullName": "John Student",
    "roomNumber": "101",
    "bedNumber": "A",
    "hostelCode": "XYZ_001_Bangalore",
    "message": "Resident added successfully. Login credentials sent via email and WhatsApp"
  }
}
```

---

### 4.3 Get Resident Profile
**GET** `/residents/profile`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "residentId": "RES_001_2024",
    "fullName": "John Student",
    "email": "john@example.com",
    "profilePhoto": "https://cloudinary.com/profile.jpg",
    "roomNumber": "101",
    "bedNumber": "A",
    "hostelDetails": {
      "hostelName": "XYZ Hostel",
      "address": "123 Main Street, Bangalore",
      "checkInTime": "14:00",
      "checkOutTime": "11:00"
    },
    "kyc": {
      "kycStatus": "Verified",
      "kycVerifiedAt": "2024-01-15T10:35:00Z"
    }
  }
}
```

---

### 4.4 Upload KYC Documents
**POST** `/residents/kyc-upload`

Headers: `Authorization: Bearer {access_token}`
Content-Type: `multipart/form-data`

Form Fields:
```
- profilePhoto (image file)
- aadhaarPhoto (image file)
- collegeIdPhoto (image file)
```

Response (201):
```json
{
  "success": true,
  "data": {
    "message": "KYC documents uploaded. Verification pending."
  }
}
```

---

## 5. PAYMENT ENDPOINTS

### 5.1 Get Revenue Dashboard
**GET** `/hostels/:hostelId/revenue`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?month=01&year=2024&dateRange=thisMonth
```

Response (200):
```json
{
  "success": true,
  "data": {
    "potentialIncome": 225000,
    "actualIncome": 205000,
    "pendingAmount": 20000,
    "paymentStats": {
      "submitted": 41,
      "pending": 4,
      "overdue": 2
    },
    "chartData": {
      "submitted": 82,
      "pending": 16,
      "overdue": 2
    },
    "studentsSubmitted": [
      {
        "residentId": "RES_001_2024",
        "name": "John Student",
        "amount": 5000,
        "paidDate": "2024-01-15",
        "nextDueDate": "2024-02-15"
      }
    ],
    "studentsPending": [
      {
        "residentId": "RES_002_2024",
        "name": "Jane Student",
        "amount": 5000,
        "dueDate": "2024-01-15",
        "daysOverdue": 5
      }
    ]
  }
}
```

---

### 5.2 Initialize Payment (Resident)
**POST** `/residents/payments/initialize`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "orderId": "order_2024001",
    "amount": 500000,
    "currency": "INR",
    "hostelName": "XYZ Hostel",
    "period": "January 2024",
    "keyId": "rzp_test_xxxxx"
  }
}
```

---

### 5.3 Verify Payment (Callback)
**POST** `/residents/payments/verify`

Request Body:
```json
{
  "razorpay_order_id": "order_2024001",
  "razorpay_payment_id": "pay_2024001",
  "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "paymentId": "PAY_001_2024",
    "status": "Success",
    "amount": 5000,
    "nextDueDate": "2024-02-15",
    "receiptUrl": "https://cloudinary.com/receipt-001.pdf"
  }
}
```

---

### 5.4 Get Payment History
**GET** `/residents/payments/history`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?page=1&limit=12&status=Success
```

Response (200):
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "paymentId": "PAY_001_2024",
        "amount": 5000,
        "period": "January 2024",
        "paidDate": "2024-01-15",
        "status": "Success",
        "nextDueDate": "2024-02-15",
        "receiptUrl": "https://cloudinary.com/receipt-001.pdf"
      }
    ],
    "pagination": { "page": 1, "limit": 12, "total": 5, "pages": 1 }
  }
}
```

---

### 5.5 Get Upcoming Payments
**GET** `/residents/payments/upcoming`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "upcomingPayments": [
      {
        "dueDate": "2024-02-15",
        "amount": 5000,
        "status": "Pending",
        "daysUntilDue": 12
      }
    ]
  }
}
```

---

## 6. ATTENDANCE ENDPOINTS

### 6.1 Setup Geofence
**POST** `/hostels/:hostelId/attendance/config`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "location": {
    "latitude": 12.9352,
    "longitude": 77.6245
  },
  "geofenceRadius": 500,
  "attendanceTime": "20:45",
  "attendanceFrequency": "Daily",
  "surpriseCheckEnabled": true
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "message": "Attendance configuration saved successfully"
  }
}
```

---

### 6.2 Send Attendance Request
**POST** `/hostels/:hostelId/attendance/request`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "type": "Surprise"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Attendance request sent to 45 residents"
  }
}
```

---

### 6.3 Submit Attendance (Resident)
**POST** `/residents/attendance/submit`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "status": "Present",
  "latitude": 12.9350,
  "longitude": 77.6247,
  "accuracy": 20
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "attendanceId": "ATT_001_2024_01_20",
    "status": "Present",
    "distanceFromHostel": 320,
    "withinGeofence": true,
    "message": "Attendance marked successfully"
  }
}
```

---

### 6.4 Get Attendance Records (Owner)
**GET** `/hostels/:hostelId/attendance`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?date=2024-01-20&status=Present&building=BLD_001
```

Response (200):
```json
{
  "success": true,
  "data": {
    "attendanceDate": "2024-01-20",
    "totalResidents": 45,
    "present": 42,
    "absent": 3,
    "notResponded": 0,
    "records": [
      {
        "residentId": "RES_001_2024",
        "name": "John Student",
        "status": "Present",
        "time": "20:45",
        "distance": 120,
        "withinGeofence": true
      }
    ]
  }
}
```

---

### 6.5 Get Attendance History (Resident)
**GET** `/residents/attendance/history`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?dateFrom=2024-01-01&dateTo=2024-01-31
```

Response (200):
```json
{
  "success": true,
  "data": {
    "attendanceHistory": [
      {
        "date": "2024-01-20",
        "status": "Present",
        "time": "20:45",
        "location": { "latitude": 12.9350, "longitude": 77.6247 }
      }
    ]
  }
}
```

---

## 7. LEAVE ENDPOINTS

### 7.1 Apply for Leave (Resident)
**POST** `/residents/leaves`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "leaveType": "Medical",
  "fromDate": "2024-01-25",
  "toDate": "2024-01-27",
  "reason": "High fever and doctor consultation required",
  "attachmentUrl": "https://cloudinary.com/medical-cert.pdf"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "leaveId": "LEV_001_2024",
    "status": "Pending",
    "duration": 3,
    "message": "Leave application submitted. Pending approval from manager."
  }
}
```

---

### 7.2 Get My Leaves (Resident)
**GET** `/residents/leaves`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "leaves": [
      {
        "leaveId": "LEV_001_2024",
        "leaveType": "Medical",
        "fromDate": "2024-01-25",
        "toDate": "2024-01-27",
        "status": "Approved",
        "approvedBy": "Rajesh Kumar"
      }
    ]
  }
}
```

---

### 7.3 Approve Leave (Owner)
**PUT** `/hostels/:hostelId/leaves/:leaveId/approve`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "remarks": "Medical leave approved with certificate"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Leave approved. Resident notified."
  }
}
```

---

### 7.4 Reject Leave (Owner)
**PUT** `/hostels/:hostelId/leaves/:leaveId/reject`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "rejectionReason": "Leave duration exceeds policy limit"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Leave rejected. Resident notified."
  }
}
```

---

## 8. NOTIFICATION ENDPOINTS

### 8.1 Send Notification (Owner)
**POST** `/hostels/:hostelId/notifications`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "title": "Payment Due Reminder",
  "message": "Your monthly hostel fee is due on 2024-02-15",
  "type": "Payment",
  "recipientType": "AllResidents",
  "poll": {
    "isPoll": false
  }
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "notificationId": "NTF_001_2024",
    "message": "Notification sent to 45 residents"
  }
}
```

---

### 8.2 Send Poll Notification
**POST** `/hostels/:hostelId/notifications`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "title": "Food Feedback Survey",
  "message": "Please rate the food quality this week",
  "type": "Survey",
  "recipientType": "AllResidents",
  "poll": {
    "isPoll": true,
    "pollType": "Rating",
    "pollQuestion": "How would you rate the food quality?",
    "pollOptions": ["Excellent", "Good", "Average", "Poor"],
    "pollDeadline": "2024-01-25T23:59:59Z"
  }
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "notificationId": "NTF_002_2024",
    "message": "Poll sent to 45 residents"
  }
}
```

---

### 8.3 Get Notifications (Resident)
**GET** `/residents/notifications`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?page=1&limit=20&type=Payment
```

Response (200):
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "notificationId": "NTF_001_2024",
        "title": "Payment Due Reminder",
        "message": "Your monthly hostel fee is due on 2024-02-15",
        "type": "Payment",
        "sentAt": "2024-01-20T20:45:00Z",
        "viewedAt": "2024-01-20T21:15:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 15, "pages": 1 }
  }
}
```

---

### 8.4 Mark Notification as Read
**PUT** `/residents/notifications/:notificationId/read`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Notification marked as read"
  }
}
```

---

### 8.5 Submit Poll Response
**POST** `/residents/notifications/:notificationId/poll-response`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "selectedOption": "Excellent"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "message": "Your response has been recorded"
  }
}
```

---

### 8.6 Get Notification Analytics (Owner)
**GET** `/hostels/:hostelId/notifications/:notificationId/analytics`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "notificationId": "NTF_001_2024",
    "title": "Payment Due Reminder",
    "totalRecipients": 45,
    "viewedCount": 42,
    "viewRate": 0.93,
    "poll": {
      "totalResponses": 38,
      "responseRate": 0.84,
      "responses": {
        "Excellent": 15,
        "Good": 18,
        "Average": 5,
        "Poor": 0
      }
    }
  }
}
```

---

## 9. COMPLAINT ENDPOINTS

### 9.1 Raise Complaint (Resident)
**POST** `/residents/complaints`

Headers: `Authorization: Bearer {access_token}`
Content-Type: `multipart/form-data`

Form Fields:
```
- title (string)
- description (string)
- category (string)
- priority (string)
- attachments (file array, optional)
```

Response (201):
```json
{
  "success": true,
  "data": {
    "complaintId": "CMP_001_2024",
    "status": "Open",
    "message": "Complaint registered successfully. You will be notified of updates."
  }
}
```

---

### 9.2 Get My Complaints (Resident)
**GET** `/residents/complaints`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?status=Open&page=1&limit=10
```

Response (200):
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "complaintId": "CMP_001_2024",
        "title": "Bathroom Maintenance Issue",
        "category": "Maintenance",
        "status": "InProgress",
        "createdAt": "2024-01-20T20:45:00Z",
        "assignedTo": "Rajesh Kumar"
      }
    ]
  }
}
```

---

### 9.3 Get All Complaints (Owner)
**GET** `/hostels/:hostelId/complaints`

Headers: `Authorization: Bearer {access_token}`

Query Parameters:
```
?status=Open&priority=High&page=1
```

Response (200):
```json
{
  "success": true,
  "data": {
    "complaints": [
      {
        "complaintId": "CMP_001_2024",
        "residentName": "John Student",
        "title": "Bathroom Maintenance Issue",
        "category": "Maintenance",
        "priority": "High",
        "status": "InProgress",
        "assignedTo": "Rajesh Kumar"
      }
    ]
  }
}
```

---

### 9.4 Update Complaint Status
**PUT** `/hostels/:hostelId/complaints/:complaintId/status`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "status": "Resolved",
  "remarks": "Bathroom repaired successfully"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "message": "Complaint status updated. Resident notified."
  }
}
```

---

## 10. FOOD MANAGEMENT ENDPOINTS

### 10.1 Get Food Schedule (Resident)
**GET** `/residents/food-schedule`

Headers: `Authorization: Bearer {access_token}`

Response (200):
```json
{
  "success": true,
  "data": {
    "weekStartDate": "2024-01-15",
    "schedule": [
      {
        "dayOfWeek": "Monday",
        "date": "2024-01-15",
        "meals": [
          {
            "mealType": "Breakfast",
            "time": "08:00-09:00",
            "menu": "Idli, Sambar, Chutney",
            "dietaryTags": ["Vegetarian"]
          }
        ]
      }
    ]
  }
}
```

---

### 10.2 Create Food Schedule (Owner)
**POST** `/hostels/:hostelId/food-schedule`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "weekStartDate": "2024-01-15",
  "schedule": [
    {
      "dayOfWeek": "Monday",
      "meals": [
        {
          "mealType": "Breakfast",
          "time": "08:00-09:00",
          "menu": "Idli, Sambar, Chutney",
          "dietaryTags": ["Vegetarian"]
        }
      ]
    }
  ]
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "foodScheduleId": "FD_001_2024_W03",
    "message": "Food schedule published for the week"
  }
}
```

---

### 10.3 Submit Meal Feedback (Resident)
**POST** `/hostels/:hostelId/food-schedule/:scheduleId/feedback`

Headers: `Authorization: Bearer {access_token}`

Request Body:
```json
{
  "mealType": "Breakfast",
  "rating": 4,
  "comment": "Good taste, could use more oil"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "message": "Feedback recorded successfully"
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERR_CODE",
    "message": "Error description",
    "details": {}
  }
}
```

### Common Error Codes

| Code | HTTP | Message |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `DUPLICATE_ENTRY` | 409 | Duplicate record |
| `RATE_LIMIT` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |

---

## Rate Limiting

All API endpoints are rate-limited:
- **Default:** 100 requests per 15 minutes per IP
- **Auth Endpoints:** 5 requests per minute
- **Payment Endpoints:** 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1705336500
```

---

**API Version:** 1.0  
**Last Updated:** April 2026  
**Total Endpoints:** 50+