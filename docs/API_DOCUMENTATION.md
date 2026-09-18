# Tailor Management System V1 ? REST API Reference

## 1. Request Standards & Headers
- **Base URL**: `/api/v1`
- **Mandatory Headers**:
  - `x-tenant-slug`: Subdomain slug of the atelier (e.g. `royal-bespoke` or `elite-stitching`).
  - `Authorization`: `Bearer <JWT_TOKEN>` (for authenticated endpoints).
  - `Content-Type`: `application/json`

---

## 2. Authentication & Session Endpoints

### 2.1 Staff Login
`POST /api/v1/auth/login`
- **Request Body**:
```json
{
  "email": "owner@royalbespoke.com",
  "password": "Password@123"
}
```
- **Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "name": "Vikramaditya Rao",
      "email": "owner@royalbespoke.com",
      "role": "SHOP_OWNER"
    },
    "permissions": ["CREATE_ORDER", "VIEW_FINANCIALS", ...]
  }
}
```

### 2.2 Customer Request OTP
`POST /api/v1/auth/customer/otp/request`
- **Request Body**:
```json
{
  "mobile": "9876543210"
}
```
- **Response 200 OK**:
```json
{
  "success": true,
  "message": "OTP sent successfully to registered mobile number",
  "devOtp": "123456"
}
```

### 2.3 Customer Verify OTP
`POST /api/v1/auth/customer/otp/verify`
- **Request Body**:
```json
{
  "mobile": "9876543210",
  "otp": "123456"
}
```
- **Response 200 OK**: Returns JWT token with role `CUSTOMER`.

---

## 3. Customer Management Endpoints

### 3.1 List Customers
`GET /api/v1/customers?search=Rajesh&page=1&limit=20`
- **Query Params**: `search`, `page`, `limit`, `status`
- **Required Permission**: `VIEW_CUSTOMERS`

### 3.2 Create Customer
`POST /api/v1/customers`
- **Request Body**:
```json
{
  "firstName": "Rajesh",
  "lastName": "Kumar",
  "phone": "9876543210",
  "email": "rajesh@example.com",
  "gender": "MALE",
  "notes": "Prefers classic drape."
}
```

### 3.3 Get Customer 11-Tab Profile
`GET /api/v1/customers/:id/tabs/:tabName`
- **Valid Tabs**: `overview`, `orders`, `measurements`, `trials`, `alterations`, `appointments`, `payments`, `fabrics`, `styles`, `notes`, `history`

### 3.4 Soft Delete Customer
`DELETE /api/v1/customers/:id`
- **Behavior**: Sets `deletedAt` timestamp; excludes customer from standard queries while preserving historical order attribution.

---

## 4. Orders & Measurement Snapshot Endpoints

### 4.1 Create Multi-Item Order
`POST /api/v1/orders`
- **Request Body**:
```json
{
  "customerId": "cust-uuid",
  "deliveryDueDate": "2026-09-20T18:00:00.000Z",
  "discountAmount": 500,
  "advancePaid": 3000,
  "paymentMethod": "UPI",
  "customerRemarks": "Ensure brass metal buttons on cuff",
  "internalNotes": "Fabric shrinkage pre-washed",
  "items": [
    {
      "garmentTypeId": "garment-uuid",
      "quantity": 1,
      "unitPrice": 4500,
      "styleOptions": {
        "Lapel": "Peak",
        "Pockets": "Slanted Flap",
        "Vent": "Double"
      },
      "measurements": {
        "Chest": 40,
        "Waist": 34,
        "Shoulder": 18.5,
        "Sleeve": 25
      }
    }
  ]
}
```
- **Response 201 Created**:
  - Automatically calculates net total: `4500 - 500 = 4000`
  - Records advance payment of `3000` and sets `balanceDue: 1000`
  - Saves deep copy of `measurements` into `OrderItemMeasurement.valuesSnapshot`.

### 4.2 Update Order Status (Enforced Delay Governance)
`PUT /api/v1/orders/:id/status`
- **Request Body**:
```json
{
  "status": "IN_PRODUCTION",
  "delayReason": "Waiting for pure cashmere lining import",
  "revisedDeliveryDate": "2026-09-25T18:00:00.000Z"
}
```
- **Validation**: If transitioning to delayed or late delivery, missing `delayReason` or `revisedDeliveryDate` will return `400 Bad Request`.

---

## 5. Production Kanban & Workshop

### 5.1 Get Kanban Board
`GET /api/v1/production/board?branchId=branch-uuid`
- **Response 200 OK**: Grouped columns: `PENDING`, `CUTTING`, `STITCHING`, `FINISHING`, `TRIAL_READY`, `READY_FOR_DELIVERY`.

### 5.2 Transition Item Stage
`PUT /api/v1/production/items/:itemId/status`
- **Request Body**:
```json
{
  "status": "STITCHING",
  "assignedToId": "tailor-uuid",
  "stageNotes": "Hand basting complete"
}
```

---

## 6. Document Generation & QR Verification

### 6.1 Get Print Payload
`GET /api/v1/documents/orders/:orderId/print?docType=JOB_CARD`
- **Supported `docType`**:
  - `JOB_CARD`: Detailed cutting measurements and style specs for tailors.
  - `INVOICE`: Tax invoice with GST breakdown, HSN/SAC code, and bank details.
  - `RECEIPT`: 80mm thermal receipt format for cashier checkout.
  - `CUTTING_SHEET`: Master fabric cutting specifications.
- **Response**: Includes SVG and base64 QR code verifying order token and portal link.

---

## 7. Customer Portal (Self-Service)

### 7.1 Get Customer's Orders
`GET /api/v1/customer-portal/orders`
- **Response**: Returns orders associated with authenticated customer's phone.
- **Privacy Shield**: All `internalNotes` are stripped.

### 7.2 Get Customer's Approved Measurements
`GET /api/v1/customer-portal/measurements`
- **Response**: List of master verified garment dimensions with approval stamps.
