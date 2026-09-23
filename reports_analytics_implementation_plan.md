# Implementation Plan: Reports & Operational Analytics Module

This document outlines the complete architectural design and implementation plan for the **Reports & Operational Analytics Module** in the Tailor Management SaaS platform.

> [!IMPORTANT]
> **Strict Business Constraints**:
> 1. **Manual Financial Records Only**: There are **zero** online payment gateways (no Razorpay, Stripe, payment links, webhooks, or online checkout). All financial reports analyze manual staff entries.
> 2. **Operational Intelligence, Not ERP**: Factual metrics for `SHOP_OWNER` and `MANAGER` to optimize shop-floor throughput, receivables, customer retention, and garment lead times. No AI forecasting, marketing attribution, or subjective staff ratings.
> 3. **Single Source of Truth**: Reuses existing centralized formulas ($\text{Gross} - \text{Discount} + \text{GST} = \text{Net}$; $\text{Net} - \text{Paid} = \text{Balance Due}$) without duplicate calculations.
> 4. **Strict Multi-Tenant Isolation**: 100% of queries and aggregations are scoped to `tenantId`.

---

## 1. Existing Architecture Findings

### A. Existing Codebase Audit
| Component | Existing Implementation | Reusability Assessment |
| :--- | :--- | :--- |
| **Reports Controller** | [`backend/src/modules/reports/reportsController.ts`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/backend/src/modules/reports/reportsController.ts) | Contains legacy `getOwnerDashboard`, `getManagerDashboard`, `getTailorDashboard`, and basic `getAnalytics`. Lacks date-range filtering, branch filtering, and granular module endpoints. |
| **Reports Routes** | [`backend/src/modules/reports/reportsRoutes.ts`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/backend/src/modules/reports/reportsRoutes.ts) | 4 routes guarded by `tenantContext`, `authGuard`, `subscriptionGuard`, `requireRoles`. |
| **Payment Ledger** | [`backend/src/modules/payments/paymentCalculationService.ts`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/backend/src/modules/payments/paymentCalculationService.ts) | Centralized billing math, precision rounding (`round2`), and double-entry reversal accounting. |
| **Production Jobs** | [`backend/src/modules/production/productionAssignmentService.ts`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/backend/src/modules/production/productionAssignmentService.ts) | Stage state machine and craft assignments (`cutterId`, `tailorId`, `finisherId`). |
| **Import / Export** | [`backend/src/modules/import-export/importExportController.ts`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/backend/src/modules/import-export/importExportController.ts) | Native CSV streaming for `CUSTOMERS`, `ORDERS`, `PAYMENTS`, `PRODUCTION`, `APPOINTMENTS`, and `MEASUREMENTS`. |
| **Branches** | [`backend/src/modules/branches/branchesController.ts`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/backend/src/modules/branches/branchesController.ts) | `Branch` model exists with `isMain`, `code`, `name`. `Order.branchId` and `User.branchId` exist in schema. |
| **Frontend Page** | [`frontend/src/pages/reports/ReportsPage.tsx`](file:///c:/Users/Reshma/Desktop/Tailor%20system%20application/frontend/src/pages/reports/ReportsPage.tsx) | Minimal static cards calling `/reports/analytics`. Needs date filters, tabbed reporting, KPI cards, charts, and branch selector. |

### B. What Already Exists and Can Be Reused
- `PaymentCalculationService.round2()` for rounding money to 2 decimal places.
- `ImportExportController.exportData` for CSV streaming.
- Existing Prisma enums: `OrderStatus`, `PaymentStatus` (`PAID`, `PARTIAL`, `UNPAID`), `PaymentMethod`, `ProductionStageName`.
- `formatCurrency` and `formatNumber` from `frontend/src/utils/currency.ts`.

---

## 2. Dashboard KPIs & Mathematical Definitions

All KPIs are strictly computed per `tenantId` (and optional `branchId`):

| KPI Name | Formula / Query Definition | Business Meaning |
| :--- | :--- | :--- |
| **Total Customers** | `COUNT(Customer)` where `tenantId = :tenantId AND isDeleted = false` | Total registered client base. |
| **New Customers** | `COUNT(Customer)` where `createdAt BETWEEN :start AND :end` | Growth in new client intake in date range. |
| **Total Orders** | `COUNT(Order)` where `tenantId = :tenantId AND isCancelled = false` | All active and historical orders. |
| **New Orders** | `COUNT(Order)` where `createdAt BETWEEN :start AND :end AND isCancelled = false` | Bookings created within the selected period. |
| **Orders In Progress** | `COUNT(Order)` where `status IN ['RECEIVED', 'IN_PROGRESS', 'TRIAL_PENDING', 'ALTERATION_PENDING']` | Active production workload on shop floor. |
| **Orders Ready for Pickup** | `COUNT(Order)` where `status = 'READY_FOR_PICKUP'` | Finished garments awaiting client pickup. |
| **Delivered Orders** | `COUNT(Order)` where `status = 'DELIVERED'` (or delivered within range) | Orders successfully handed over to clients. |
| **Delayed Orders** | `COUNT(Order)` where `deliveryDate < NOW() AND status NOT IN ['DELIVERED', 'CANCELLED']` | Orders breached or at risk of SLA breach. |
| **Pending Payment Orders** | `COUNT(Order)` where `paymentStatus IN ['UNPAID', 'PARTIAL'] AND isCancelled = false` | Number of orders with unpaid balances. |
| **Today's Collection** | $\sum \text{Payments today} - \sum \text{Reversals today}$ (00:00:00 to 23:59:59.999) | Net cash/UPI intake collected across desk today. |
| **Period Collection** | $\sum \text{Payments in range} - \sum \text{Reversals in range}$ | Total money collected in the selected date range. |
| **Total Revenue** | $\sum \text{Order.netAmount}$ for orders created in range (or all-time) | Gross commercial sales volume after discounts + GST. |
| **Outstanding Balance** | $\sum \text{Order.balanceAmount}$ where `isCancelled = false` | Total store accounts receivable across all active orders. |

---

## 3. Order Reports

Endpoint: `GET /api/v1/reports/orders`

### Metrics & Aggregations:
1. **Orders by Status**:
   - Count and total revenue per `OrderStatus`: `RECEIVED`, `IN_PROGRESS`, `TRIAL_PENDING`, `ALTERATION_PENDING`, `READY_FOR_PICKUP`, `DELIVERED`, `CANCELLED`.
2. **Orders by Garment Type**:
   - Aggregated via `OrderItem`: units tailored and total item price grouped by `garmentTypeId`.
   - Returns garment name, units count, revenue share.
3. **Orders by Date (Timeline)**:
   - Daily order count and daily net amount volume over the selected date range.
4. **Orders by Branch**:
   - If multi-branch is active, group order volume and revenue by `branchId` (with branch name/code).
5. **Key Averages & Ratios**:
   - **Average Order Value (AOV)**: $\frac{\text{Total Net Amount}}{\text{Total Orders}}$.
   - **On-Time Delivery Rate**: $\frac{\text{Delivered On or Before SLA}}{\text{Total Delivered Orders}} \times 100\%$.
   - **Cancellation Rate**: $\frac{\text{Cancelled Orders}}{\text{Total Bookings}} \times 100\%$.

---

## 4. Payment Reports

Endpoint: `GET /api/v1/reports/payments`

### Metrics & Aggregations:
1. **Total Collections**:
   - Gross collections, refunds/reversals, and net collections over the date range.
2. **Collection by Payment Method**:
   - Grouped by `paymentMethod`:
     - `CASH`: Total ₹ and transaction count.
     - `UPI`: Total ₹ and transaction count.
     - `CARD`: Total ₹ and transaction count.
     - `BANK_TRANSFER`: Total ₹ and transaction count.
     - `OTHER`: Total ₹ and transaction count.
3. **Payment Status Breakdown**:
   - Count of `FULLY_PAID` (`PAID`), `PARTIALLY_PAID` (`PARTIAL`), and `UNPAID` orders.
   - Total amount paid vs total balance due across all orders in range.
4. **Daily Collection Trend**:
   - Day-by-day cash intake vs UPI/digital collections for timeline visualization.

---

## 5. Production Reports

Endpoint: `GET /api/v1/reports/production`

### Metrics & Aggregations:
1. **Stage-Wise Garment Counts**:
   - `RECEIVED`: New intake awaiting cutting queue.
   - `CUTTING`: Fabric cutting queue.
   - `STITCHING`: Active tailoring queue.
   - `FINISHING`: Ironing, buttons, hem finishing.
   - `TRIAL`: Ready for customer fitting trial.
   - `ALTERATION`: Returned or scheduled for adjustment.
   - `READY`: Ready for customer handover.
   - `DELIVERED`: Handed over to client.
2. **Quality & Delay Tracking**:
   - Active delayed garments count (`isDelayed = true`).
   - Breakdown of top delay reasons (from `delayReason`).
3. **Craft Workload Distribution**:
   - Active job count assigned to `CUTTER` craft.
   - Active job count assigned to `TAILOR` craft.
   - Active job count assigned to `FINISHER` craft.

---

## 6. Customer Reports

Endpoint: `GET /api/v1/reports/customers`

### Metrics & Aggregations:
1. **Client Growth**:
   - Total registered client base.
   - New customers registered in selected date range.
2. **Customer Frequency**:
   - **First-Time Customers**: Customers with exactly 1 order.
   - **Repeat / Loyal Customers**: Customers with $\ge 2$ orders.
   - Repeat Customer Percentage: $\frac{\text{Repeat Customers}}{\text{Total Customers with Orders}} \times 100\%$.
3. **Account Health**:
   - Count of customers with active orders on floor.
   - Count of customers with outstanding unpaid balances.
4. **Privacy Protection**:
   - No personal PII (e.g. passwords, identity proofs) in analytics payloads.
   - Returns client ID, anonymized or first/last name, orders count, total spend, and balance due.

---

## 7. Staff Operational Reports

Endpoint: `GET /api/v1/reports/staff`

### Metrics & Aggregations:
1. **Factual Operational Tallies (Per Active Staff Member)**:
   - Staff Name and Role (`CUTTER`, `TAILOR`, `FINISHER`, `MANAGER`).
   - **Assigned Jobs**: Current active non-delivered jobs assigned.
   - **Completed Jobs**: Jobs moved to `READY` or `DELIVERED` by staff in date range.
   - **Delayed Jobs**: Jobs currently assigned where delivery date is overdue.
2. **Strict Guardrail**:
   - **Zero subjective performance scores**: No subjective star ratings, artificial KPI percentages, or judgmental metrics. Pure factual operational workload visibility.

---

## 8. Date Range Filtering & Timezone Strategy

### Presets Supported:
- `TODAY`: `00:00:00.000` to `23:59:59.999` of current day.
- `YESTERDAY`: `00:00:00.000` to `23:59:59.999` of yesterday.
- `THIS_WEEK`: Monday `00:00:00.000` to current moment.
- `THIS_MONTH`: 1st day of current month `00:00:00.000` to end of month.
- `LAST_MONTH`: 1st day of previous month to last day of previous month.
- `CUSTOM`: Validated `startDate` to `endDate` (inclusive).

### Standardized Date Utility:
- Create `backend/src/modules/reports/reportDateUtils.ts`:
  - `getDateRangeBounds(preset?: string, startDate?: string, endDate?: string)`
  - Guarantees `startDate <= endDate` and caps custom ranges to maximum 1 year to prevent runaway queries.
  - Safe date parsing that respects system local time without UTC offset drift.

---

## 9. API Design & Specification

All endpoints reside under `/api/v1/reports` and are secured by `tenantContext`, `authGuard`, and `subscriptionGuard`.

### Endpoint Roster:

#### 1. `GET /api/v1/reports/overview`
- **Query Params**: `range` (default `THIS_MONTH`), `startDate`, `endDate`, `branchId`
- **RBAC**: `SHOP_OWNER`, `MANAGER`, `RECEPTIONIST`, `CASHIER`
- **Response**: All 12 Dashboard KPIs (Customers, Orders, Production queues, Collections, Receivables).

#### 2. `GET /api/v1/reports/orders`
- **Query Params**: `range`, `startDate`, `endDate`, `branchId`
- **RBAC**: `SHOP_OWNER`, `MANAGER`, `RECEPTIONIST`
- **Response**: Status breakdown, garment breakdown, timeline trend, AOV, cancellation stats.

#### 3. `GET /api/v1/reports/payments`
- **Query Params**: `range`, `startDate`, `endDate`, `branchId`
- **RBAC**: `SHOP_OWNER`, `MANAGER`, `CASHIER`
- **Response**: Collections by method, payment status distribution, daily collections trend, receivables.

#### 4. `GET /api/v1/reports/production`
- **Query Params**: `range`, `startDate`, `endDate`, `branchId`
- **RBAC**: `SHOP_OWNER`, `MANAGER`, `TAILOR`, `CUTTER`, `FINISHER`
- **Response**: Stage-wise counts, delayed production jobs, craft workload distribution.

#### 5. `GET /api/v1/reports/customers`
- **Query Params**: `range`, `startDate`, `endDate`
- **RBAC**: `SHOP_OWNER`, `MANAGER`, `RECEPTIONIST`
- **Response**: Client growth, repeat vs first-time ratios, active client accounts, balances.

#### 6. `GET /api/v1/reports/staff`
- **Query Params**: `range`, `startDate`, `endDate`, `branchId`
- **RBAC**: `SHOP_OWNER`, `MANAGER`
- **Response**: Factual assigned, completed, and delayed counts by staff member and craft role.

---

## 10. Frontend Architecture & Visualizations

### A. Component Hierarchy:
```
ReportsPage.tsx
 ├── ReportsHeader (Title, Refresh, Export CSV Dropdown, Print View)
 ├── ReportsFilterBar (Preset Buttons: Today, This Week, This Month, Custom Date Pickers, Branch Select)
 ├── TabNavigation (Overview, Orders, Payments, Production, Customers, Staff)
 └── Tab Panels:
      ├── OverviewTab (KPI Cards Grid + Quick Highlights)
      ├── OrdersTab (Status Distribution, Garment Share, AOV, Daily Trend)
      ├── PaymentsTab (Collections by Method, Payment Status, Daily Inflow)
      ├── ProductionTab (Stage Pipeline Flow, Delayed Alerts, Workload)
      ├── CustomersTab (Retention Ratio, New Clients, Receivable Accounts)
      └── StaffTab (Workshop Staff Roster & Operational Tallies)
```

### B. Lightweight Built-in Visualizations (Zero External NPM Bloat):
- **Segmented Donut / Ring Chart**: Pure SVG circles using `stroke-dasharray` and `stroke-dashoffset` for payment method and order status distributions.
- **Horizontal Progress Bar Charts**: Tailored CSS bars for garment revenue breakdown and production stage pipeline.
- **Sparkline / Bar Timeline**: Clean SVG/HTML responsive daily bars for 14-day / 30-day order and collection trends.
- Responsive mobile layout: KPI cards collapse to 2 columns on mobile, tables scroll horizontally, and date filter tabs wrap cleanly.

---

## 11. Role-Based Access Control (RBAC) Matrix

| Endpoint / Tab | `SHOP_OWNER` | `MANAGER` | `CASHIER` | `RECEPTIONIST` | `TAILOR` / `CUTTER` / `FINISHER` | `CUSTOMER` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Overview KPIs** | Full | Full | Collections only | Operational only | 403 | 403 |
| **Order Reports** | Full | Full | 403 | Full | 403 | 403 |
| **Payment Reports**| Full | Full | Full | 403 | 403 | 403 |
| **Production Reports**| Full | Full | 403 | Stage counts | Own Tasks Only | 403 |
| **Customer Reports**| Full | Full | 403 | Full | 403 | 403 |
| **Staff Reports** | Full | Full | 403 | 403 | 403 | 403 |
| **CSV Exports** | Full | Full | Payments only | Orders/Cust only | 403 | 403 |

---

## 12. Tenant Isolation & Security

- **Strict Tenant Scoping**: Every query specifies `{ where: { tenantId } }`.
- **Branch Scoping**: When `branchId` is passed, it is strictly validated against `prisma.branch.findFirst({ where: { id: branchId, tenantId } })` before filtering orders. Cross-tenant branch injection returns 404 or empty.
- **Data Anonymization**: No credit card numbers, passwords, OTPs, or unnecessary PII are included in reporting responses.

---

## 13. Performance & Query Strategy

- **Database Aggregation**: Use Prisma `_count`, `_sum`, `groupBy`, and `aggregate`. Never pull 10,000 orders into Node.js memory just to calculate a total.
- **Parallel Query Execution**: Use `Promise.all()` to parallelize independent count and aggregate queries.
- **Index Optimization**:
  - `orders`: `(tenantId, status)`, `(tenantId, createdAt)`, `(tenantId, deliveryDate)`, `(tenantId, branchId)`.
  - `payments`: `(tenantId, createdAt)`, `(tenantId, paymentMethod)`.
  - `customers`: `(tenantId, createdAt)`, `(tenantId, isDeleted)`.
  - `production_jobs`: `(tenantId, currentStage)`, `(tenantId, assignedToId)`.

---

## 14. Export Strategy

1. **CSV Export**:
   - Reuse `ImportExportController.exportData` with query parameters `?startDate=&endDate=&branchId=`.
   - Update export queries to respect date range and branch filtering.
2. **Printable Executive Summary**:
   - Include browser print stylesheet (`@media print`) on `ReportsPage.tsx` so staff can print clean A4 summaries directly (`window.print()`).

---

## 15. Comprehensive Test Plan

Create `backend/tests/test_reports_module.ts` covering:
1. **Dashboard Overview KPIs**: Exact math verification on active tenant data.
2. **Date Range Filtering**: Test `TODAY`, `THIS_WEEK`, `THIS_MONTH`, and custom bounds. Verify boundary edge cases (orders at 23:59:59 included).
3. **Order Reports**: Status grouping, garment revenue share, average order value.
4. **Payment Reports**: Collections by method (Cash vs UPI vs Card), total receivables, paid vs partial vs unpaid order counts.
5. **Production Reports**: Stage counts, delayed job counts, craft workload.
6. **Customer Reports**: Total customers, new customers in range, repeat customer ratio.
7. **Staff Reports**: Factual task tallies per staff member.
8. **RBAC Gating**:
   - Cashier accessing payments -> 200; Cashier accessing staff reports -> 403.
   - Tailor accessing reports -> 403 (redirected to tailor dashboard).
   - Customer token accessing reports -> 403.
9. **Tenant Isolation**: Tenant 2 user calling Tenant 1 reports returns only Tenant 2 data.
10. **Regression Verification**:
    - `test_customers_module.ts` (40 tests)
    - `test_orders_module.ts` (38 tests)
    - `test_production_module.ts` (53 tests)
    - `test_payments_module.ts` (40 tests)
    - Backend TypeScript check (`npx tsc --noEmit`)
    - Frontend build (`npm run build`)

---

## 16. Implementation Steps Order

1. **Backend Date Utilities**: Create `backend/src/modules/reports/reportDateUtils.ts`.
2. **Backend Reports Controller**:
   - Implement `getOverview`, `getOrderReports`, `getPaymentReports`, `getProductionReports`, `getCustomerReports`, and `getStaffReports`.
3. **Backend Routes & RBAC**: Update `reportsRoutes.ts` with granular role guards.
4. **Backend Export Enhancement**: Update `importExportController.ts` to support date range filtering.
5. **Frontend Reports Page**:
   - Build date preset buttons, branch selector, and tabbed navigation.
   - Implement Overview, Orders, Payments, Production, Customers, and Staff panels with clean SVG/CSS charts.
6. **Automated Testing & Full Regression**: Run all test suites and compile builds.

---

PLAN ONLY — NO CODE CHANGES MADE
