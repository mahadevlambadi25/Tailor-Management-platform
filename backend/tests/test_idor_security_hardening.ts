import { Request, Response } from 'express';
import '../src/middleware/tenantContext';
import { CustomersController } from '../src/modules/customers/customersController';
import { MeasurementsController } from '../src/modules/measurements/measurementsController';
import { prisma } from '../src/core/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { UnitSystem } from '@prisma/client';

async function runIdorSecurityTests() {
  console.log('================================================================');
  console.log('   MULTI-TENANT IDOR SECURITY HARDENING — VERIFICATION SUITE    ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail ? `-> ${detail}` : '');
      failed++;
    }
  }

  // Tenant Mock Fixtures
  const TENANT_A_ID = 'tenant-a-uuid-1111';
  const TENANT_B_ID = 'tenant-b-uuid-2222';
  const CUSTOMER_A_ID = 'customer-a-uuid-1001';
  const CUSTOMER_B_ID = 'customer-b-uuid-2001';
  const GARMENT_TYPE_A_ID = 'garment-a-uuid-5001';
  const GARMENT_TYPE_B_ID = 'garment-b-uuid-5002';

  // Helper to construct Express mock request/response
  function createMockContext(options: {
    tenantId?: string;
    user?: any;
    params?: any;
    body?: any;
    query?: any;
    headers?: any;
  }) {
    let statusCode = 200;
    let jsonResponse: any = null;

    const req: any = {
      tenantId: options.tenantId,
      user: options.user || { id: 'user-owner', role: 'SHOP_OWNER' },
      params: options.params || {},
      body: options.body || {},
      query: options.query || {},
      headers: options.headers || {},
      ip: '127.0.0.1'
    };

    const res: any = {
      status: (code: number) => {
        statusCode = code;
        return res;
      },
      json: (data: any) => {
        jsonResponse = data;
        return res;
      }
    };

    const next = (err?: any) => {
      if (err) {
        statusCode = 500;
        jsonResponse = { success: false, error: { message: err.message } };
      }
    };

    return {
      req,
      res,
      next,
      getStatus: () => statusCode,
      getBody: () => jsonResponse
    };
  }

  // Preserve original Prisma functions to restore after test
  const originalCustomerFindFirst = prisma.customer.findFirst;
  const originalCustomerFindMany = prisma.customer.findMany;
  const originalCustomerCount = prisma.customer.count;
  const originalCustomerCreate = prisma.customer.create;
  const originalCustomerUpdate = prisma.customer.update;
  const originalGarmentFindFirst = prisma.garmentType.findFirst;
  const originalMeasurementFindFirst = prisma.customerMeasurement.findFirst;
  const originalMeasurementFindMany = prisma.customerMeasurement.findMany;
  const originalMeasurementCount = prisma.customerMeasurement.count;
  const originalMeasurementCreate = prisma.customerMeasurement.create;
  const originalMeasurementUpdate = prisma.customerMeasurement.update;
  const originalPrefUpsert = prisma.customerPreference.upsert;
  const originalTransaction = prisma.$transaction;
  const originalAuditCreate = prisma.auditLog.create;
  const originalFunnelCreate = (prisma as any).funnelEvent?.create;

  try {
    // =========================================================================
    // PART 1: CUSTOMER MODULE MULTI-TENANT ISOLATION TESTS
    // =========================================================================
    console.log('[PART 1] Testing Customer Module Multi-Tenant Isolation...');

    // In-memory Customer state for Shop A and Shop B
    let customerAState: any = {
      id: CUSTOMER_A_ID,
      tenantId: TENANT_A_ID,
      customerId: 'CUST-001',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      mobile: '9876543210',
      email: 'rajesh@example.com',
      isDeleted: false,
      orders: [],
      preferences: null
    };

    let customerBState: any = {
      id: CUSTOMER_B_ID,
      tenantId: TENANT_B_ID,
      customerId: 'CUST-002',
      firstName: 'Ananya',
      lastName: 'Sharma',
      mobile: '9123456780',
      email: 'ananya@example.com',
      isDeleted: false,
      orders: [],
      preferences: null
    };

    // Mock Prisma calls for Customer tests
    (prisma.customer as any).findFirst = async (args: any) => {
      const { id, tenantId } = args.where;
      if (id === CUSTOMER_A_ID && tenantId === TENANT_A_ID) {
        return { ...customerAState };
      }
      if (id === CUSTOMER_B_ID && tenantId === TENANT_B_ID) {
        return { ...customerBState };
      }
      return null; // Cross-tenant boundary strictly maintained
    };

    (prisma.customer as any).findMany = async (args: any) => {
      const { tenantId } = args.where;
      if (tenantId === TENANT_A_ID) return [{ ...customerAState }];
      if (tenantId === TENANT_B_ID) return [{ ...customerBState }];
      return [];
    };

    (prisma.customer as any).count = async (args: any) => {
      const { tenantId } = args.where;
      if (tenantId === TENANT_A_ID) return 1;
      if (tenantId === TENANT_B_ID) return 1;
      return 0;
    };

    (prisma.customer as any).update = async (args: any) => {
      if (args.where.id === CUSTOMER_A_ID) {
        customerAState = { ...customerAState, ...args.data };
        return { ...customerAState };
      }
      if (args.where.id === CUSTOMER_B_ID) {
        customerBState = { ...customerBState, ...args.data };
        return { ...customerBState };
      }
      throw new Error('Customer not found in update');
    };

    let takeSnapshot: (() => any) | null = null;
    let restoreSnapshot: ((snap: any) => void) | null = null;

    takeSnapshot = () => ({
      customerA: { ...customerAState },
      customerB: { ...customerBState }
    });
    restoreSnapshot = (snap: any) => {
      if (snap.customerA) customerAState = { ...snap.customerA };
      if (snap.customerB) customerBState = { ...snap.customerB };
    };

    (prisma.auditLog as any).create = async () => ({ id: 'audit-log-id' });
    (prisma as any).funnelEvent = { create: async () => ({ id: 'evt-1' }) };

    (prisma as any).measurementVersion = {
      findFirst: async () => null,
      create: async (args: any) => ({ id: 'version-001', ...args.data })
    };

    (prisma.customerMeasurement as any).update = async (args: any) => ({ id: args.where.id, ...args.data });

    const createTxProxy = () => ({
      customer: {
        update: async (args: any) => (prisma.customer as any).update(args)
      },
      customerMeasurement: {
        findFirst: async (args: any) => (prisma.customerMeasurement as any).findFirst(args),
        create: async (args: any) => (prisma.customerMeasurement as any).create(args),
        update: async (args: any) => (prisma.customerMeasurement as any).update(args)
      },
      measurementVersion: {
        findFirst: async (args: any) => (prisma as any).measurementVersion?.findFirst ? (prisma as any).measurementVersion.findFirst(args) : null,
        create: async (args: any) => (prisma as any).measurementVersion?.create ? (prisma as any).measurementVersion.create(args) : { id: 'version-001', ...args.data }
      },
      auditLog: {
        create: async (args: any) => (prisma.auditLog as any).create(args)
      }
    });

    (prisma as any).$transaction = async (callback: any) => {
      const snap = takeSnapshot ? takeSnapshot() : null;
      try {
        return await callback(createTxProxy());
      } catch (err) {
        if (restoreSnapshot && snap) {
          restoreSnapshot(snap);
        }
        throw err;
      }
    };

    // Test 1.1: Shop A updates own customer → Success (HTTP 200)
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_A_ID },
        body: { firstName: 'Rajesh-Updated', notes: 'VIP customer' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 200, 'Test 1.1: Shop A successfully updates own customer (HTTP 200)');
      assert(ctx.getBody()?.data?.firstName === 'Rajesh-Updated', 'Test 1.1: First name is correctly updated');
      assert(customerAState.firstName === 'Rajesh-Updated', 'Test 1.1: Database state reflected updated value');
    }

    // Test 1.2: Shop B attempts to update Shop A customer → Blocked with 404
    {
      const initialName = customerAState.firstName;
      const ctx = createMockContext({
        tenantId: TENANT_B_ID, // Malicious context: Shop B trying to update Shop A
        params: { id: CUSTOMER_A_ID },
        body: { firstName: 'Malicious-Hacked-Name' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.2: Cross-tenant update blocked with HTTP 404 (Shop B cannot update Shop A customer)');
      assert(ctx.getBody()?.error?.code === 'CUSTOMER_NOT_FOUND', 'Test 1.2: Error code is CUSTOMER_NOT_FOUND');
      assert(customerAState.firstName === initialName, 'Test 1.2: Database record remains UNCHANGED after blocked cross-tenant attempt');
    }

    // Test 1.3: Update non-existent customer ID → 404
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: 'non-existent-uuid-9999' },
        body: { firstName: 'Ghost' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.3: Non-existent customer update returns HTTP 404');
      assert(ctx.getBody()?.error?.code === 'CUSTOMER_NOT_FOUND', 'Test 1.3: Error code is CUSTOMER_NOT_FOUND');
    }

    // Test 1.4: Spoofed / Manipulated tenantId in body and headers is ignored
    {
      const initialName = customerAState.firstName;
      const ctx = createMockContext({
        tenantId: TENANT_B_ID, // Authenticated token is Shop B
        params: { id: CUSTOMER_A_ID },
        body: {
          tenantId: TENANT_A_ID, // Attacker tries to inject tenantId in body
          firstName: 'Injected-Tenant-Name'
        },
        headers: {
          'x-tenant-slug': 'royal-bespoke' // Attacker tries to spoof header
        }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.4: Spoofed tenantId in body/headers is strictly ignored; returns 404');
      assert(customerAState.firstName === initialName, 'Test 1.4: Customer state untouched');
    }

    // Test 1.5: Shop A attempts to read Shop B customer via getById → Blocked with 404
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_B_ID } // Shop B customer
      });

      await CustomersController.getById(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.5: Shop A cannot read Shop B customer via getById (HTTP 404)');
      assert(ctx.getBody()?.error?.code === 'CUSTOMER_NOT_FOUND', 'Test 1.5: Error code is CUSTOMER_NOT_FOUND');
    }

    // Test 1.6: Shop A attempts to softDelete Shop B customer → Blocked with 404
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_B_ID },
        body: { deletionReason: 'Malicious deletion attempt' }
      });

      await CustomersController.softDelete(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.6: Shop A cannot delete Shop B customer (HTTP 404)');
      assert(customerBState.isDeleted === false, 'Test 1.6: Shop B customer remains NOT deleted in database');
    }

    // Test 1.7: Shop A attempts to restore Shop B customer → Blocked with 404
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_B_ID }
      });

      await CustomersController.restore(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.7: Shop A cannot restore Shop B customer (HTTP 404)');
    }

    // Test 1.8: Shop A attempts to update preferences of Shop B customer → Blocked with 404
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_B_ID },
        body: { fitPreference: 'Hacked preference' }
      });

      await CustomersController.updatePreferences(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 1.8: Shop A cannot update Shop B customer preferences (HTTP 404)');
    }

    // Test 1.9: Legitimate customer listing is strictly scoped to authenticated tenant
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        query: { limit: '10', page: '1' }
      });

      await CustomersController.list(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 200, 'Test 1.9: Customer list returns HTTP 200');
      const returnedList = ctx.getBody()?.data?.customers || [];
      assert(returnedList.length === 1 && returnedList[0].id === CUSTOMER_A_ID, 'Test 1.9: Customer list returns ONLY Shop A customers');
    }

    // =========================================================================
    // PART 2: MEASUREMENT MODULE MULTI-TENANT ISOLATION TESTS
    // =========================================================================
    console.log('\n[PART 2] Testing Measurement Module Multi-Tenant Isolation...');

    let createdFlag = 0;
    const markMeasurementCreated = () => { createdFlag++; };
    const getMeasurementCreated = () => createdFlag > 0;
    const resetMeasurementFlag = () => { createdFlag = 0; };

    // Mock Prisma for Measurement tests
    (prisma.customer as any).findFirst = async (args: any) => {
      const { id, tenantId, isDeleted } = args.where;
      if (id === CUSTOMER_A_ID && tenantId === TENANT_A_ID && !isDeleted) {
        return { ...customerAState };
      }
      if (id === CUSTOMER_B_ID && tenantId === TENANT_B_ID && !isDeleted) {
        return { ...customerBState };
      }
      return null;
    };

    (prisma.garmentType as any).findFirst = async (args: any) => {
      const { id, tenantId, isActive } = args.where;
      if (id === GARMENT_TYPE_A_ID && tenantId === TENANT_A_ID && isActive) {
        return { id: GARMENT_TYPE_A_ID, tenantId: TENANT_A_ID, name: 'Men Shirt', isActive: true };
      }
      if (id === GARMENT_TYPE_B_ID && tenantId === TENANT_B_ID && isActive) {
        return { id: GARMENT_TYPE_B_ID, tenantId: TENANT_B_ID, name: 'Ladies Kurti', isActive: true };
      }
      return null;
    };

    (prisma.customerMeasurement as any).findFirst = async () => null;
    (prisma.customerMeasurement as any).findMany = async (args: any) => {
      const { tenantId, customerId } = args.where;
      if (tenantId === TENANT_A_ID && customerId === CUSTOMER_A_ID) {
        return [{ id: 'meas-a-01', garmentType: { name: 'Men Shirt' }, versions: [{ versionNumber: 1, values: { chest: 40 } }] }];
      }
      return [];
    };
    (prisma.customerMeasurement as any).count = async () => 1;
    (prisma.customerMeasurement as any).create = async (args: any) => {
      markMeasurementCreated();
      return { id: 'meas-001', ...args.data };
    };

    (prisma as any).measurementVersion = {
      findFirst: async () => null,
      create: async (args: any) => ({ id: 'version-001', ...args.data })
    };

    // Test 2.1: Shop A creates measurement for own customer → Success (HTTP 201)
    {
      resetMeasurementFlag();
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        body: {
          customerId: CUSTOMER_A_ID,
          garmentTypeId: GARMENT_TYPE_A_ID,
          name: 'Shirt Measurement',
          unit: UnitSystem.INCHES,
          values: { chest: 40, waist: 34, length: 29 },
          notes: 'Standard fit'
        }
      });

      await MeasurementsController.saveCustomerMeasurement(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 201, 'Test 2.1: Shop A creates measurement for own customer (HTTP 201)');
      assert(getMeasurementCreated() === true, 'Test 2.1: Measurement was committed to database');
    }

    // Test 2.2: Shop B attempts to create measurement for Shop A customer → Blocked with 404
    {
      resetMeasurementFlag();
      const ctx = createMockContext({
        tenantId: TENANT_B_ID, // Shop B tries to attach measurement to Shop A customer
        body: {
          customerId: CUSTOMER_A_ID, // Customer belongs to Shop A
          garmentTypeId: GARMENT_TYPE_B_ID,
          values: { chest: 42, waist: 36 }
        }
      });

      await MeasurementsController.saveCustomerMeasurement(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 2.2: Cross-tenant measurement creation blocked with HTTP 404');
      assert(ctx.getBody()?.error?.code === 'CUSTOMER_NOT_FOUND', 'Test 2.2: Error code is CUSTOMER_NOT_FOUND');
      assert(getMeasurementCreated() === false, 'Test 2.2: Zero measurement created in database after blocked request');
    }

    // Test 2.3: Shop A attempts to use garmentTypeId belonging to Shop B → Blocked with 404
    {
      resetMeasurementFlag();
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        body: {
          customerId: CUSTOMER_A_ID,
          garmentTypeId: GARMENT_TYPE_B_ID, // Garment belongs to Shop B!
          values: { chest: 38 }
        }
      });

      await MeasurementsController.saveCustomerMeasurement(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 2.3: Cross-tenant garment type creation blocked with HTTP 404');
      assert(ctx.getBody()?.error?.code === 'GARMENT_TYPE_NOT_FOUND', 'Test 2.3: Error code is GARMENT_TYPE_NOT_FOUND');
      assert(getMeasurementCreated() === false, 'Test 2.3: Zero measurement created for invalid garment type');
    }

    // Test 2.4: Shop A cannot access Shop B customer measurement history (GET /measurements/customer/:customerId) → Blocked with 404
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { customerId: CUSTOMER_B_ID } // Shop B customer
      });

      await MeasurementsController.getByCustomer(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 2.4: Shop A cannot access Shop B measurement history (HTTP 404)');
      assert(ctx.getBody()?.error?.code === 'CUSTOMER_NOT_FOUND', 'Test 2.4: Error code is CUSTOMER_NOT_FOUND');
    }

    // Test 2.5: Legitimate measurement retrieval for own customer succeeds with history
    {
      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { customerId: CUSTOMER_A_ID }
      });

      await MeasurementsController.getByCustomer(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 200, 'Test 2.5: Legitimate measurement retrieval returns HTTP 200');
      const measurements = ctx.getBody()?.data || [];
      assert(measurements.length === 1 && measurements[0].id === 'meas-a-01', 'Test 2.5: Returned measurement profile belongs to Shop A customer');
    }

    // =========================================================================
    // PART 3: AUTHENTICATED JWT CLAIMS & DEFENSIVE TENANT REJECTION
    // =========================================================================
    console.log('\n[PART 3] Testing JWT Authentication & Defensive Tenant Rejection...');

    // Test 3.1: Token from Shop B signed with genuine secret cannot manipulate tenantId
    {
      const shopBToken = jwt.sign(
        { id: 'user-b-uuid', tenantId: TENANT_B_ID, role: 'SHOP_OWNER' },
        config.jwtSecret,
        { expiresIn: '1h' }
      );

      const decoded: any = jwt.verify(shopBToken, config.jwtSecret);
      assert(decoded.tenantId === TENANT_B_ID, 'Test 3.1: Decoded JWT claims strictly reflect Tenant B');

      const ctx = createMockContext({
        tenantId: decoded.tenantId, // strictly from token
        params: { id: CUSTOMER_A_ID },
        body: { tenantId: TENANT_A_ID, firstName: 'SpoofAttempt' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 3.1: Token from Shop B cannot update Shop A customer even with manipulated body');
    }

    // Test 3.2: Missing tenant context is rejected across all customer endpoints with HTTP 401
    {
      const unauthCtxList = [
        { name: 'list', fn: () => CustomersController.list({ query: {} } as any, ctx.res, ctx.next) },
        { name: 'getById', fn: () => CustomersController.getById({ params: { id: 'c-1' } } as any, ctx.res, ctx.next) },
        { name: 'create', fn: () => CustomersController.create({ body: {} } as any, ctx.res, ctx.next) },
        { name: 'update', fn: () => CustomersController.update({ params: { id: 'c-1' }, body: {} } as any, ctx.res, ctx.next) },
        { name: 'softDelete', fn: () => CustomersController.softDelete({ params: { id: 'c-1' }, body: {} } as any, ctx.res, ctx.next) },
        { name: 'restore', fn: () => CustomersController.restore({ params: { id: 'c-1' } } as any, ctx.res, ctx.next) },
        { name: 'updatePreferences', fn: () => CustomersController.updatePreferences({ params: { id: 'c-1' }, body: {} } as any, ctx.res, ctx.next) }
      ];

      const ctx = createMockContext({ tenantId: undefined });
      for (const endpoint of unauthCtxList) {
        await endpoint.fn();
        assert(ctx.getStatus() === 401, `Test 3.2: Missing tenant context in Customers.${endpoint.name} returns HTTP 401`);
        assert(ctx.getBody()?.error?.code === 'UNAUTHORIZED', `Test 3.2: Error code is UNAUTHORIZED`);
      }
    }

    // Test 3.3: Missing tenant context is rejected across measurement endpoints with HTTP 401
    {
      const ctx = createMockContext({ tenantId: undefined });
      await MeasurementsController.saveCustomerMeasurement({ body: {} } as any, ctx.res, ctx.next);
      assert(ctx.getStatus() === 401, 'Test 3.3: Missing tenant context in saveCustomerMeasurement returns HTTP 401');
      assert(ctx.getBody()?.error?.code === 'UNAUTHORIZED', 'Test 3.3: Error code is UNAUTHORIZED');

      await MeasurementsController.getByCustomer({ params: { customerId: 'c-1' } } as any, ctx.res, ctx.next);
      assert(ctx.getStatus() === 401, 'Test 3.3: Missing tenant context in getByCustomer returns HTTP 401');
      assert(ctx.getBody()?.error?.code === 'UNAUTHORIZED', 'Test 3.3: Error code is UNAUTHORIZED');
    }

    // Test 3.4: Customer create with spoofed tenantId in body assigns authenticated tenantId
    {
      let createdCustomerRecord: any = null;
      (prisma.customer as any).create = async (args: any) => {
        createdCustomerRecord = args.data;
        return { id: 'cust-new-uuid', ...args.data };
      };

      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        body: {
          tenantId: TENANT_B_ID, // Malicious spoof in request body
          firstName: 'Rohit',
          lastName: 'Mehta',
          mobile: '9988776655'
        }
      });

      await CustomersController.create(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 201, 'Test 3.4: Legitimate customer creation succeeds (HTTP 201)');
      assert(createdCustomerRecord.tenantId === TENANT_A_ID, 'Test 3.4: Customer assigned authenticated tenantId, NOT spoofed body tenantId');
    }

    // =========================================================================
    // PART 4: RELIABILITY, CONCURRENCY & TRANSACTION ATOMICITY (PHASE 1.3)
    // =========================================================================
    console.log('\n[PART 4] Testing Reliability, Concurrency & Transaction Atomicity (Phase 1.3)...');

    // Test 4.1: Legitimate customer update commits atomically with audit log
    {
      let auditLogRecorded: any = null;
      (prisma.auditLog as any).create = async (args: any) => {
        auditLogRecorded = args.data;
        return { id: 'audit-atomic-01', ...args.data };
      };

      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_A_ID },
        body: { firstName: 'Rajesh-Atomic', notes: 'Updated atomically' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 200, 'Test 4.1: Legitimate customer update succeeds (HTTP 200)');
      assert(customerAState.firstName === 'Rajesh-Atomic', 'Test 4.1: Customer firstName updated in database');
      assert(auditLogRecorded?.tenantId === TENANT_A_ID, 'Test 4.1: Audit log atomically recorded with correct tenantId');
      assert(auditLogRecorded?.action === 'CUSTOMER_UPDATED', 'Test 4.1: Audit log action is CUSTOMER_UPDATED');
    }

    // Test 4.2: Customer update rolls back completely if audit logging fails
    {
      const preUpdateName = customerAState.firstName;
      // Force auditLog.create to throw inside transaction
      (prisma.auditLog as any).create = async () => {
        throw new Error('Database disk full or audit table unavailable');
      };

      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_A_ID },
        body: { firstName: 'Should-Rollback-Name' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 500, 'Test 4.2: Customer update fails with HTTP 500 when audit log fails');
      assert(customerAState.firstName === preUpdateName, 'Test 4.2: Customer state in database ROLLED BACK (unchanged)');
      assert(customerAState.firstName !== 'Should-Rollback-Name', 'Test 4.2: Partial write prevented (ACID atomicity verified)');
    }

    // Test 4.3: Customer softDelete rolls back completely if audit logging fails
    {
      (prisma.auditLog as any).create = async () => {
        throw new Error('Audit table constraint violation');
      };

      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        params: { id: CUSTOMER_A_ID },
        body: { deletionReason: 'Attempted delete' }
      });

      await CustomersController.softDelete(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 500, 'Test 4.3: Customer softDelete fails with HTTP 500 when audit log fails');
      assert(customerAState.isDeleted === false, 'Test 4.3: Customer deletion state ROLLED BACK (isDeleted remains false)');

      // Restore healthy auditLog mock
      (prisma.auditLog as any).create = async (args: any) => ({ id: 'audit-ok-01', ...args.data });
    }

    // Test 4.4: Concurrency collision (P2002) in measurement profile creation is recovered via automatic retry
    {
      let createCallCount = 0;
      let findFirstCallCount = 0;
      const concurrentProfile = {
        id: 'meas-profile-concurrent-99',
        tenantId: TENANT_A_ID,
        customerId: CUSTOMER_A_ID,
        garmentTypeId: GARMENT_TYPE_A_ID,
        unit: UnitSystem.INCHES,
        name: 'Measurement Profile'
      };

      // Mock findFirst: returns null on attempt 1, returns concurrentProfile on attempt 2 (after concurrent creation)
      (prisma.customerMeasurement as any).findFirst = async (args: any) => {
        findFirstCallCount++;
        if (findFirstCallCount === 1) {
          return null;
        }
        return { ...concurrentProfile };
      };

      // Mock create: throws P2002 on attempt 1 simulating concurrent insertion race
      (prisma.customerMeasurement as any).create = async () => {
        createCallCount++;
        const p2002Err: any = new Error('Unique constraint failed on the fields: (`tenantId`,`customerId`,`garmentTypeId`)');
        p2002Err.code = 'P2002';
        throw p2002Err;
      };

      let recordedVersion: any = null;
      (prisma as any).measurementVersion = {
        findFirst: async () => ({ versionNumber: 1 }),
        create: async (args: any) => {
          recordedVersion = args.data;
          return { id: 'ver-concurrent-02', ...args.data };
        }
      };

      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        body: {
          customerId: CUSTOMER_A_ID,
          garmentTypeId: GARMENT_TYPE_A_ID,
          name: 'Shirt Profile',
          unit: UnitSystem.INCHES,
          values: { chest: 41, waist: 35 },
          notes: 'Concurrent retry test'
        }
      });

      await MeasurementsController.saveCustomerMeasurement(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 201, 'Test 4.4: Concurrency race recovers cleanly via retry (HTTP 201)');
      assert(createCallCount === 1, 'Test 4.4: Initial create attempt collided with P2002');
      assert(ctx.getBody()?.data?.measurement?.id === 'meas-profile-concurrent-99', 'Test 4.4: Attaches to profile created by competing concurrent request');
      assert(ctx.getBody()?.data?.version?.versionNumber === 2, 'Test 4.4: Correctly increments to version 2 without data loss');
    }

    // Test 4.5: Duplicate profile prevention when measurement profile already exists
    {
      let createCalled = false;
      const existingProfile = {
        id: 'meas-profile-existing-77',
        tenantId: TENANT_A_ID,
        customerId: CUSTOMER_A_ID,
        garmentTypeId: GARMENT_TYPE_A_ID,
        unit: UnitSystem.INCHES,
        name: 'Existing Profile'
      };

      (prisma.customerMeasurement as any).findFirst = async () => ({ ...existingProfile });
      (prisma.customerMeasurement as any).create = async () => {
        createCalled = true;
        throw new Error('create should NOT be called when profile exists!');
      };
      (prisma.customerMeasurement as any).update = async (args: any) => ({ ...existingProfile, ...args.data });

      let createdVersion: any = null;
      (prisma as any).measurementVersion = {
        findFirst: async () => ({ versionNumber: 3 }),
        create: async (args: any) => {
          createdVersion = args.data;
          return { id: 'ver-004', ...args.data };
        }
      };

      const ctx = createMockContext({
        tenantId: TENANT_A_ID,
        body: {
          customerId: CUSTOMER_A_ID,
          garmentTypeId: GARMENT_TYPE_A_ID,
          values: { chest: 42, waist: 36 },
          notes: 'Version 4 update'
        }
      });

      await MeasurementsController.saveCustomerMeasurement(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 201, 'Test 4.5: Appends new version to existing profile (HTTP 201)');
      assert(createCalled === false, 'Test 4.5: Zero duplicate profile created (duplicate profile prevention verified)');
      assert(createdVersion?.customerMeasurementId === 'meas-profile-existing-77', 'Test 4.5: Version accurately linked to existing profile');
      assert(createdVersion?.versionNumber === 4, 'Test 4.5: Version number incremented to 4');
    }

    // Test 4.6: Multi-tenant boundary verification under atomic transactions
    {
      const ctx = createMockContext({
        tenantId: TENANT_B_ID, // Shop B context
        params: { id: CUSTOMER_A_ID }, // Shop A customer
        body: { firstName: 'CrossTenantAttack' }
      });

      await CustomersController.update(ctx.req, ctx.res, ctx.next);
      assert(ctx.getStatus() === 404, 'Test 4.6: Cross-tenant update blocked before opening transaction (HTTP 404)');
      assert(customerAState.firstName !== 'CrossTenantAttack', 'Test 4.6: Shop A customer state unchanged');
    }

  } finally {
    // Restore original Prisma functions
    (prisma.customer as any).findFirst = originalCustomerFindFirst;
    (prisma.customer as any).findMany = originalCustomerFindMany;
    (prisma.customer as any).count = originalCustomerCount;
    (prisma.customer as any).create = originalCustomerCreate;
    (prisma.customer as any).update = originalCustomerUpdate;
    (prisma.garmentType as any).findFirst = originalGarmentFindFirst;
    (prisma.customerMeasurement as any).findFirst = originalMeasurementFindFirst;
    (prisma.customerMeasurement as any).findMany = originalMeasurementFindMany;
    (prisma.customerMeasurement as any).count = originalMeasurementCount;
    (prisma.customerMeasurement as any).create = originalMeasurementCreate;
    (prisma.customerMeasurement as any).update = originalMeasurementUpdate;
    (prisma.customerPreference as any).upsert = originalPrefUpsert;
    (prisma as any).$transaction = originalTransaction;
    (prisma.auditLog as any).create = originalAuditCreate;
    if (originalFunnelCreate) {
      (prisma as any).funnelEvent.create = originalFunnelCreate;
    }
  }

  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIdorSecurityTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
