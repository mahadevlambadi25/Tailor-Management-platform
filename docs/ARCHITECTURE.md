# Tailor Management System V1 ? Architecture Specification

## 1. System Overview
Tailor Management System V1 is a multi-tenant, cloud-ready, full-stack ERP and customer portal tailored specifically for custom tailoring ateliers, bespoke garment houses, and multi-branch tailoring chains.

The platform provides:
- Complete order lifecycle management (intake, measurement snapshotting, cutting, tailoring, finishing, fitting trials, alterations, and delivery).
- Strict multi-tenant data isolation at the middleware and query level.
- Server-side Role-Based Access Control (RBAC) across 10 granular roles.
- Customer self-service portal accessible via mobile OTP authentication.
- Progressive Web App (PWA) offline capabilities with Service Worker and local storage synchronization.
- High-fidelity printable production shells: Job Cards, Cutting Sheets, Invoices, and Thermal Delivery Receipts with QR verification.

---

## 2. Technology Stack

### Backend Stack
- **Runtime**: Node.js (v18+) with TypeScript (ES2022)
- **Framework**: Express.js with modular domain-driven architecture
- **ORM**: Prisma ORM (v5.22+)
- **Database**: PostgreSQL 18.6
- **Security & Cryptography**: Bcrypt for password hashing, JSON Web Tokens (JWT) for stateless session authentication, crypto for OTP generation and verification
- **Validation**: Zod schema validation & runtime type guards
- **Document & QR Generation**: `qrcode` with SVG and base64 data URL rendering
- **Testing**: Native TypeScript test runner with deterministic assertion reporting

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS with custom print-specific typography and layout rules
- **Icons**: Lucide React
- **State & Context**: Native React Contexts (`AuthContext`, `TenantContext`, `OfflineSyncContext`, `LanguageContext`)
- **PWA & Offline**: W3C Web App Manifest (`manifest.json`), custom Service Worker (`sw.js`) with cache-first and network-first fallbacks
- **Multi-lingual i18n**: English, Hindi, and Kannada locale dictionaries with dynamic UI switching

---

## 3. High-Level Architectural Diagram

```
+---------------------------------------------------------------------------------+
|                                 CLIENT CLIENTELE                                |
|  Desktop Browser  |  Tablet Atelier Counter  |  Workshop Mobile PWA  |  Customer |
+---------------------------------------------------------------------------------+
                                      |
                            HTTPS / Reverse Proxy
                                      |
+-------------------------------------+-------------------------------------------+
|                          EXPRESS BACKEND LAYER                                  |
|                                                                                 |
|  [Rate Limiter] ---> [Tenant Context Middleware] ---> [JWT Auth Guard]           |
|                                                              |                  |
|                                                      [RBAC Permission Guard]    |
|                                                              |                  |
|  +---------------------------------------------------------------------------+  |
|  |                           DOMAIN MODULES                                  |  |
|  |  * Auth & OTP           * Customers & 11 Tabs     * Measurements Catalog  |  |
|  |  * Orders & Pricing     * Production & Kanban     * Trials & Alterations  |  |
|  |  * Payments & Ledger    * Appointments            * Documents & QR Engine |  |
|  |  * Customer Portal      * Reports & Analytics     * Import/Export Engine  |  |
|  +---------------------------------------------------------------------------+  |
|                                      |                                          |
|                             [Prisma Client ORM]                                 |
+-------------------------------------+-------------------------------------------+
                                      |
                               SQL Connection
                                      |
+-------------------------------------+-------------------------------------------+
|                          POSTGRESQL DATABASE                                    |
|                                                                                 |
|  * Tenant Isolation by `tenantId` Foreign Key indexed on every business entity  |
|  * Immutable historical measurement snapshot JSON                               |
|  * Soft deletion with audit timestamps (`deletedAt`, `deletedBy`)                |
|  * Transactional rollback for order bookings and multi-entry payments           |
+---------------------------------------------------------------------------------+
```

---

## 4. Multi-Tenancy Architecture

### 4.1 Tenant Resolution
Every HTTP request to the API passes through `tenantContext.ts`:
1. The request specifies the tenant via:
   - Header: `x-tenant-slug` (e.g., `royal-bespoke` or `elite-stitching`)
   - Host header / Subdomain: `tenant-slug.atelier.com`
   - Or extracted from the authenticated user's JWT payload.
2. The middleware queries the `Tenant` table to verify tenant existence and active status.
3. The resolved `tenantId` is attached to `req.tenantId` for all downstream controllers.

### 4.2 Query-Level Tenant Isolation
All Prisma ORM queries strictly filter by `where: { tenantId: req.tenantId }`. 
Cross-tenant access attempts are rejected immediately with `404 Not Found` or `403 Forbidden`. As proven in `backend/tests/master_test.ts`, Tenant 2 can never read, modify, or leak Tenant 1 records.

---

## 5. Security & Authentication Architecture

### 5.1 Staff Authentication
- Staff members authenticate using their email or username and password.
- Passwords are encrypted using `bcrypt` with a minimum of 10 salt rounds.
- A signed JWT token is issued containing `{ userId, tenantId, branchId, role }`.
- Token expiry is set to 24 hours.

### 5.2 Customer OTP Authentication
- Customers access their portal using their registered mobile number.
- The server generates a cryptographically secure 6-digit OTP stored in the `OtpVerification` table with:
  - 5-minute expiry timestamp.
  - Brute-force throttling: maximum 5 failed attempts before lockout.
  - One-time consumption flag (`isUsed`).
- In development/test mode, the OTP is returned in the API response or simulated console log. In production, it connects to standard SMS/WhatsApp gateways.

### 5.3 Customer Privacy & Data Masking
The customer portal exposes an isolated subset of data. Internal tailor notes, cutter instructions, internal margins, and raw staff commentary are strictly masked from the customer responses in `customerPortalController.ts`.

---

## 6. Immutable Measurement Engine ("Chest 40" Guarantee)

A critical failure mode in conventional tailoring systems is that modifying a customer's profile measurements changes historical orders retroactively.

Tailor Management System V1 completely eliminates this risk through **Immutable Snapshots**:
1. When an order item is booked, the system takes a deep copy of the customer's verified measurements for that garment type.
2. The copy is stored in the `OrderItemMeasurement` record as an immutable JSON structure (`valuesSnapshot`).
3. If the customer returns months later and their chest measurement increases from 40" to 42", updating their active profile writes a new version in `CustomerMeasurement` without touching `OrderItemMeasurement`.
4. Previous job cards, cutting sheets, and order records continue to show Chest = 40" perpetually.

---

## 7. Production Delay Governance

To prevent delivery dates from silently slipping, any transition to a delayed state in the production pipeline strictly enforces:
- A mandatory **Delay Reason** (e.g., fabric stock delay, client fitting postponement, embroidery work).
- A mandatory **Revised Delivery Date**.

The backend controller validates both fields at the schema layer before committing the state update.
