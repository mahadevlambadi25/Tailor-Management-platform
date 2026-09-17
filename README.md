# Tailor Management System V1 (TMS-V1)

A complete, production-ready, multi-tenant Tailor Management System and Customer Portal engineered according to the Master 2-Phase Implementation Specification.

---

## ?? Key Capabilities & Highlights

1. **Multi-Tenant Architecture**: Complete schema-level and query-level isolation supporting multiple ateliers (`royal-bespoke`, `elite-stitching`) on a single database.
2. **Server-Side RBAC (10 Roles)**: Strict authorization guards on all API routes for `SAAS_OWNER`, `SAAS_SUPPORT`, `SHOP_OWNER`, `MANAGER`, `RECEPTIONIST`, `TAILOR`, `CUTTER`, `FINISHER`, `CASHIER`, and `CUSTOMER`.
3. **Immutable Measurement Engine ("Chest 40" Guarantee)**: Orders store deep-copied JSON snapshots of garment measurements at booking time. If a client's measurements change months later, previous orders and job cards are permanently preserved.
4. **Complete Production Kanban**: Live drag-and-drop workflow tracking across Cutting, Stitching, Finishing, Trial, and Delivery.
5. **Enforced Delay Governance**: Transitions to delayed production stages strictly require both a **Delay Reason** and a **Revised Delivery Date**.
6. **Financial Balancing & Auto-Reconciliation**: Handles discounts, advance deposits, partial settlements, balance calculations, and multi-mode payments (Cash, UPI, Card).
7. **Document Shells with QR Codes**: Browser-native high-fidelity printing for Tailor Job Cards, Fabric Cutting Sheets, Tax Invoices, and 80mm Thermal Checkout Receipts.
8. **Customer Self-Service Portal**: Mobile OTP authentication (`9876543210`), live order tracking timeline, verified measurement history, with automated masking of internal tailor notes.
9. **Progressive Web App (PWA)**: Standalone installable mobile/tablet experience with custom Service Worker caching, offline fallback mode, and dynamic connectivity alerts.
10. **Multi-Lingual Support**: One-click internationalization across English, Hindi, and Kannada.

---

## ??? Technology Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM, Bcrypt, JSON Web Tokens (JWT), Zod, QRCode
- **Database**: PostgreSQL 18.6 (compatible with PostgreSQL 15+)
- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS, Lucide React
- **PWA & Offline**: W3C Web Manifest, Service Worker API, IndexedDB sync queue
- **Testing**: Automated TypeScript integration suite with deterministic assertion reporting

---

## ?? Repository Structure

```
??? backend/
?   ??? prisma/
?   ?   ??? schema.prisma        # Complete multi-tenant schema (30+ models)
?   ?   ??? seed.ts              # Master seed data for Tenants 1 & 2
?   ??? src/
?   ?   ??? config/              # App config & role permission mapping
?   ?   ??? middleware/          # TenantContext, AuthGuard, RbacGuard, ErrorHandler
?   ?   ??? modules/             # Auth, Customers, Orders, Production, Payments, etc.
?   ?   ??? routes/              # Centralized route registration
?   ?   ??? server.ts            # Express server bootstrap
?   ??? tests/
?   ?   ??? master_test.ts       # 35-assertion automated acceptance suite
?   ??? package.json
?   ??? tsconfig.json
??? frontend/
?   ??? public/
?   ?   ??? manifest.json        # PWA Web App Manifest
?   ?   ??? sw.js                # Custom Service Worker caching rules
?   ??? src/
?   ?   ??? api/                 # Axios client with x-tenant-slug interceptors
?   ?   ??? components/          # Common components, Navbar, Sidebar, AppLayout
?   ?   ??? context/             # Auth, Tenant, OfflineSync, Language contexts
?   ?   ??? i18n/                # Translations for English, Hindi, Kannada
?   ?   ??? pages/               # All functional pages (Orders, Kanban, Portal, etc.)
?   ?   ??? App.tsx              # Application router with ProtectedRoute
?   ?   ??? main.tsx             # App entrypoint and Service Worker registration
?   ?   ??? index.css            # Tailwind directives and print stylesheets
?   ??? package.json
?   ??? vite.config.ts
??? docs/                        # Complete technical & operational documentation
?   ??? ARCHITECTURE.md
?   ??? DATABASE_SCHEMA.md
?   ??? API_DOCUMENTATION.md
?   ??? RBAC_MATRIX.md
?   ??? DEPLOYMENT_GUIDE.md
?   ??? PWA_OFFLINE_GUIDE.md
?   ??? BACKUP_RESTORE_PLAN.md
?   ??? ACCEPTANCE_EVIDENCE.md
??? .env.example
??? README.md
```

---

## ?? Quick Start Guide

### 1. Prerequisites
- Node.js v18+ installed
- PostgreSQL 15+ or 18+ running on `localhost:5432`

### 2. Backend Setup
```bash
cd backend
npm install
npx prisma db push --accept-data-loss
npm run seed
```

### 3. Run Automated Acceptance Tests (35/35 Passing)
```bash
npm test
```

### 4. Start Development Servers
In terminal 1 (Backend):
```bash
cd backend
npm run dev
# Running at http://localhost:5000 (API: http://localhost:5000/api/v1)
```

In terminal 2 (Frontend):
```bash
cd frontend
npm install
npm run dev
# Running at http://localhost:5173
```

---

## ?? Pre-Seeded Test Credentials

### Tenant 1: Royal Bespoke Atelier (`royal-bespoke`)
| Role | Email / Login | Password | Description |
|---|---|---|---|
| **Shop Owner** | `owner@royalbespoke.com` | `Password@123` | Full access to all modules, settings & P&L |
| **Manager** | `manager@royalbespoke.com` | `Password@123` | Operational management & staff supervision |
| **Cutter** | `cutter@royalbespoke.com` | `Password@123` | Measurements intake & pattern cutting |
| **Tailor** | `tailor@royalbespoke.com` | `Password@123` | Workshop stitching & garment tasks |
| **Finisher** | `finisher@royalbespoke.com` | `Password@123` | Pressing, buttonholes, trimming & QC |
| **Cashier** | `cashier@royalbespoke.com` | `Password@123` | Billing desk & receipt printing |
| **Receptionist** | `receptionist@royalbespoke.com`| `Password@123` | Front desk bookings & customer intake |

### Tenant 2: Elite Stitching Studio (`elite-stitching`)
| Role | Email / Login | Password | Description |
|---|---|---|---|
| **Shop Owner** | `owner@elitestitching.com` | `Password@123` | Isolated tenant verifying zero data leak |

### Customer Portal Login
- **URL**: `http://localhost:5173/portal/login`
- **Mobile Number**: `9876543210` (Rajesh Kumar)
- **OTP**: Enter any 6 digits (or default `123456` in dev mode)

---

## ?? Documentation Links

- [System Architecture](file:///docs/ARCHITECTURE.md)
- [Database Schema & ERD](file:///docs/DATABASE_SCHEMA.md)
- [REST API Reference](file:///docs/API_DOCUMENTATION.md)
- [RBAC Permissions Matrix](file:///docs/RBAC_MATRIX.md)
- [Production Deployment Guide](file:///docs/DEPLOYMENT_GUIDE.md)
- [PWA & Offline Guide](file:///docs/PWA_OFFLINE_GUIDE.md)
- [Disaster Recovery & Backup Plan](file:///docs/BACKUP_RESTORE_PLAN.md)
- [Acceptance Evidence & Test Audit](file:///docs/ACCEPTANCE_EVIDENCE.md)
