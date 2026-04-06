# nestRoom - MongoDB Database Design Document

## Table of Contents
1. Collection Overview
2. Detailed Schema Definitions
3. Indexing Strategy
4. Data Relationships & Joins
5. Query Optimization
6. Data Validation Rules

---

## 1. COLLECTION OVERVIEW

### Core Collections (14 Main)

| # | Collection | Purpose | Record Count (Est.) |
|---|-----------|---------|-------------------|
| 1 | users | User accounts (owners, employees, residents) | 10,000+ |
| 2 | hostels | Hostel/Chain information | 500+ |
| 3 | buildings | Building information | 1,000+ |
| 4 | rooms | Room definitions | 10,000+ |
| 5 | beds | Individual bed records | 50,000+ |
| 6 | residents | Resident profiles | 50,000+ |
| 7 | employees | Staff members | 2,000+ |
| 8 | payments | Payment transactions | 100,000+ |
| 9 | attendance_records | Daily attendance logs | 1,000,000+ |
| 10 | leave_applications | Leave requests | 50,000+ |
| 11 | notifications | Notification messages | 500,000+ |
| 12 | complaints | Resident complaints | 10,000+ |
| 13 | food_schedules | Weekly menus | 1,000+ |
| 14 | audit_logs | System logs | 5,000,000+ |

---

## 2. DETAILED SCHEMA DEFINITIONS

### 2.1 USERS Collection

```javascript
db.users.insertOne({
  // System Fields
  _id: ObjectId("507f1f77bcf86cd799439011"),
  userId: "USR_OWN_001",
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:30:00Z"),
  lastLogin: ISODate("2024-01-20T14:25:00Z"),
  
  // Authentication
  userType: "owner",  // enum: "owner" | "resident" | "employee"
  email: "owner@example.com",
  passwordHash: "$2b$10$...", // bcrypt hash
  whatsappNumber: "+919876543210",
  
  // Profile
  fullName: "John Doe",
  profilePhoto: "https://cloudinary.com/john-doe.jpg",
  coverPhoto: "https://cloudinary.com/john-doe-cover.jpg",
  
  // Verification
  emailVerified: true,
  emailVerifiedAt: ISODate("2024-01-15T10:35:00Z"),
  whatsappVerified: true,
  whatsappVerifiedAt: ISODate("2024-01-15T10:40:00Z"),
  verificationToken: null,
  verificationTokenExpiry: null,
  
  // Security
  isActive: true,
  isSuspended: false,
  suspensionReason: null,
  
  // 2FA
  twoFactorEnabled: true,
  twoFactorSecret: "JBSWY3DPEBLW64TMMQ======", // Google Authenticator
  
  // Password Reset
  resetToken: null,
  resetTokenExpiry: null,
  
  // Preferences
  preferences: {
    notificationEmail: true,
    notificationWhatsapp: true,
    notificationApp: true,
    theme: "light", // enum: "light" | "dark"
    language: "en",
    timezone: "Asia/Kolkata"
  },
  
  // Role-based fields (only for employees)
  employeeId: null,  // ref: Employees._id
  hostelId: null,    // ref: Hostels._id (primary hostel)
  permissions: {}    // empty for non-employees
})

// Indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ whatsappNumber: 1 }, { unique: true })
db.users.createIndex({ userId: 1 }, { unique: true })
db.users.createIndex({ userType: 1 })
db.users.createIndex({ isActive: 1 })
db.users.createIndex({ createdAt: -1 })
```

### 2.2 HOSTELS Collection

```javascript
db.hostels.insertOne({
  // System
  _id: ObjectId("507f1f77bcf86cd799439012"),
  hostelId: "HST_001",
  hostelCode: "XYZ_001_Bangalore",
  ownerId: ObjectId("507f1f77bcf86cd799439011"), // ref: Users
  chainId: null,  // ref: Hostels (if part of chain)
  
  // Basic Info
  hostelName: "XYZ Hostel",
  description: "Budget-friendly hostel in Bangalore",
  hostelType: "Budget",  // enum: "Budget" | "Standard" | "Premium"
  
  // Contact
  contactPerson: "John Doe",
  contactPhone: "+919876543210",
  contactEmail: "contact@xyzhostel.com",
  whatsappNumber: "+919876543211",
  
  // Address & Location
  address: "123 Main Street, Bangalore",
  landmark: "Near Koramangala",
  city: "Bangalore",
  state: "Karnataka",
  country: "India",
  pincode: "560034",
  
  // Geolocation (GeoJSON Point for geofencing)
  location: {
    type: "Point",
    coordinates: [77.6245, 12.9352]  // [longitude, latitude]
  },
  geofenceRadius: 500,  // in meters, default 500m
  
  // Registration
  registrationNumber: "REG/2024/001",
  registrationDate: ISODate("2024-01-15T10:30:00Z"),
  registrationDocument: "https://cloudinary.com/...",
  
  // Facilities
  bedCount: 50,
  roomCount: 20,
  buildingCount: 2,
  occupiedBeds: 45,
  
  // Bank Details (Encrypted)
  bankDetails: {
    accountHolderName: "XYZ Hostel Pvt Ltd",
    accountNumber: "1234567890", // Encrypted
    ifscCode: "IBKL0001",
    bankName: "ICICI Bank",
    accountType: "Current",
    branchCode: "BNG001"
  },
  
  // Images
  images: [
    "https://cloudinary.com/hostel-img-1.jpg",
    "https://cloudinary.com/hostel-img-2.jpg"
  ],
  
  // Rules & Policies
  checkInTime: "14:00",
  checkOutTime: "11:00",
  visitorPolicy: "Allowed with prior permission",
  smokePolicy: "No smoking inside rooms",
  
  // Operational
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-20T14:25:00Z"),
  isActive: true,
  
  // Metadata
  totalRevenue: 150000,
  totalResidents: 45,
  averageOccupancy: 90
})

// Indexes
db.hostels.createIndex({ hostelId: 1 }, { unique: true })
db.hostels.createIndex({ hostelCode: 1 }, { unique: true })
db.hostels.createIndex({ ownerId: 1 })
db.hostels.createIndex({ chainId: 1 })
db.hostels.createIndex({ location: "2dsphere" })  // Geospatial
db.hostels.createIndex({ isActive: 1 })
```

### 2.3 BUILDINGS Collection

```javascript
db.buildings.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439013"),
  buildingId: "BLD_001",
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  
  buildingName: "Building A - Main Wing",
  buildingNumber: "A",
  
  // Structure
  floorCount: 5,
  floorPlan: "https://cloudinary.com/floor-plan.pdf",
  
  // Location (specific to building if hostel has multiple)
  address: "123 Main Street, Floor 1-5, Bangalore",
  location: {
    type: "Point",
    coordinates: [77.6245, 12.9352]
  },
  
  // Facilities
  amenities: [
    "Lift",
    "Staircase",
    "Common Lounge",
    "Kitchen",
    "Laundry",
    "Security Gate"
  ],
  
  // Management
  buildingManager: "Rajesh Kumar",
  managerPhone: "+919876543220",
  maintenanceContact: "+919876543221",
  
  // Images
  images: [
    "https://cloudinary.com/building-front.jpg",
    "https://cloudinary.com/building-lobby.jpg"
  ],
  
  // Status
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-20T14:25:00Z"),
  isActive: true
})

// Indexes
db.buildings.createIndex({ buildingId: 1 })
db.buildings.createIndex({ hostelId: 1 })
db.buildings.createIndex({ hostelId: 1, isActive: 1 })
```

### 2.4 ROOMS Collection

```javascript
db.rooms.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439014"),
  roomId: "RM_A_01_01",  // Format: {buildingCode}_{floorNumber}_{roomNumber}
  
  // Reference
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  buildingId: ObjectId("507f1f77bcf86cd799439013"), // ref: Buildings
  
  // Room Details
  floorNumber: 1,
  roomNumber: "101",
  roomType: "Double",  // enum: "Single" | "Double" | "Triple" | "Dorm"
  
  // Capacity
  bedCount: 2,
  occupiedBeds: 2,
  availableBeds: 0,
  
  // Pricing (per bed, per frequency)
  pricing: {
    monthly: {
      amount: 5000,
      currency: "INR"
    },
    quarterly: {
      amount: 14000,  // slight discount
      currency: "INR"
    },
    yearly: {
      amount: 52000,  // more discount
      currency: "INR"
    }
  },
  
  // Status
  roomStatus: "Occupied",  // enum: "Vacant" | "Occupied" | "Maintenance" | "Blocked"
  maintenanceStartDate: null,
  maintenanceEndDate: null,
  maintenanceReason: null,
  
  // Amenities
  amenities: [
    "AC",
    "WiFi",
    "Attached Bathroom",
    "Wardrobe",
    "Study Desk",
    "Bed Linen Included"
  ],
  
  // Features
  hasAttachedBathroom: true,
  hasWindowView: true,
  hasBalcony: false,
  
  // Media
  images: [
    "https://cloudinary.com/room-overview.jpg",
    "https://cloudinary.com/room-bed.jpg",
    "https://cloudinary.com/room-bathroom.jpg"
  ],
  videoTour: "https://youtube.com/...",
  
  // Restrictions
  genderRestriction: null,  // enum: null | "Male" | "Female"
  smokingAllowed: false,
  petPolicy: "Not allowed",
  
  // Rules
  quietHours: {
    startTime: "22:00",
    endTime: "08:00"
  },
  
  // Metadata
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-20T14:25:00Z"),
  isActive: true
})

// Indexes
db.rooms.createIndex({ roomId: 1 })
db.rooms.createIndex({ hostelId: 1 })
db.rooms.createIndex({ buildingId: 1 })
db.rooms.createIndex({ hostelId: 1, roomStatus: 1 })
db.rooms.createIndex({ hostelId: 1, occupiedBeds: 1 })
```

### 2.5 BEDS Collection

```javascript
db.beds.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439015"),
  bedId: "BD_A_01_01_A",  // Format: {roomId}_{bedLetter}
  
  // References
  roomId: ObjectId("507f1f77bcf86cd799439014"), // ref: Rooms
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  buildingId: ObjectId("507f1f77bcf86cd799439013"), // ref: Buildings
  
  // Bed Info
  bedNumber: "A",  // A, B, C, etc.
  bedPosition: "WindowSide",  // enum: "WindowSide" | "DoorSide" | "Middle"
  bedType: "Single",  // enum: "Single" | "Bunk" | "Queen"
  
  // Current Allocation
  bedStatus: "Occupied",  // enum: "Vacant" | "Occupied" | "Maintenance"
  currentResidentId: ObjectId("507f1f77bcf86cd799439100"), // ref: Residents
  
  // Allocation History
  allocationDate: ISODate("2024-01-15T10:30:00Z"),
  expectedCheckoutDate: ISODate("2024-04-15T10:30:00Z"),
  previousResidents: [
    {
      residentId: ObjectId("507f1f77bcf86cd799439050"),
      allocatedFrom: ISODate("2023-10-01T00:00:00Z"),
      allocatedTo: ISODate("2024-01-15T00:00:00Z"),
      name: "Jane Smith"
    }
  ],
  
  // Maintenance
  lastMaintenanceDate: ISODate("2024-01-10T10:00:00Z"),
  nextMaintenanceDate: ISODate("2024-04-10T10:00:00Z"),
  maintenanceNotes: "Bed frame repaired",
  
  // Status
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-20T14:25:00Z"),
  isActive: true
})

// Indexes
db.beds.createIndex({ bedId: 1 })
db.beds.createIndex({ roomId: 1 })
db.beds.createIndex({ currentResidentId: 1 })
db.beds.createIndex({ roomId: 1, bedStatus: 1 })
```

### 2.6 RESIDENTS Collection

```javascript
db.residents.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439100"),
  residentId: "RES_001_2024",
  
  // User Link
  userId: ObjectId("507f1f77bcf86cd799439050"), // ref: Users
  
  // Hostel Assignment
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  buildingId: ObjectId("507f1f77bcf86cd799439013"), // ref: Buildings
  roomId: ObjectId("507f1f77bcf86cd799439014"), // ref: Rooms
  bedId: ObjectId("507f1f77bcf86cd799439015"), // ref: Beds
  
  // Personal Info
  fullName: "John Student",
  email: "john@example.com",
  whatsappNumber: "+919876543200",
  dateOfBirth: ISODate("2003-05-15T00:00:00Z"),
  gender: "Male",  // enum: "Male" | "Female" | "Other"
  
  // Contact
  emergencyContactName: "Parent Name",
  emergencyContactPhone: "+919876543201",
  emergencyContactRelation: "Mother",
  
  // Educational Info
  college: "ABC Engineering College",
  enrollmentNumber: "2021CSE123",
  courseYear: "3rd",
  major: "Computer Science",
  
  // Identity
  idCardType: "Aadhaar",  // enum: "Aadhaar" | "PAN" | "DL" | "Passport"
  idCardNumber: "XXXX XXXX XXXX 1234",  // Encrypted
  idCardPhoto: "https://cloudinary.com/aadhaar.jpg",  // Encrypted URL
  
  // KYC
  kyc: {
    collegeIdPhoto: "https://cloudinary.com/college-id.jpg",
    profilePhoto: "https://cloudinary.com/profile.jpg",
    kycStatus: "Verified",  // enum: "Pending" | "Verified" | "Rejected"
    kycVerifiedAt: ISODate("2024-01-15T10:35:00Z"),
    kycVerifiedBy: ObjectId("507f1f77bcf86cd799439011"),  // ref: Users
    rejectionReason: null
  },
  
  // Residence Details
  checkInDate: ISODate("2024-01-15T14:00:00Z"),
  checkOutDate: null,
  residentStatus: "Active",  // enum: "Active" | "Inactive" | "OnLeave" | "TerminatedWithNotice" | "TerminatedImmediate"
  
  // Financial
  feeAmount: 5000,  // per period
  feeFrequency: "Monthly",  // enum: "Monthly" | "Quarterly" | "Yearly"
  nextDueDate: ISODate("2024-02-15T00:00:00Z"),
  securityDeposit: 5000,
  securityDepositPaid: true,
  securityDepositRefundedDate: null,
  
  // Food Service
  foodEnabled: true,
  foodStartDate: ISODate("2024-01-15T00:00:00Z"),
  dietaryPreferences: ["Vegetarian"],  // Can be multiple
  foodFeedback: []
  
  // Metadata
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-20T14:25:00Z"),
  isActive: true,
  
  // Additional notes
  specialRequests: "Prefer morning food delivery",
  internalNotes: "VIP resident, handle with care"
})

// Indexes
db.residents.createIndex({ residentId: 1 })
db.residents.createIndex({ userId: 1 })
db.residents.createIndex({ hostelId: 1 })
db.residents.createIndex({ roomId: 1 })
db.residents.createIndex({ bedId: 1 })
db.residents.createIndex({ hostelId: 1, residentStatus: 1 })
db.residents.createIndex({ hostelId: 1, nextDueDate: 1 })
db.residents.createIndex({ email: 1 })
```

### 2.7 EMPLOYEES Collection

```javascript
db.employees.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439200"),
  employeeId: "EMP_001",
  employeeCode: "XYZ_001_EMP_001",  // {hostelCode}_{employeeId}
  
  // User Link
  userId: ObjectId("507f1f77bcf86cd799439011"), // ref: Users
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  
  // Personal Info
  fullName: "Rajesh Kumar",
  email: "rajesh@xyzhostel.com",
  whatsappNumber: "+919876543210",
  dateOfBirth: ISODate("1990-03-20T00:00:00Z"),
  
  // Employment Details
  position: "Hostel Manager",  // enum: "Manager" | "Warden" | "Receptionist" | "Housekeeping" | "Kitchen" | "Security"
  department: "Management",
  hireDate: ISODate("2023-06-01T00:00:00Z"),
  contractEndDate: ISODate("2026-06-01T00:00:00Z"),
  employmentType: "Full-Time",  // enum: "Full-Time" | "Part-Time" | "Contract"
  
  // Login Credentials (Auto-generated)
  credentials: {
    username: "rajesh.kumar",  // auto-generated, immutable
    passwordHash: "$2b$10$...",  // bcrypted
    passwordLastChanged: ISODate("2024-01-15T10:30:00Z"),
    passwordExpiresAt: ISODate("2024-04-15T10:30:00Z")  // Force reset every 90 days
  },
  
  // Permissions & Role-Based Access Control (RBAC)
  permissions: {
    // Resident Management
    canAddResidents: true,
    canEditResidents: true,
    canDeleteResidents: false,
    canViewResidentKYC: true,
    canApproveKYC: true,
    
    // Room Management
    canManageRooms: true,
    canEditRoomStatus: true,
    canAllocateRooms: true,
    
    // Payment Management
    canViewPayments: true,
    canInitiatePayments: false,
    canMarkPaymentManual: true,
    canViewRevenue: true,
    canExportPaymentReport: true,
    
    // Attendance
    canViewAttendance: true,
    canInitiateAttendance: true,
    canOverrideAttendance: false,
    
    // Leave Management
    canApproveLeaves: true,
    canRejectLeaves: true,
    canViewLeaveAnalytics: true,
    
    // Complaints
    canViewComplaints: true,
    canAssignComplaints: true,
    canUpdateComplaintStatus: true,
    canDeleteComplaints: false,
    
    // Notifications
    canSendNotifications: true,
    canViewNotificationAnalytics: true,
    canViewPollResults: true,
    
    // Food Management
    canManageFoodSchedule: true,
    canViewFoodFeedback: true,
    
    // General
    canManageEmployees: false,  // Only owner
    isAdmin: false
  },
  
  // Assign to specific buildings/floors (optional)
  assignedBuildings: [
    ObjectId("507f1f77bcf86cd799439013"),
    ObjectId("507f1f77bcf86cd799439014")
  ],
  assignedFloors: [1, 2, 3],  // If null, assigned to all
  
  // Contact & Emergency
  phoneNumber: "+919876543210",
  alternatePhone: "+919876543211",
  emergencyContactName: "Spouse",
  emergencyContactPhone: "+919876543212",
  
  // Address
  address: "456 Apartment Street, Bangalore",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560035",
  
  // Bank Account (for salary)
  bankDetails: {
    accountHolderName: "Rajesh Kumar",
    accountNumber: "1234567890",  // Encrypted
    ifscCode: "IBKL0001",
    bankName: "ICICI Bank"
  },
  
  // Salary
  salary: {
    basicSalary: 20000,
    allowances: [
      { name: "HRA", amount: 5000 },
      { name: "DA", amount: 2000 }
    ],
    deductions: [
      { name: "PF", amount: 1800 }
    ],
    payrollFrequency: "Monthly",
    salaryAccount: "Active"
  },
  
  // Activity Log
  lastLogin: ISODate("2024-01-20T14:25:00Z"),
  loginCount: 156,
  failedLoginAttempts: 0,
  lastPasswordChangeBy: ObjectId("507f1f77bcf86cd799439011"),  // ref: Users
  
  // Status
  createdAt: ISODate("2023-06-01T10:30:00Z"),
  updatedAt: ISODate("2024-01-20T14:25:00Z"),
  isActive: true,
  isSuspended: false,
  suspensionReason: null
})

// Indexes
db.employees.createIndex({ employeeId: 1 })
db.employees.createIndex({ employeeCode: 1 })
db.employees.createIndex({ userId: 1 })
db.employees.createIndex({ hostelId: 1 })
db.employees.createIndex({ position: 1 })
db.employees.createIndex({ hostelId: 1, isActive: 1 })
```

### 2.8 PAYMENTS Collection

```javascript
db.payments.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439300"),
  paymentId: "PAY_001_2024",
  
  // References
  residentId: ObjectId("507f1f77bcf86cd799439100"), // ref: Residents
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  userId: ObjectId("507f1f77bcf86cd799439050"), // ref: Users
  
  // Amount Details
  amount: 5000,
  amountPaid: 5000,
  amountDue: 0,
  amountRefunded: 0,
  currency: "INR",
  
  // Period
  forPeriod: {
    startDate: ISODate("2024-01-15T00:00:00Z"),
    endDate: ISODate("2024-02-15T00:00:00Z"),
    frequencyType: "Monthly",  // enum: "Monthly" | "Quarterly" | "Yearly"
    periodNumber: 1  // which month/quarter/year
  },
  
  // Payment Status
  paymentStatus: "Success",  // enum: "Pending" | "Processing" | "Success" | "Failed" | "Refunded" | "Partial"
  paymentStatusHistory: [
    {
      status: "Pending",
      changedAt: ISODate("2024-01-15T10:30:00Z"),
      changedBy: "system"
    },
    {
      status: "Processing",
      changedAt: ISODate("2024-01-15T10:35:00Z"),
      changedBy: "razorpay"
    },
    {
      status: "Success",
      changedAt: ISODate("2024-01-15T10:40:00Z"),
      changedBy: "razorpay"
    }
  ],
  
  // Payment Method
  paymentMethod: "Razorpay",  // enum: "Razorpay" | "Manual" | "Check" | "BankTransfer" | "Cash"
  
  // Razorpay Integration
  razorpay: {
    orderId: "order_2024001",
    paymentId: "pay_2024001",
    signature: "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d",
    
    // Full response from Razorpay
    responseData: {
      id: "pay_2024001",
      entity: "payment",
      amount: 500000,  // in paise
      currency: "INR",
      status: "captured",
      method: "card",
      description: "Hostel Fee - Room #101",
      amountRefunded: 0,
      refundStatus: null,
      captured: true,
      description: "Monthly Hostel Fee",
      cardId: "card_2024001",
      bank: null,
      wallet: null,
      vpa: null,
      email: "john@example.com",
      contact: "+919876543200",
      notes: {
        residentId: "RES_001_2024",
        hostelId: "HST_001"
      },
      fee: 500,  // Razorpay fee in paise
      tax: 0,
      errorCode: null,
      errorDescription: null,
      errorSource: null,
      errorStep: null,
      errorReason: null,
      acquirerData: { auth_code: "999999" },
      createdAt: 1705317000
    }
  },
  
  // Manual Payment (if not via Razorpay)
  manualPayment: {
    isManual: false,
    mode: null,  // "Check" | "Cash" | "BankTransfer"
    referenceNumber: null,
    checkedBy: null,  // ref: Users
    verifiedAt: null
  },
  
  // Dates
  dueDate: ISODate("2024-02-15T00:00:00Z"),
  paidDate: ISODate("2024-01-15T10:40:00Z"),
  receiptGeneratedDate: ISODate("2024-01-15T10:41:00Z"),
  
  // Refund (if applicable)
  refundStatus: null,  // enum: null | "Pending" | "Processed"
  refundDate: null,
  refundReason: null,
  
  // Invoice
  invoiceNumber: "INV_001_2024",
  invoiceUrl: "https://cloudinary.com/invoice-001.pdf",
  receiptUrl: "https://cloudinary.com/receipt-001.pdf",
  
  // Notes & Remarks
  remarks: "Payment successful",
  internalNotes: "Standard payment",
  
  // Metadata
  createdAt: ISODate("2024-01-15T10:30:00Z"),
  updatedAt: ISODate("2024-01-15T10:41:00Z"),
  createdBy: ObjectId("507f1f77bcf86cd799439100")  // ref: Users (resident/employee)
})

// Indexes (Performance Critical)
db.payments.createIndex({ paymentId: 1 })
db.payments.createIndex({ residentId: 1 })
db.payments.createIndex({ hostelId: 1 })
db.payments.createIndex({ paymentStatus: 1 })
db.payments.createIndex({ residentId: 1, paidDate: -1 })
db.payments.createIndex({ hostelId: 1, createdAt: -1 })
db.payments.createIndex({ dueDate: 1, paymentStatus: 1 })  // For payment reminders
db.payments.createIndex({ "razorpay.paymentId": 1 })
```

### 2.9 ATTENDANCE_RECORDS Collection

```javascript
db.attendance_records.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439400"),
  attendanceId: "ATT_001_2024_01_20",
  
  // References
  residentId: ObjectId("507f1f77bcf86cd799439100"), // ref: Residents
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  buildingId: ObjectId("507f1f77bcf86cd799439013"), // ref: Buildings
  
  // Date & Time
  attendanceDate: ISODate("2024-01-20T00:00:00Z"),
  attendanceTime: "20:45",  // HH:MM format
  
  // Status
  status: "Present",  // enum: "Present" | "Absent" | "NotResponded" | "OnLeave" | "Excused"
  
  // Location Data (resident's location when marking attendance)
  locationData: {
    latitude: 12.9352,
    longitude: 77.6245,
    accuracy: 25,  // in meters
    timestamp: ISODate("2024-01-20T20:45:30Z"),
    source: "GPS",  // enum: "GPS" | "NetworkBased"
    isWithinGeofence: true
  },
  
  // Geofence Verification Details
  geofenceCheck: {
    hostelLocation: {
      type: "Point",
      coordinates: [77.6245, 12.9352]
    },
    geofenceRadius: 500,  // in meters
    distanceFromHostel: 120,  // in meters
    withinGeofence: true,
    
    // Calculation details (for debugging)
    calculatedDistance: 120.45,
    distanceCalculationMethod: "Haversine",
    verificationTimestamp: ISODate("2024-01-20T20:45:35Z")
  },
  
  // Notification & Response
  notificationSentAt: ISODate("2024-01-20T20:45:00Z"),
  notificationSentVia: ["PushNotification", "InApp"],  // Can be multiple
  responseReceivedAt: ISODate("2024-01-20T20:45:30Z"),
  responseType: "Manual",  // enum: "Manual" | "Auto"
  
  // Additional Info
  remarks: "Marked present from hostel location",
  isLateResponse: false,
  responseTimeSeconds: 30,  // seconds taken to respond
  
  // Leave Sync
  isOnApprovedLeave: false,
  approvedLeaveId: null,  // ref: Leave_Applications
  
  // Metadata
  createdAt: ISODate("2024-01-20T20:45:00Z"),
  updatedAt: ISODate("2024-01-20T20:45:35Z")
})

// Indexes (Very Performance Critical - High Write Volume)
db.attendance_records.createIndex({ attendanceId: 1 })
db.attendance_records.createIndex({ residentId: 1 })
db.attendance_records.createIndex({ hostelId: 1 })
db.attendance_records.createIndex({ residentId: 1, attendanceDate: -1 })
db.attendance_records.createIndex({ hostelId: 1, attendanceDate: -1 })
db.attendance_records.createIndex({ attendanceDate: 1 })
db.attendance_records.createIndex({ status: 1 })
db.attendance_records.createIndex({ createdAt: -1 })
db.attendance_records.createIndex({ hostelId: 1, attendanceDate: -1, status: 1 })  // Combined index for reports
```

### 2.10 LEAVE_APPLICATIONS Collection

```javascript
db.leave_applications.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439500"),
  leaveId: "LEV_001_2024",
  
  // References
  residentId: ObjectId("507f1f77bcf86cd799439100"), // ref: Residents
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  
  // Leave Details
  leaveType: "Medical",  // enum: "Sick" | "Personal" | "Medical" | "Emergency" | "Maternity" | "Paternity"
  fromDate: ISODate("2024-01-25T00:00:00Z"),
  toDate: ISODate("2024-01-27T23:59:59Z"),
  duration: 3,  // in days
  reason: "High fever and doctor consultation required",
  
  // Supporting Documents
  attachments: [
    {
      fileName: "medical-certificate.pdf",
      fileUrl: "https://cloudinary.com/medical-cert.pdf",
      fileType: "PDF",
      uploadedAt: ISODate("2024-01-25T10:30:00Z")
    }
  ],
  
  // Approval Workflow
  status: "Approved",  // enum: "Pending" | "Approved" | "Rejected" | "Cancelled"
  
  approvalDetails: {
    approvedBy: ObjectId("507f1f77bcf86cd799439200"), // ref: Users (manager/employee)
    approverName: "Rajesh Kumar",
    approvalDate: ISODate("2024-01-25T10:45:00Z"),
    approvalRemarks: "Medical leave approved with certificate",
    statusChangeTime: ISODate("2024-01-25T10:45:00Z")
  },
  
  // Rejection Details (if applicable)
  rejectionDetails: null,
  /*
  rejectionDetails: {
    rejectedBy: ObjectId("507f1f77bcf86cd799439200"),
    rejectionDate: ISODate("2024-01-25T10:45:00Z"),
    rejectionReason: "Leave duration exceeds policy limit"
  }
  */
  
  // Status History
  statusHistory: [
    {
      status: "Pending",
      changedAt: ISODate("2024-01-25T10:30:00Z"),
      changedBy: "system"
    },
    {
      status: "Approved",
      changedAt: ISODate("2024-01-25T10:45:00Z"),
      changedBy: ObjectId("507f1f77bcf86cd799439200")
    }
  ],
  
  // Metadata
  createdAt: ISODate("2024-01-25T10:30:00Z"),
  updatedAt: ISODate("2024-01-25T10:45:00Z")
})

// Indexes
db.leave_applications.createIndex({ leaveId: 1 })
db.leave_applications.createIndex({ residentId: 1 })
db.leave_applications.createIndex({ hostelId: 1 })
db.leave_applications.createIndex({ residentId: 1, fromDate: -1 })
db.leave_applications.createIndex({ status: 1 })
db.leave_applications.createIndex({ hostelId: 1, status: 1 })
db.leave_applications.createIndex({ fromDate: 1, toDate: 1 })
```

### 2.11 NOTIFICATIONS Collection

```javascript
db.notifications.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439600"),
  notificationId: "NTF_001_2024",
  
  // References
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  senderId: ObjectId("507f1f77bcf86cd799439011"), // ref: Users (owner/manager)
  
  // Content
  title: "Payment Due Reminder",
  message: "Your monthly hostel fee of ₹5000 is due on 2024-02-15",
  type: "Payment",  // enum: "Announcement" | "Attendance" | "Payment" | "Leave" | "Food" | "Emergency" | "Survey"
  
  // Recipients
  recipientType: "AllResidents",  // enum: "AllResidents" | "SelectedResidents" | "ByRoom" | "ByFloor" | "ByBuilding"
  recipients: [
    ObjectId("507f1f77bcf86cd799439100"),
    ObjectId("507f1f77bcf86cd799439101")
    // ... more resident IDs
  ],
  
  // Attachment (optional)
  attachmentUrl: null,
  
  // Poll Feature (if applicable)
  poll: {
    isPoll: true,
    pollType: "MultiChoice",  // enum: "MultiChoice" | "YesNo" | "Rating" | "OpenEnded"
    pollQuestion: "Did you receive the payment reminder?",
    pollOptions: ["Yes", "No", "Not applicable"],
    pollDeadline: ISODate("2024-01-25T23:59:59Z"),
    
    // Poll Responses
    pollResponses: [
      {
        respondentId: ObjectId("507f1f77bcf86cd799439100"), // ref: Residents
        respondentName: "John Student",
        selectedOption: "Yes",
        timestamp: ISODate("2024-01-20T21:15:00Z")
      }
    ],
    
    // Poll Analytics
    totalResponses: 25,
    responseRate: 0.55,  // 55%
    responseBreakdown: {
      "Yes": 20,
      "No": 3,
      "Not applicable": 2
    }
  },
  
  // View Tracking
  viewedBy: [
    {
      residentId: ObjectId("507f1f77bcf86cd799439100"),
      residentName: "John Student",
      viewedAt: ISODate("2024-01-20T20:45:00Z"),
      viewDuration: 45  // seconds
    }
  ],
  totalViewCount: 42,
  viewRate: 0.93,  // 93%
  
  // Delivery Tracking
  deliveryStatus: "Delivered",  // enum: "Queued" | "Sending" | "Delivered" | "Failed"
  deliverChannels: {
    inApp: {
      status: "Delivered",
      timestamp: ISODate("2024-01-20T20:45:00Z")
    },
    pushNotification: {
      status: "Delivered",
      timestamp: ISODate("2024-01-20T20:45:05Z")
    },
    email: {
      status: "Failed",
      reason: "Invalid email",
      timestamp: ISODate("2024-01-20T20:45:10Z")
    },
    whatsapp: {
      status: "Delivered",
      timestamp: ISODate("2024-01-20T20:45:15Z")
    }
  },
  
  // Immutability (CRITICAL for audit compliance)
  isEditable: false,
  isDeletable: false,
  editHistory: [],  // Empty for audit compliance
  
  // Metadata
  sentAt: ISODate("2024-01-20T20:45:00Z"),
  createdAt: ISODate("2024-01-20T20:45:00Z"),
  updatedAt: ISODate("2024-01-20T21:15:00Z"),
  
  // Tags for search/filter
  tags: ["payment", "reminder", "finance"]
})

// Indexes
db.notifications.createIndex({ notificationId: 1 })
db.notifications.createIndex({ hostelId: 1 })
db.notifications.createIndex({ senderId: 1 })
db.notifications.createIndex({ hostelId: 1, sentAt: -1 })
db.notifications.createIndex({ sentAt: -1 })
db.notifications.createIndex({ type: 1 })
db.notifications.createIndex({ recipients: 1 })  // For checking which notifications a user received
```

### 2.12 COMPLAINTS Collection

```javascript
db.complaints.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439700"),
  complaintId: "CMP_001_2024",
  
  // References
  residentId: ObjectId("507f1f77bcf86cd799439100"), // ref: Residents
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  
  // Complaint Details
  title: "Bathroom Maintenance Issue",
  description: "Water leakage from bathroom ceiling. Needs urgent repair.",
  category: "Maintenance",  // enum: "Maintenance" | "Cleanliness" | "Staff" | "Food" | "Safety" | "Other"
  priority: "High",  // enum: "Low" | "Medium" | "High" | "Critical"
  location: "Room 101 - Bathroom",
  
  // Attachments
  attachments: [
    {
      fileName: "bathroom-leak.jpg",
      fileUrl: "https://cloudinary.com/complaint-photo-1.jpg",
      fileType: "JPG",
      uploadedAt: ISODate("2024-01-20T20:45:00Z")
    }
  ],
  
  // Status Management
  status: "InProgress",  // enum: "Open" | "InProgress" | "OnHold" | "Resolved" | "Closed" | "RejectedApproximate"
  statusHistory: [
    {
      status: "Open",
      changedAt: ISODate("2024-01-20T20:45:00Z"),
      changedBy: "system",
      remarks: "Complaint registered"
    },
    {
      status: "InProgress",
      changedAt: ISODate("2024-01-21T09:00:00Z"),
      changedBy: ObjectId("507f1f77bcf86cd799439200"),
      remarks: "Contractor called, repair scheduled for tomorrow"
    }
  ],
  
  // Assignment
  assignedTo: ObjectId("507f1f77bcf86cd799439200"), // ref: Users (employee/manager)
  assignedBy: ObjectId("507f1f77bcf86cd799439011"), // ref: Users (owner)
  assignmentDate: ISODate("2024-01-21T09:00:00Z"),
  expectedResolutionDate: ISODate("2024-01-22T18:00:00Z"),
  
  // Resolution
  resolutionDate: null,
  resolutionNotes: null,
  resolutionVerifiedBy: null,  // ref: Users
  
  // Communication Log
  communicationLog: [
    {
      from: ObjectId("507f1f77bcf86cd799439100"),
      fromType: "Resident",
      message: "Is there any update on the repair?",
      timestamp: ISODate("2024-01-21T14:30:00Z")
    },
    {
      from: ObjectId("507f1f77bcf86cd799439200"),
      fromType: "Employee",
      message: "Contractor will arrive tomorrow at 10 AM",
      timestamp: ISODate("2024-01-21T15:00:00Z")
    }
  ],
  
  // Feedback (after resolution)
  residentFeedback: null,
  /*
  residentFeedback: {
    satisfactionRating: 4,  // 1-5
    comment: "Good job, issue resolved quickly",
    feedbackDate: ISODate("2024-01-22T18:30:00Z")
  }
  */
  
  // Metadata
  createdAt: ISODate("2024-01-20T20:45:00Z"),
  updatedAt: ISODate("2024-01-21T15:00:00Z")
})

// Indexes
db.complaints.createIndex({ complaintId: 1 })
db.complaints.createIndex({ residentId: 1 })
db.complaints.createIndex({ hostelId: 1 })
db.complaints.createIndex({ status: 1 })
db.complaints.createIndex({ hostelId: 1, status: 1 })
db.complaints.createIndex({ assignedTo: 1 })
db.complaints.createIndex({ priority: 1 })
db.complaints.createIndex({ createdAt: -1 })
```

### 2.13 FOOD_SCHEDULES Collection

```javascript
db.food_schedules.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439800"),
  foodScheduleId: "FD_001_2024_W03",
  
  // Reference
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  
  // Week Information
  weekNumber: 3,
  weekStartDate: ISODate("2024-01-15T00:00:00Z"),
  weekEndDate: ISODate("2024-01-21T23:59:59Z"),
  
  // Daily Schedule
  schedule: [
    {
      dayOfWeek: "Monday",
      date: ISODate("2024-01-15T00:00:00Z"),
      meals: [
        {
          mealType: "Breakfast",  // enum: "Breakfast" | "Lunch" | "Dinner" | "Snacks"
          time: "08:00-09:00",
          menu: "Idli, Sambar, Chutney",
          ingredients: ["Rice flour", "Urad dal", "Salt", "Oil"],
          calories: 300,
          dietaryTags: ["Vegetarian", "GlutenFree"],
          servingSize: "2 idlis",
          preparedBy: "Priya (Cook)",
          
          // Feedback
          feedback: [
            {
              residentId: ObjectId("507f1f77bcf86cd799439100"),
              residentName: "John Student",
              rating: 4,  // 1-5
              comment: "Good taste, could use more oil",
              timestamp: ISODate("2024-01-15T09:30:00Z")
            }
          ],
          averageRating: 4,
          totalFeedback: 28
        },
        {
          mealType: "Lunch",
          time: "13:00-14:00",
          menu: "Rice, Dal Makhani, Mixed Vegetables, Roti",
          ingredients: ["Basmati rice", "Kidney beans", "Spices", "Vegetables"],
          calories: 600,
          dietaryTags: ["Vegetarian"],
          servingSize: "1 plate",
          preparedBy: "Gopal (Chef)",
          feedback: []
        },
        {
          mealType: "Dinner",
          time: "19:00-20:00",
          menu: "Paratha, Curd, Salad",
          ingredients: ["Whole wheat flour", "Oil", "Yogurt", "Vegetables"],
          calories: 400,
          dietaryTags: ["Vegetarian"],
          servingSize: "2 parathas",
          preparedBy: "Priya (Cook)",
          feedback: []
        },
        {
          mealType: "Snacks",
          time: "16:00-17:00",
          menu: "Tea, Biscuits, Namkeen",
          ingredients: ["Tea leaves", "Milk", "Sugar", "Biscuits"],
          calories: 150,
          dietaryTags: ["Vegetarian"],
          servingSize: "1 cup + 2 biscuits",
          preparedBy: "Gopal (Chef)",
          feedback: []
        }
      ]
    },
    // ... 6 more days of similar structure
  ],
  
  // Schedule Type
  isVegetarian: true,
  isNonVegetarian: false,
  hasVeganOptions: true,
  hasGlutenFreeOptions: true,
  hasHalal: false,
  
  // Management
  createdBy: ObjectId("507f1f77bcf86cd799439200"), // ref: Users (manager)
  approvedBy: ObjectId("507f1f77bcf86cd799439011"), // ref: Users (owner)
  publishedAt: ISODate("2024-01-14T18:00:00Z"),
  
  // Notes
  specialNotes: "New chef joined this week, cuisine quality expected to improve",
  alternativeMeals: [
    {
      mainMeal: "Rice, Dal Makhani",
      alternativeMeal: "Wheat bread with Paneer",
      availableFor: ["Residents with food allergies"]
    }
  ],
  
  // Metadata
  createdAt: ISODate("2024-01-14T18:00:00Z"),
  updatedAt: ISODate("2024-01-21T20:00:00Z")
})

// Indexes
db.food_schedules.createIndex({ foodScheduleId: 1 })
db.food_schedules.createIndex({ hostelId: 1 })
db.food_schedules.createIndex({ weekStartDate: -1 })
db.food_schedules.createIndex({ hostelId: 1, weekStartDate: -1 })
```

### 2.14 AUDIT_LOGS Collection

```javascript
db.audit_logs.insertOne({
  _id: ObjectId("507f1f77bcf86cd799439900"),
  logId: "AUD_001_2024",
  
  // User & Context
  userId: ObjectId("507f1f77bcf86cd799439011"), // ref: Users
  userEmail: "owner@example.com",
  userRole: "owner",
  hostelId: ObjectId("507f1f77bcf86cd799439012"), // ref: Hostels
  
  // Action Details
  action: "UPDATE",  // enum: "CREATE" | "READ" | "UPDATE" | "DELETE" | "APPROVE" | "REJECT" | "EXPORT" | "LOGIN" | "LOGOUT"
  entityType: "Payment",  // Which collection was affected
  entityId: ObjectId("507f1f77bcf86cd799439300"), // ref: specific document
  
  // Data Changes
  oldData: {
    paymentStatus: "Pending",
    remarks: "Awaiting payment"
  },
  newData: {
    paymentStatus: "Success",
    remarks: "Payment successful"
  },
  
  // Request Details
  ipAddress: "192.168.1.100",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  requestMethod: "PUT",  // HTTP method
  endpoint: "/api/hostels/HST_001/payments/PAY_001_2024",
  responseStatus: 200,
  responseTime: 150,  // milliseconds
  
  // Additional Details
  changes: [
    {
      fieldName: "paymentStatus",
      oldValue: "Pending",
      newValue: "Success"
    },
    {
      fieldName: "remarks",
      oldValue: "Awaiting payment",
      newValue: "Payment successful"
    }
  ],
  
  // Status
  status: "Success",  // enum: "Success" | "Failed"
  errorMessage: null,
  
  // Metadata
  createdAt: ISODate("2024-01-20T20:45:00Z"),
  
  // Immutable TTL (auto-delete after 2 years for GDPR compliance)
  expiresAt: ISODate("2026-01-20T20:45:00Z")
})

// Indexes
db.audit_logs.createIndex({ logId: 1 })
db.audit_logs.createIndex({ userId: 1 })
db.audit_logs.createIndex({ hostelId: 1 })
db.audit_logs.createIndex({ action: 1 })
db.audit_logs.createIndex({ entityType: 1 })
db.audit_logs.createIndex({ createdAt: -1 })
db.audit_logs.createIndex({ userId: 1, createdAt: -1 })
db.audit_logs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })  // TTL Index
```

---

## 3. INDEXING STRATEGY

### 3.1 Index Performance Guidelines

```javascript
// Heavy Read Collections - More Indexes
db.residents.getIndexes()  // 8+ indexes expected

// Heavy Write Collections - Selective Indexes
db.attendance_records.getIndexes()  // Only essential indexes

// Medium Volume - Balanced
db.payments.getIndexes()  // 6-8 indexes
```

### 3.2 Index Creation Script

```javascript
// Collections initialization with all recommended indexes

// Users
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ whatsappNumber: 1 }, { unique: true })
db.users.createIndex({ userId: 1 }, { unique: true })
db.users.createIndex({ userType: 1 })
db.users.createIndex({ isActive: 1 })
db.users.createIndex({ createdAt: -1 })

// Hostels
db.hostels.createIndex({ hostelId: 1 }, { unique: true })
db.hostels.createIndex({ hostelCode: 1 }, { unique: true })
db.hostels.createIndex({ ownerId: 1 })
db.hostels.createIndex({ chainId: 1 })
db.hostels.createIndex({ location: "2dsphere" })
db.hostels.createIndex({ isActive: 1 })

// Buildings
db.buildings.createIndex({ buildingId: 1 })
db.buildings.createIndex({ hostelId: 1 })
db.buildings.createIndex({ hostelId: 1, isActive: 1 })

// Rooms
db.rooms.createIndex({ roomId: 1 })
db.rooms.createIndex({ hostelId: 1 })
db.rooms.createIndex({ buildingId: 1 })
db.rooms.createIndex({ hostelId: 1, roomStatus: 1 })
db.rooms.createIndex({ hostelId: 1, occupiedBeds: 1 })

// Beds
db.beds.createIndex({ bedId: 1 })
db.beds.createIndex({ roomId: 1 })
db.beds.createIndex({ currentResidentId: 1 })
db.beds.createIndex({ roomId: 1, bedStatus: 1 })

// Residents
db.residents.createIndex({ residentId: 1 })
db.residents.createIndex({ userId: 1 })
db.residents.createIndex({ hostelId: 1 })
db.residents.createIndex({ roomId: 1 })
db.residents.createIndex({ bedId: 1 })
db.residents.createIndex({ hostelId: 1, residentStatus: 1 })
db.residents.createIndex({ hostelId: 1, nextDueDate: 1 })
db.residents.createIndex({ email: 1 })

// Employees
db.employees.createIndex({ employeeId: 1 })
db.employees.createIndex({ employeeCode: 1 })
db.employees.createIndex({ userId: 1 })
db.employees.createIndex({ hostelId: 1 })
db.employees.createIndex({ position: 1 })
db.employees.createIndex({ hostelId: 1, isActive: 1 })

// Payments
db.payments.createIndex({ paymentId: 1 })
db.payments.createIndex({ residentId: 1 })
db.payments.createIndex({ hostelId: 1 })
db.payments.createIndex({ paymentStatus: 1 })
db.payments.createIndex({ residentId: 1, paidDate: -1 })
db.payments.createIndex({ hostelId: 1, createdAt: -1 })
db.payments.createIndex({ dueDate: 1, paymentStatus: 1 })
db.payments.createIndex({ "razorpay.paymentId": 1 })

// Attendance Records
db.attendance_records.createIndex({ attendanceId: 1 })
db.attendance_records.createIndex({ residentId: 1 })
db.attendance_records.createIndex({ hostelId: 1 })
db.attendance_records.createIndex({ residentId: 1, attendanceDate: -1 })
db.attendance_records.createIndex({ hostelId: 1, attendanceDate: -1 })
db.attendance_records.createIndex({ attendanceDate: 1 })
db.attendance_records.createIndex({ status: 1 })
db.attendance_records.createIndex({ createdAt: -1 })

// Leave Applications
db.leave_applications.createIndex({ leaveId: 1 })
db.leave_applications.createIndex({ residentId: 1 })
db.leave_applications.createIndex({ hostelId: 1 })
db.leave_applications.createIndex({ residentId: 1, fromDate: -1 })
db.leave_applications.createIndex({ status: 1 })
db.leave_applications.createIndex({ hostelId: 1, status: 1 })
db.leave_applications.createIndex({ fromDate: 1, toDate: 1 })

// Notifications
db.notifications.createIndex({ notificationId: 1 })
db.notifications.createIndex({ hostelId: 1 })
db.notifications.createIndex({ senderId: 1 })
db.notifications.createIndex({ hostelId: 1, sentAt: -1 })
db.notifications.createIndex({ sentAt: -1 })
db.notifications.createIndex({ type: 1 })
db.notifications.createIndex({ recipients: 1 })

// Complaints
db.complaints.createIndex({ complaintId: 1 })
db.complaints.createIndex({ residentId: 1 })
db.complaints.createIndex({ hostelId: 1 })
db.complaints.createIndex({ status: 1 })
db.complaints.createIndex({ hostelId: 1, status: 1 })
db.complaints.createIndex({ assignedTo: 1 })
db.complaints.createIndex({ priority: 1 })
db.complaints.createIndex({ createdAt: -1 })

// Food Schedules
db.food_schedules.createIndex({ foodScheduleId: 1 })
db.food_schedules.createIndex({ hostelId: 1 })
db.food_schedules.createIndex({ weekStartDate: -1 })
db.food_schedules.createIndex({ hostelId: 1, weekStartDate: -1 })

// Audit Logs
db.audit_logs.createIndex({ logId: 1 })
db.audit_logs.createIndex({ userId: 1 })
db.audit_logs.createIndex({ hostelId: 1 })
db.audit_logs.createIndex({ action: 1 })
db.audit_logs.createIndex({ entityType: 1 })
db.audit_logs.createIndex({ createdAt: -1 })
db.audit_logs.createIndex({ userId: 1, createdAt: -1 })
db.audit_logs.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
```

---

## 4. DATA RELATIONSHIPS & JOINS

### 4.1 Common Aggregation Pipeline Examples

```javascript
// Example 1: Get resident with full details (room, bed, hostel, payment history)
db.residents.aggregate([
  {
    $match: { residentId: "RES_001_2024" }
  },
  {
    $lookup: {
      from: "users",
      localField: "userId",
      foreignField: "_id",
      as: "userDetails"
    }
  },
  {
    $lookup: {
      from: "hostels",
      localField: "hostelId",
      foreignField: "_id",
      as: "hostelDetails"
    }
  },
  {
    $lookup: {
      from: "rooms",
      localField: "roomId",
      foreignField: "_id",
      as: "roomDetails"
    }
  },
  {
    $lookup: {
      from: "beds",
      localField: "bedId",
      foreignField: "_id",
      as: "bedDetails"
    }
  },
  {
    $lookup: {
      from: "payments",
      let: { resId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$residentId", "$$resId"] } } },
        { $sort: { createdAt: -1 } },
        { $limit: 12 }
      ],
      as: "paymentHistory"
    }
  },
  {
    $unwind: { path: "$userDetails", preserveNullAndEmptyArrays: true }
  },
  {
    $unwind: { path: "$hostelDetails", preserveNullAndEmptyArrays: true }
  }
])

// Example 2: Revenue Dashboard - Payment Summary
db.payments.aggregate([
  {
    $match: {
      hostelId: ObjectId("507f1f77bcf86cd799439012"),
      createdAt: { $gte: ISODate("2024-01-01"), $lt: ISODate("2024-02-01") }
    }
  },
  {
    $group: {
      _id: "$paymentStatus",
      count: { $sum: 1 },
      totalAmount: { $sum: "$amount" },
      averageAmount: { $avg: "$amount" }
    }
  },
  {
    $sort: { totalAmount: -1 }
  }
])

// Example 3: Attendance Report - Present vs Absent by Floor
db.attendance_records.aggregate([
  {
    $match: {
      hostelId: ObjectId("507f1f77bcf86cd799439012"),
      attendanceDate: {
        $gte: ISODate("2024-01-15"),
        $lt: ISODate("2024-01-22")
      }
    }
  },
  {
    $lookup: {
      from: "residents",
      localField: "residentId",
      foreignField: "_id",
      as: "residentDetails"
    }
  },
  {
    $unwind: "$residentDetails"
  },
  {
    $group: {
      _id: {
        floorNumber: "$residentDetails.buildingId",
        status: "$status"
      },
      count: { $sum: 1 }
    }
  },
  {
    $sort: { "_id.floorNumber": 1, "_id.status": 1 }
  }
])

// Example 4: Resident Activity - Last 7 Days
db.residents.aggregate([
  {
    $match: { hostelId: ObjectId("507f1f77bcf86cd799439012") }
  },
  {
    $facet: {
      attendanceStats: [
        {
          $lookup: {
            from: "attendance_records",
            let: { resId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$residentId", "$$resId"] },
                  attendanceDate: {
                    $gte: {
                      $dateSubtract: {
                        startDate: new Date(),
                        unit: "day",
                        amount: 7
                      }
                    }
                  }
                }
              }
            ],
            as: "recentAttendance"
          }
        },
        { $project: { _id: 1, fullName: 1, recentAttendance: 1 } }
      ],
      paymentStats: [
        {
          $lookup: {
            from: "payments",
            let: { resId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$residentId", "$$resId"] }
                }
              },
              { $sort: { createdAt: -1 } },
              { $limit: 1 }
            ],
            as: "lastPayment"
          }
        },
        { $project: { _id: 1, fullName: 1, lastPayment: 1 } }
      ]
    }
  }
])
```

---

## 5. QUERY OPTIMIZATION TIPS

### 5.1 Common Slow Queries & Solutions

```javascript
// SLOW: Full collection scan
db.residents.find({ hostelId: ObjectId("..."), residentStatus: "Active" })
// Solution: Ensure compound index exists
db.residents.createIndex({ hostelId: 1, residentStatus: 1 })

// SLOW: OR with non-indexed fields
db.payments.find({ $or: [{ paymentStatus: "Success" }, { amount: 5000 }] })
// Solution: Use indexed field only
db.payments.find({ paymentStatus: "Success", amount: 5000 })

// SLOW: Unindexed sort
db.attendance_records.find({ residentId: ObjectId("...") }).sort({ attendanceDate: -1 }).limit(100)
// Solution: Ensure index matches sort order
db.attendance_records.createIndex({ residentId: 1, attendanceDate: -1 })

// SLOW: Large dataset aggregation
db.attendance_records.aggregate([{ $match: {} }, { $group: {...} }])
// Solution: Filter early
db.attendance_records.aggregate([
  { $match: { createdAt: { $gte: ISODate("...") } } },
  { $group: {...} }
])
```

---

## 6. DATA VALIDATION RULES

### 6.1 Collection-Level Validations

```javascript
// Residents - Enforce KYC before fee collection
db.createCollection("residents", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["residentId", "hostelId", "userId", "fullName"],
      properties: {
        residentId: { bsonType: "string" },
        hostelId: { bsonType: "objectId" },
        feeAmount: {
          bsonType: "number",
          minimum: 0,
          maximum: 500000
        },
        kyc: {
          bsonType: "object",
          properties: {
            kycStatus: {
              enum: ["Pending", "Verified", "Rejected"]
            }
          }
        }
      }
    }
  }
})
```

---

**Document Version:** 1.0  
**Last Updated:** April 2026  
**Total Collections:** 14  
**Recommended Indexes:** 80+