# Tailor Management System V1 ? RBAC Permissions Matrix

## 1. Overview of System Roles

The system enforces server-side Role-Based Access Control (RBAC) across 10 distinct roles:
1. **SAAS_OWNER**: Super-administrator managing SaaS tenants, subscriptions, and platform telemetry.
2. **SAAS_SUPPORT**: Customer support agent with read-only multi-tenant troubleshooting access.
3. **SHOP_OWNER**: Atelier owner with full operational, financial, and configuration authority.
4. **MANAGER**: Workshop branch head supervising staff, orders, production schedules, and inventory.
5. **RECEPTIONIST**: Front-desk operator registering clients, booking appointments, and initiating intake orders.
6. **TAILOR**: Craftsman responsible for garment stitching, alterations, and pocket/lining construction.
7. **CUTTER**: Master cutter reviewing pattern blueprints, taking measurements, and cutting fabrics.
8. **FINISHER**: Artisan handling buttonholes, pressing, thread trimming, hand embroidery, and final QC.
9. **CASHIER**: Dedicated billing desk processing advances, balancing invoices, and generating thermal receipts.
10. **CUSTOMER**: End client accessing self-service mobile portal (tracking orders, trials, fit profile).

---

## 2. Granular Permissions Matrix

| Permission Key | SAAS_OWNER | SHOP_OWNER | MANAGER | RECEPTIONIST | CUTTER | TAILOR | FINISHER | CASHIER | CUSTOMER |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **VIEW_CUSTOMERS** | ? | ? | ? | ? | ? | ? | ? | ? | ? (Own Only) |
| **CREATE_CUSTOMERS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **EDIT_CUSTOMERS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **DELETE_CUSTOMERS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **TAKE_MEASUREMENTS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **APPROVE_MEASUREMENTS**| ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **CREATE_ORDER** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **VIEW_INTERNAL_NOTES** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **UPDATE_PRODUCTION** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **RECORD_PAYMENTS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **VIEW_FINANCIALS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **VIEW_PROFIT_MARGINS**| ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **MANAGE_STAFF** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **MANAGE_SETTINGS** | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| **EXPORT_DATA** | ? | ? | ? | ? | ? | ? | ? | ? | ? |

---

## 3. Server-Side Enforcement Architecture

All API endpoints are defended by `rbacGuard.ts`:
```typescript
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user?.role;
    const permissions = ROLE_PERMISSIONS[role] || [];
    
    if (role === 'SAAS_OWNER' || permissions.includes(permission)) {
      return next();
    }
    
    return res.status(403).json({
      success: false,
      error: `Access Denied: Role '${role}' lacks permission '${permission}'`
    });
  };
};
```

This ensures that even if a user manually modifies client-side JavaScript or attempts direct HTTP payloads, unauthorized operations are immediately rejected by the server kernel.
