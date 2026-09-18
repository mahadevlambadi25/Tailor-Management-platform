# Tailor Management System V1 ? Database Schema Documentation

## 1. Database Specifications
- **Engine**: PostgreSQL 18.6
- **Schema Management**: Prisma ORM 5.22
- **Data Integrity**: Multi-column foreign key cascades, tenant isolation indexing, immutable JSON snapshots, and soft deletion flags.

---

## 2. Core Entities & Data Dictionary

### 2.1 Multi-Tenancy & Access Control
| Model | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `Tenant` | Independent tailoring business or atelier | `id (UUID)` | None |
| `TenantSubscription` | SaaS tier, active period, quota limits | `id (UUID)` | `tenantId -> Tenant` |
| `Branch` | Physical workshop or retail boutique branch | `id (UUID)` | `tenantId -> Tenant` |
| `User` | Atelier staff account (Owner, Cutter, Tailor, Cashier) | `id (UUID)` | `tenantId -> Tenant`, `branchId -> Branch` |
| `RolePermission` | Explicit role-to-permission mapping overrides | `id (UUID)` | `tenantId -> Tenant` |

### 2.2 Customer & Fit Profiles
| Model | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `Customer` | Client contact record, preferences, balance summary | `id (UUID)` | `tenantId -> Tenant` |
| `CustomerMeasurement` | Live verified measurement profile per garment type | `id (UUID)` | `tenantId -> Tenant`, `customerId -> Customer`, `garmentTypeId -> GarmentType` |
| `CustomerInteraction` | Call logs, WhatsApp logs, fitting notes | `id (UUID)` | `tenantId -> Tenant`, `customerId -> Customer` |
| `OtpVerification` | Secure 6-digit OTP tokens for customer mobile login | `id (UUID)` | None (keyed by mobile and tenantId) |

### 2.3 Catalog, Garments & Styling Options
| Model | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `GarmentType` | Base template (e.g. 2-Piece Suit, Sherwani, Kurta, Trouser) | `id (UUID)` | `tenantId -> Tenant` |
| `MeasurementParameter` | Individual dimension (Chest, Waist, Shoulder, Inseam) | `id (UUID)` | `garmentTypeId -> GarmentType` |
| `StyleCategory` | Style group (e.g. Collar Type, Pocket Style, Vent) | `id (UUID)` | `garmentTypeId -> GarmentType` |
| `StyleOption` | Specific option (e.g. Peak Lapel, French Cuff, Mandarin) | `id (UUID)` | `categoryId -> StyleCategory` |

### 2.4 Orders & Immutable Measurement Snapshots
| Model | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `Order` | Master sales order header, pricing, dates, and balance | `id (UUID)` | `tenantId -> Tenant`, `customerId -> Customer`, `branchId -> Branch` |
| `OrderItem` | Specific garment item within an order | `id (UUID)` | `orderId -> Order`, `garmentTypeId -> GarmentType` |
| `OrderItemMeasurement` | **Immutable JSON snapshot** of measurements at order time | `id (UUID)` | `orderItemId -> OrderItem` (1:1) |
| `OrderHistory` | Audit trail of status updates and delay reasons | `id (UUID)` | `orderId -> Order`, `userId -> User` |

### 2.5 Production & Workshop Workflow
| Model | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `ProductionAssignment` | Worker assignment (Cutter, Tailor, Finisher) | `id (UUID)` | `orderItemId -> OrderItem`, `assignedToId -> User` |
| `ProductionTask` | Discrete operation step with status tracking | `id (UUID)` | `orderItemId -> OrderItem` |
| `Trial` | Fitting session details, trial date, outcome status | `id (UUID)` | `orderItemId -> OrderItem`, `orderId -> Order` |
| `Alteration` | Required garment adjustments and issue tracking | `id (UUID)` | `trialId -> Trial`, `orderItemId -> OrderItem` |
| `Appointment` | Atelier scheduling for measurement, consultation, trial | `id (UUID)` | `tenantId -> Tenant`, `customerId -> Customer` |

### 2.6 Financial Ledger & Documents
| Model | Description | Primary Key | Key Foreign Keys |
|---|---|---|---|
| `Payment` | Cash, UPI, Card, or Bank transfer transaction | `id (UUID)` | `tenantId -> Tenant`, `orderId -> Order` |
| `Invoice` | Official tax invoice record with GST breakdown | `id (UUID)` | `tenantId -> Tenant`, `orderId -> Order` |
| `DocumentShell` | Generated PDF or print payload metadata with QR token | `id (UUID)` | `orderId -> Order` |
| `ImportExportJob` | CSV bulk upload tracking and rollback record | `id (UUID)` | `tenantId -> Tenant` |

---

## 3. Enumerated Types (Enums)

- **Role**: `SAAS_OWNER`, `SAAS_SUPPORT`, `SHOP_OWNER`, `MANAGER`, `RECEPTIONIST`, `TAILOR`, `CUTTER`, `FINISHER`, `CASHIER`, `CUSTOMER`
- **OrderStatus**: `DRAFT`, `CONFIRMED`, `IN_PRODUCTION`, `READY_FOR_TRIAL`, `TRIAL_SCHEDULED`, `ALTERATION_IN_PROGRESS`, `READY_FOR_DELIVERY`, `DELIVERED`, `COMPLETED`, `CANCELLED`
- **ItemStatus**: `PENDING`, `CUTTING`, `STITCHING`, `FINISHING`, `TRIAL_READY`, `ALTERING`, `READY`, `DELIVERED`
- **PaymentStatus**: `PENDING`, `PARTIAL`, `PAID`, `REFUNDED`
- **PaymentMethod**: `CASH`, `UPI`, `CARD`, `BANK_TRANSFER`, `CHEQUE`
- **TrialStatus**: `SCHEDULED`, `COMPLETED_APPROVED`, `REQUIRES_ALTERATION`, `CANCELLED`
- **AlterationStatus**: `LOGGED`, `IN_PROGRESS`, `COMPLETED`
- **AppointmentType**: `MEASUREMENT`, `CONSULTATION`, `TRIAL`, `DELIVERY`
- **MeasurementUnit**: `INCHES`, `CENTIMETERS`

---

## 4. Architectural High-Availability & Indexing Strategy

1. **Tenant Isolation Indexing**: Every business query filters by `tenantId`. Composite indexes are defined on `[tenantId, createdAt]`, `[tenantId, status]`, and `[tenantId, phone]`.
2. **Order Number Uniqueness**: Orders are unique per tenant using `@@unique([tenantId, orderNumber])`.
3. **Soft-Delete Filtering**: The `deletedAt` index ensures fast exclusion of soft-deleted records.
4. **JSON Snapshot Storage**: `OrderItemMeasurement.valuesSnapshot` is stored as binary `Json` in PostgreSQL, preserving the exact dimensions forever without joins to mutating profiles.
