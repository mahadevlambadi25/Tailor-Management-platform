# SaaS Subscription Billing System — Implementation Plan

## Overview
Enable tailors and shop owners to subscribe to our SaaS platform and pay SaaS subscription fees (separate from in-shop customer orders). Built on top of the existing Subscription and Tenant architecture.

---

## Architecture Plan

### 1. Prisma Schema Updates
Add two dedicated SaaS billing models without touching or breaking existing customer order models (`Payment` and `Invoice`):
- **`SubscriptionPayment`** (`@@map("subscription_payments")`):
  - `id` (UUID)
  - `tenantId` (FK -> Tenant)
  - `subscriptionId` (FK -> Subscription)
  - `provider` (default "razorpay")
  - `orderId` (Razorpay order ID, e.g. `order_xxx`)
  - `paymentId` (Razorpay payment ID, e.g. `pay_xxx`)
  - `signature` (HMAC signature)
  - `amount` (Decimal 10,2)
  - `currency` (default "INR")
  - `status` (`SubscriptionPaymentStatus`: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`)
  - `planName` (e.g. `STARTER`, `PROFESSIONAL`, `BUSINESS`, `ENTERPRISE`)
  - `billingPeriod` ("MONTHLY", "ANNUAL")
  - `periodStart`, `periodEnd` (DateTime)
  - `paidAt` (DateTime)
  - `failureReason` (String)
  - `metadata` (Json)
  - Relations & Indexes: `@@index([tenantId])`, `@@index([orderId])`, `@@index([paymentId])`, `@@index([status])`

- **`SubscriptionInvoice`** (`@@map("subscription_invoices")`):
  - `id` (UUID)
  - `tenantId` (FK -> Tenant)
  - `subscriptionId` (FK -> Subscription)
  - `paymentId` (FK -> SubscriptionPayment, @unique)
  - `invoiceNumber` (e.g. `INV-SUB-2026-XXXX`)
  - `planName` (String)
  - `amount` (Decimal 10,2)
  - `currency` (default "INR")
  - `status` (`SubscriptionInvoiceStatus`: `ISSUED`, `PAID`, `VOID`)
  - `billingPeriodStart`, `billingPeriodEnd` (DateTime)
  - `paidAt` (DateTime)
  - `providerPaymentId` (String)
  - `customerName` (Tenant name)
  - `customerEmail` (Tenant email)
  - `billingAddress` (Tenant address)
  - `pdfUrl` (String?)
  - Relations & Indexes: `@@unique([tenantId, invoiceNumber])`, `@@index([tenantId])`, `@@index([status])`

- **Enums**:
  - `SubscriptionPaymentStatus`: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`
  - `SubscriptionInvoiceStatus`: `ISSUED`, `PAID`, `VOID`

- Push changes to PostgreSQL via `prisma db push` and generate Prisma Client with `prisma generate`.

---

### 2. Backend Billing Service & Controllers
- **`billingService.ts`**:
  - `createCheckoutTransaction(tenantId, planName)`: Server calculates amount from `SUBSCRIPTION_PLANS`, creates Razorpay order, records `SubscriptionPayment` with `PENDING`.
  - `processPaymentSuccess(tenantId, params)`: Verifies HMAC signature, updates `SubscriptionPayment` to `SUCCESS`, creates `SubscriptionInvoice`, activates subscription, triggers idempotent `purgeTenantDemoData`.
  - `processPaymentFailure(tenantId, params)`: Records `FAILED` status and failureReason.
  - `getTenantTransactions(tenantId)`: Tenant-scoped list of billing transactions.
  - `getTenantInvoices(tenantId)`: Tenant-scoped list of SaaS invoices.
  - `getTenantInvoiceById(tenantId, invoiceId)`: Enforces tenant isolation, returns invoice details with payment and tenant data.
- **`subscriptionsController.ts` & `subscriptionsRoutes.ts`**:
  - `POST /subscriptions/checkout`: Creates Razorpay order and pending `SubscriptionPayment`.
  - `POST /subscriptions/verify-payment`: Verifies HMAC, marks transaction SUCCESS, creates invoice, activates subscription.
  - `POST /subscriptions/webhook`: Signature verified, handles `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` with idempotency.
  - `GET /subscriptions/transactions`: List billing history.
  - `GET /subscriptions/invoices`: List SaaS invoices.
  - `GET /subscriptions/invoices/:id`: Single SaaS invoice detail.

---

### 3. Frontend Enhancements (`SubscriptionPage.tsx`)
- Display current subscription status, trial countdown, and active period.
- Upgrade / Reactivate plan selection and Razorpay checkout modal with safe script loader.
- **Billing History Section**: Table showing date, plan, amount, payment ID, status badge (`SUCCESS`, `PENDING`, `FAILED`).
- **Invoices Section**: List of invoices with invoice number, billing period, amount, status (`PAID`), and "View Invoice" action.
- **Interactive Invoice Modal**: Clean, printable invoice displaying Shop details, Plan, Amount, Currency, Period, Transaction Reference, and Print/Download trigger.
- Clear error handling for payment failures and cancellations.

---

### 4. Comprehensive Testing & Verification
- Test all 15 scenarios specified in Phase 11.
- Run `npm test` (`master_test.ts`), `test_subscription_architecture.ts`, and our new `test_saas_billing_system.ts`.
- Run `npm run build` on both backend and frontend to guarantee 0 regressions.
