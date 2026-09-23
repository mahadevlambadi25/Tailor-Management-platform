# Implementation Plan: Payment & Billing Management Module

> **IMPORTANT NOTICE: MANUAL PAYMENT RECORDING ONLY**  
> This module is strictly designed for maintaining customer billing and manual payment ledger records within the tailor shop.  
> Customers will **NOT** pay online through the website. There are **NO** payment gateways, checkout pages, payment links, Razorpay/Stripe integrations, or online payment collections. Shop staff manually record how the customer paid (CASH, UPI, CARD, BANK_TRANSFER, OTHER).  
> SaaS subscription billing is completely separate and not part of this module.

---

## 1. Existing Architecture Findings

1. **Prisma Models & Fields**:
   - **`Payment`** (`prisma.payment`):
     - `id String @id @default(uuid())`
     - `tenantId String`
     - `orderId String`
     - `customerId String`
     - `amount Decimal @db.Decimal(10, 2)`
     - `paymentMethod PaymentMethod @default(CASH)` (Enum: `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`)
     - `referenceNumber String?`
     - `recordedById String?`
     - `notes String?`
     - `isRefund Boolean @default(false)`
     - `isCorrection Boolean @default(false)`
     - `createdAt DateTime @default(now())`
     - `updatedAt DateTime @updatedAt`
     - Relations: `customer`, `order`, `tenant`, `receipts Receipt[]`.
     - Indexes: `@@index([tenantId, orderId])`, `@@index([tenantId, customerId])`.
   - **`Order`** (`prisma.order`):
     - `totalAmount Decimal @db.Decimal(10, 2)` (Gross Amount)
     - `discountType DiscountType @default(FIXED)`
     - `discountValue Decimal @default(0.0) @db.Decimal(10, 2)`
     - `discountAmount Decimal @default(0.0) @db.Decimal(10, 2)`
     - `netAmount Decimal @db.Decimal(10, 2)` (Final Amount)
     - `gstRate Decimal @default(0.0) @db.Decimal(5, 2)`
     - `gstAmount Decimal @default(0.0) @db.Decimal(10, 2)`
     - `isGstInclusive Boolean @default(false)`
     - `paidAmount Decimal @default(0.0) @db.Decimal(10, 2)` (Total Successful Payments)
     - `balanceAmount Decimal @db.Decimal(10, 2)` (Balance Due)
     - `paymentStatus PaymentStatus @default(UNPAID)` (Enum: `UNPAID`, `PARTIAL`, `PAID`, `OVERPAID`, `REFUNDED`)
   - **`Receipt`** (`prisma.receipt`):
     - `id String @id @default(uuid())`
     - `tenantId String`
     - `paymentId String`
     - `receiptNumber String` (e.g. `REC-2026-100X`)
     - `amount Decimal @db.Decimal(10, 2)`
     - `pdfUrl String?`
     - `createdAt DateTime @default(now())`
   - **`AuditLog`** (`prisma.auditLog`):
     - Audits financial actions: `tenantId`, `userId`, `customerId`, `action`, `entity`, `entityId`, `details`, `createdAt`.
   - **`RoleType`**:
     - `SHOP_OWNER`, `MANAGER`, `RECEPTIONIST`, `TAILOR`, `CUTTER`, `FINISHER`, `CASHIER`, `CUSTOMER`.

2. **Existing Endpoints**:
   - `GET /api/v1/payments`: Lists payments with pagination, orderId, and customerId filters.
   - `POST /api/v1/payments`: Records a payment and recalculates order balance.
   - Advance payment during order intake in `POST /api/v1/orders`.

3. **Existing UI**:
   - `frontend/src/pages/payments/PaymentsPage.tsx`: Financial ledger table.
   - `frontend/src/pages/orders/OrderDetailPage.tsx`: Commercial summary, payment history table, in-place payment modal.
   - `frontend/src/pages/documents/PrintableShellPage.tsx`: Print shell supporting `docType=RECEIPT`.

---

## 2. Existing Payment Functionality

- `POST /api/v1/payments` accepts:
  - `orderId`, `amount`, `paymentMethod` (defaults to CASH), `referenceNumber`, `notes`, `isRefund`, `isCorrection`.
- Recalculates order balance:
  - `totalPaid = allPayments.reduce((sum, p) => p.isRefund ? sum - Number(p.amount) : sum + Number(p.amount), 0)`.
  - `newBalance = Number(order.netAmount) - totalPaid`.
  - Updates `order.paidAmount`, `order.balanceAmount`, and `order.paymentStatus`.
- Creates a `Receipt` record with sequential receipt number (`REC-YYYY-XXXX`).
- Logs `AuditLog` entry (`PAYMENT_RECORDED` or `PAYMENT_REFUNDED`).

---

## 3. Missing Functionality

1. **Validation Gaps**:
   - **Overpayment Prevention**: Does NOT prevent payments exceeding remaining balance. (If balance is ₹3,000 and user enters ₹4,000, it currently accepts it and sets status to `OVERPAID`). Must reject with HTTP 400: `"Payment amount cannot exceed the remaining balance."`
   - **Non-positive Amount**: Does NOT reject zero or negative amounts with a clear message (`amount <= 0`). Must reject with HTTP 400: `"Payment amount must be greater than 0."`
   - **Payment Method Validation**: Does NOT validate against valid payment methods (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`).
2. **Payment Cancellation & Reversal**:
   - No payment cancellation/reversal endpoint exists.
   - No mechanism for Shop Owners or Managers to reverse an erroneously recorded payment with audit logging.
3. **Missing Order-Scoped Payment Endpoints**:
   - Missing `GET /orders/:orderId/payments` (clean RESTful payment history for a specific order).
   - Missing `POST /orders/:orderId/payments` (record payment directly against an order).
   - Missing `GET /payments/:id` (inspect specific payment details and receipt metadata).
4. **RBAC Hardening**:
   - Payment cancellation/reversal must be strictly restricted to `SHOP_OWNER` and `MANAGER`.
   - `CASHIER` and `RECEPTIONIST` can record payments but must be blocked from cancelling payments.
   - `TAILOR`, `CUTTER`, `FINISHER` must be blocked from all payment creation and modification.
5. **Printable Payment Receipt Experience**:
   - `OrderDetailPage` and `PaymentsPage` lack a direct, lightweight "Print Receipt" modal/trigger for individual payment transactions.
   - Needs a clean printable format showing: Shop Name, Address, GSTIN, Customer details, Order Number, Payment Date, Payment Amount, Payment Method, Reference Number, Total Order Amount, Total Paid So Far, Remaining Balance Due, and "Received By" staff name.
6. **Delivery Integration**:
   - No visual warning/badge in the Production Board or Order Detail before marking an order as `DELIVERED` when an outstanding balance remains.
7. **Dashboard / Reports Metrics**:
   - Missing Today's Collection metric, Payment Method breakdown (Cash, UPI, Card, Bank Transfer, Other), and order payment status breakdown (Fully Paid, Partially Paid, Unpaid).

---

## 4. Database Changes

> [!IMPORTANT]
> **ZERO DATABASE SCHEMA CHANGES OR PRISMA MIGRATIONS ARE REQUIRED.**

- **`Payment` model**: Already contains `id`, `tenantId`, `orderId`, `customerId`, `amount`, `paymentMethod`, `referenceNumber`, `recordedById`, `notes`, `isRefund`, `isCorrection`, `createdAt`, `updatedAt`, `receipts`.
- **`Order` model**: Already contains `totalAmount`, `discountAmount`, `gstAmount`, `netAmount`, `paidAmount`, `balanceAmount`, `paymentStatus`.
- **`PaymentMethod` enum**: Already has `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`.
- **`PaymentStatus` enum**: Already has `UNPAID`, `PARTIAL`, `PAID`, `OVERPAID`, `REFUNDED`.
- **Cancellation & Reversals**: Double-entry accounting reversal entries using `isRefund = true`, `isCorrection = true` seamlessly utilize existing fields and reduction formulas without touching the database schema.

---

## 5. Backend Changes

### A. New Helper Service: `paymentCalculationService.ts`
- **`calculateOrderBilling(netAmount: Decimal | number, payments: Payment[]): BillingSummary`**:
  - Centralized single source of truth for all billing math.
  - Calculates `totalPaid`, `balanceDue`, `paymentStatus`.
  - Handles Decimal / 2-decimal precision rounding to eliminate floating-point errors.
- **`validatePaymentInput(order: Order, amount: number, paymentMethod: string): { valid: boolean; error?: string; code?: string }`**:
  - Rejects `amount <= 0` with code `INVALID_AMOUNT`.
  - Rejects `amount > order.balanceAmount` with code `EXCEEDS_BALANCE` ("Payment amount cannot exceed the remaining balance.").
  - Rejects invalid payment methods with code `INVALID_PAYMENT_METHOD`.

### B. Controller Enhancements: `paymentsController.ts`
- **`recordPayment`**:
  - Enforce positive amount validation.
  - Enforce overpayment validation against remaining balance.
  - Validate payment method.
  - Lock transaction with `prisma.$transaction`.
  - Update `order.paidAmount`, `order.balanceAmount`, `order.paymentStatus`.
  - Generate receipt (`REC-YYYY-XXXX`).
  - Log `AuditLog` entry (`PAYMENT_RECORDED`).
- **`getById`** (`GET /payments/:id`):
  - Strictly tenant-scoped (`where: { id, tenantId }`).
  - Includes order, customer, receipts, and recordedBy user (`select: { id, name, role }`).
  - Returns 404 if cross-tenant or not found.
- **`cancelPayment`** (`POST /payments/:id/cancel`):
  - Restricted to `SHOP_OWNER` and `MANAGER`.
  - Requires mandatory `reason` (non-empty string).
  - Verifies payment belongs to tenant and is not already a reversal.
  - Creates an offsetting reversal payment:
    - `amount: original.amount`
    - `isRefund: true`
    - `isCorrection: true`
    - `notes: "[CANCELLED/REVERSED]: " + reason`
    - `recordedById: req.user?.id`
  - Recalculates order balance and status.
  - Logs `AuditLog` entry: `PAYMENT_CANCELLED` with original payment ID, reversal payment ID, order number, amount, reason, and actor.
- **`getOrderPayments`** (`GET /orders/:orderId/payments`):
  - Retrieves order billing summary and list of payment transactions with tenant scoping.

### C. Route Updates: `paymentsRoutes.ts` & `ordersRoutes.ts`
- `paymentsRoutes.ts`:
  - `GET /`: List tenant payments.
  - `GET /:id`: Get single payment with receipt details.
  - `POST /`: Record payment (`SHOP_OWNER`, `MANAGER`, `CASHIER`, `RECEPTIONIST`).
  - `POST /:id/cancel`: Cancel/reverse payment (`SHOP_OWNER`, `MANAGER` only).
- `ordersRoutes.ts`:
  - `GET /:orderId/payments`: Get payments for order.
  - `POST /:orderId/payments`: Record payment for order.

### D. Reports Controller: `reportsController.ts`
- Update `getOwnerDashboard` and `getManagerDashboard`:
  - `todayCollection`: Net collected today (payments created today minus refunds created today).
  - `paymentMethodBreakdown`: Aggregated collection grouped by `paymentMethod` (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`).
  - `orderBillingStats`: Counts of `fullyPaidOrders` (`paymentStatus = PAID`), `partiallyPaidOrders` (`paymentStatus = PARTIAL`), and `unpaidOrders` (`paymentStatus = UNPAID`).

---

## 6. API Design

| Method | Endpoint | Description | Request Body | Roles Allowed | Status Codes |
|--------|----------|-------------|--------------|---------------|--------------|
| `GET` | `/api/v1/payments` | List tenant payments with pagination and filters | Query: `orderId`, `customerId`, `page`, `limit`, `paymentMethod`, `startDate`, `endDate` | `SHOP_OWNER`, `MANAGER`, `CASHIER`, `RECEPTIONIST` | `200`, `401` |
| `GET` | `/api/v1/payments/:id` | Get single payment details, receipt metadata, and recordedBy staff | None | `SHOP_OWNER`, `MANAGER`, `CASHIER`, `RECEPTIONIST` | `200`, `401`, `404` |
| `POST` | `/api/v1/payments` | Record a manual payment against an order | `{ orderId, amount, paymentMethod, referenceNumber?, notes? }` | `SHOP_OWNER`, `MANAGER`, `CASHIER`, `RECEPTIONIST` | `201`, `400`, `401`, `404` |
| `GET` | `/api/v1/orders/:orderId/payments` | Get order payment history and billing summary | None | `SHOP_OWNER`, `MANAGER`, `CASHIER`, `RECEPTIONIST` | `200`, `401`, `404` |
| `POST` | `/api/v1/orders/:orderId/payments` | Add payment directly referencing order URL | `{ amount, paymentMethod, referenceNumber?, notes? }` | `SHOP_OWNER`, `MANAGER`, `CASHIER`, `RECEPTIONIST` | `201`, `400`, `401`, `404` |
| `POST` | `/api/v1/payments/:id/cancel` | Cancel / reverse a recorded payment with mandatory reason | `{ reason: string }` | `SHOP_OWNER`, `MANAGER` | `200`, `400`, `401`, `403`, `404` |

---

## 7. Frontend Changes

### A. Order Detail Page (`OrderDetailPage.tsx`)
1. **Billing Summary Box**:
   - Structured display matching requirements:
     - Gross Amount: `₹6,000`
     - Discount: `-₹500`
     - GST: `+₹275`
     - Final Amount: `₹5,775`
     - Paid: `₹2,500`
     - Balance Due: `₹3,275`
     - Status Badge: `UNPAID` / `PARTIALLY PAID` / `FULLY PAID`
2. **Payment History Table**:
   - Date | Amount | Method | Reference | Received By | Type | Actions
   - Actions:
     - 🖨️ **Print Receipt**: Opens lightweight printable receipt modal for the specific payment.
     - ↩️ **Cancel Payment**: Accessible only to Shop Owner and Manager, prompting for mandatory cancellation reason.
3. **Add Payment Modal**:
   - Fields: Amount (₹), Payment Method (CASH, UPI, CARD, BANK_TRANSFER, OTHER), Payment Date, Reference Number (optional), Payment Notes (optional).
   - Real-time client-side validation:
     - Pre-fills with remaining balance.
     - Automatically caps maximum value to remaining balance.
     - Displays error if `amount <= 0` or `amount > remaining balance`.
4. **Printable Payment Receipt Modal (`PaymentReceiptModal.tsx`)**:
   - Clean, lightweight printable receipt designed for standard A4/A5 or POS receipt printing.
   - Includes:
     - Shop Name, Address, Phone, GSTIN.
     - Customer Name, Phone Number.
     - Order Number, Receipt Number, Payment Date.
     - Payment Amount & Method (e.g. `₹2,500 • UPI (Ref: UPI-98765)`).
     - Order Net Total, Total Paid So Far, Remaining Balance Due.
     - "Received By: [Staff Name]".
     - Print button triggering browser `window.print()`.

### B. Payments Page (`PaymentsPage.tsx`)
- Add method filters: All, Cash, UPI, Card, Bank Transfer, Other.
- Search by Order #, Customer Name, Mobile, Receipt Number.
- Display "Received By" staff member.
- Add "Print Receipt" button on every row.
- Add "Cancel Payment" action for Shop Owner / Manager.

### C. Production Board & Delivery Integration (`ProductionBoardPage.tsx`)
- Display payment status badge on cards:
  - 🟢 **Fully Paid**
  - 🟡 **Partially Paid (Bal: ₹X)**
  - 🔴 **Unpaid (Bal: ₹X)**
- When advancing to `DELIVERED`, if balance > 0:
  - Show warning modal: *"Order ORD-2026-XXXX has an outstanding balance of ₹X. Settle payment now or proceed with delivery on credit?"*
  - Provides quick action: "+ Record Settlement Payment" or "Proceed with Delivery".
  - Does NOT silently block delivery.

### D. Dashboard Page (`DashboardPage.tsx`)
- Display Today's Collection KPI card.
- Display payment method distribution breakdown.
- Display counts of Fully Paid, Partially Paid, and Unpaid orders.

---

## 8. RBAC (Role-Based Access Control)

| Action | `SHOP_OWNER` | `MANAGER` | `CASHIER` | `RECEPTIONIST` | `TAILOR` / `CUTTER` / `FINISHER` | `CUSTOMER` |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|
| View Order Billing & Balance | Yes | Yes | Yes | Yes | Status only | Own orders only |
| Record Manual Payment | Yes | Yes | Yes | Yes | No | No |
| View Payment History | Yes | Yes | Yes | Yes | No | Own orders only |
| Print Payment Receipt | Yes | Yes | Yes | Yes | No | Yes |
| Cancel / Reverse Payment | Yes | Yes | No (403) | No (403) | No (403) | No (403) |
| Financial Reports & Dashboards | Yes | Yes | No | No | No | No |

---

## 9. Tenant Isolation

1. Every query strictly filters by `where: { tenantId: req.tenantId! }`.
2. When creating a payment:
   - Order is verified: `prisma.order.findFirst({ where: { id: orderId, tenantId } })`.
   - If order belongs to another tenant -> HTTP 404 (Order not found).
3. When cancelling a payment:
   - Payment is verified: `prisma.payment.findFirst({ where: { id: paymentId, tenantId } })`.
   - If payment belongs to another tenant -> HTTP 404 (Payment not found).
4. Cross-tenant reads and mutations are 100% blocked.

---

## 10. Billing Calculation Rules

- **Formulas**:
  $$\text{Subtotal} = \sum \text{totalItemPrice}$$
  $$\text{Subtotal After Discount} = \text{Subtotal} - \text{Discount Amount}$$
  $$\text{GST Amount} = \text{Subtotal After Discount} \times \frac{\text{gstRate}}{100}$$
  $$\text{Final Amount (netAmount)} = \text{Subtotal After Discount} + \text{GST Amount}$$
  $$\text{Paid Amount} = \sum_{\text{non-refund}} \text{Amount} - \sum_{\text{refund}} \text{Amount}$$
  $$\text{Balance Due} = \text{Final Amount} - \text{Paid Amount}$$
- **Status Determination**:
  - If $\text{Paid Amount} \le 0 \implies \text{UNPAID}$
  - If $0 < \text{Paid Amount} < \text{Final Amount} \implies \text{PARTIAL}$ (Partially Paid)
  - If $\text{Paid Amount} \ge \text{Final Amount} \implies \text{PAID}$ (Fully Paid)
- **Monetary Precision**: All math handled with 2-decimal precision (e.g. `Math.round(val * 100) / 100` or Prisma `Decimal`), ensuring zero IEEE floating point inaccuracies.

---

## 11. Payment History Design

Each payment record displays:
- **Receipt #**: e.g. `REC-2026-1015`
- **Date**: e.g. `23 Sep 2026, 04:30 PM`
- **Amount**: Formatted currency (e.g. `₹2,500.00`)
- **Method**: Badge (`CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `OTHER`)
- **Reference**: e.g. `UPI-88492048` or `Cheque #10492` (or "—" if cash)
- **Received By**: Name of the staff member who logged the payment
- **Type**: `PAYMENT` (Green) or `REVERSAL / REFUND` (Rose)
- **Actions**: Print Receipt, Cancel Payment (Owners/Managers only)

---

## 12. Receipt Design

A clean, responsive component `PaymentReceiptModal.tsx` optimized for standard browser printing (`@media print`):
- **Shop Brand Header**: Shop Name, Address, Phone, GSTIN.
- **Title**: Official Payment Receipt / Acknowledgement.
- **Receipt Information**: Receipt Number, Date, Received By.
- **Client Information**: Customer Name, Phone, Address.
- **Order Reference**: Order Number, Booking Date, Garment Description.
- **Financial Table**:
  - Total Order Final Amount: `₹5,775`
  - Previous Payments: `₹0`
  - This Payment Amount: `₹2,500` (Method: `UPI`, Ref: `UPI-99201`)
  - Total Paid To Date: `₹2,500`
  - Remaining Balance Due: `₹3,275`
- **Acknowledgment & Sign-Off**: "Computer generated payment receipt. Authorized signature: _____________"

---

## 13. Delivery Integration

- When an order item is marked `READY` or moved toward `DELIVERED`:
  - System inspects `order.paymentStatus` and `order.balanceAmount`.
  - Visual status pill:
    - 🟢 `Fully Paid (₹0 Balance)`
    - 🟡 `Partially Paid (Balance: ₹X)`
    - 🔴 `Unpaid (Balance: ₹X)`
  - If `balanceAmount > 0` upon delivery:
    - Frontend displays a confirmation modal with options:
      1. *"Collect Balance Now"* (opens Add Payment modal pre-filled with remaining balance).
      2. *"Deliver with Outstanding Balance"* (allows shop owner/manager or authorized staff to proceed).
  - Delivery is **never silently blocked**, preserving real-world workshop flexibility for trusted VIP clients.

---

## 14. Audit Logs

Audit trail entries recorded in `prisma.auditLog`:
1. **`PAYMENT_RECORDED`**:
   - `entity: 'Payment'`, `entityId: payment.id`
   - `details: { orderId, orderNumber, amount, paymentMethod, referenceNumber, previousBalance, newBalance, paymentStatus, recordedById, recordedByName }`
2. **`PAYMENT_CANCELLED`**:
   - `entity: 'Payment'`, `entityId: originalPaymentId`
   - `details: { orderId, orderNumber, originalPaymentId, reversalPaymentId, amount, cancellationReason, cancelledById, cancelledByName, newBalance, paymentStatus }`
3. **`PAYMENT_REFUNDED`**:
   - `entity: 'Payment'`, `entityId: refundPaymentId`
   - `details: { orderId, orderNumber, refundAmount, reason, refundedById, refundedByName, newBalance }`

---

## 15. Testing Strategy

Create dedicated test suite: `backend/tests/test_payments_module.ts`:

1. **Test 1: Advance Payment on Order Intake**: Validates initial advance payment recorded during order creation.
2. **Test 2: Partial Installment Payment**: Validates recording an intermediate payment against order balance.
3. **Test 3: Multiple Payments Reconciliation**: Verifies multiple payments correctly decrement the remaining balance.
4. **Test 4: Exact Full Balance Settlement**: Records exact balance payment, verifies balance becomes ₹0 and status transitions to `PAID`.
5. **Test 5: Overpayment Rejection**: Attempts payment of ₹4,000 against ₹3,000 balance -> rejects with HTTP 400 `"Payment amount cannot exceed the remaining balance."`
6. **Test 6: Zero Amount Rejection**: Attempts payment of ₹0 -> rejects with HTTP 400 `"Payment amount must be greater than 0."`
7. **Test 7: Negative Amount Rejection**: Attempts payment of -₹500 -> rejects with HTTP 400.
8. **Test 8: Invalid Payment Method Rejection**: Attempts invalid method -> rejects with HTTP 400.
9. **Test 9: Payment History Retrieval**: Fetches payment history via `GET /orders/:id/payments` and verifies receipt numbers, methods, and amounts.
10. **Test 10: Strict Cross-Tenant GET Rejection**: Cross-tenant payment inspection returns HTTP 404.
11. **Test 11: Strict Cross-Tenant Payment Creation Rejection**: Cannot record payment against another tenant's order (HTTP 404).
12. **Test 12: Payment Cancellation / Reversal (Owner/Manager)**: Cancels payment with mandatory reason, creates reversal entry, recalculates balance, and verifies order status changes from `PAID` back to `PARTIAL`.
13. **Test 13: RBAC Cancellation Protection**: Cashier/Receptionist/Tailor attempting payment cancellation is rejected with HTTP 403.
14. **Test 14: Comprehensive Audit Trail**: Confirms `PAYMENT_RECORDED` and `PAYMENT_CANCELLED` entries with full metadata.
15. **Test 15: Receipt Data Verification**: Validates generated receipt number and amounts.
16. **Test 16: Customer Regression Suite**: Reruns `test_customers_module.ts` (40 tests passed).
17. **Test 17: Order Regression Suite**: Reruns `test_orders_module.ts` (38 tests passed).
18. **Test 18: Production Regression Suite**: Reruns `test_production_module.ts` (53 tests passed).

---

## 16. Migration Safety

- **No Schema Migrations**: We are not running `prisma migrate dev` or modifying `schema.prisma`.
- **Existing Relations Preserved**: `Payment`, `Order`, `Customer`, `Tenant`, `Receipt` relations remain 100% intact.
- **Existing Tests Protected**: Existing Customer (40), Order (38), and Production (53) tests will continue passing without alteration.

---

## 17. Implementation Order

1. **Backend Billing Service**:
   - Create `backend/src/modules/payments/paymentCalculationService.ts`.
2. **Backend Controller & Routes**:
   - Update `paymentsController.ts` with overpayment validation, cancellation, `getById`, and `getOrderPayments`.
   - Update `paymentsRoutes.ts` and `ordersRoutes.ts` with role guards.
   - Update `reportsController.ts` with collection and method breakdown metrics.
3. **Backend Test Suite**:
   - Create and run `backend/tests/test_payments_module.ts`.
4. **Frontend Components**:
   - Create `PaymentReceiptModal.tsx` for lightweight printable receipts.
   - Update `OrderDetailPage.tsx` with Billing Summary, Add Payment modal validation, and cancellation.
   - Update `PaymentsPage.tsx` with filters, receipt triggers, and cancellation.
   - Update `ProductionBoardPage.tsx` with payment status badges and delivery balance warnings.
   - Update `DashboardPage.tsx` with collection metrics.
5. **Full Verification**:
   - Run payment tests, customer tests, order tests, production tests.
   - Run `npx tsc --noEmit` and `npm run build`.

---

## 18. Risks & Edge Cases

| Risk / Edge Case | Impact | Mitigation Strategy |
|------------------|--------|---------------------|
| Overpayment entered accidentally | Inaccurate financial balance | Strict rejection in backend (`amount > balanceAmount`) and frontend input clamping. |
| Floating point arithmetic drift | Decimal mismatch (e.g. ₹0.0000001 balance) | Centralized `paymentCalculationService` using 2-decimal rounded precision and Prisma `Decimal`. |
| Erroneous payment deletion | Audit & tax compliance violation | Deletion is forbidden. Only double-entry reversals (`isRefund: true`, `isCorrection: true`) with mandatory audit reasons by Owner/Manager. |
| Order delivered without settling balance | Uncollected revenue | Visual warning badges in production board and delivery confirmation modal prompting staff. |
| Cross-tenant payment creation | Critical security leak | Strict tenant isolation verified on every query and mutation (`where: { id: orderId, tenantId }`). |

---

PLAN ONLY — NO CODE CHANGES MADE
