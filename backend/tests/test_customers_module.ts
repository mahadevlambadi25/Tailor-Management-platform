import { app } from '../src/app';
import { prisma } from '../src/core/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { RoleType } from '@prisma/client';
import http from 'http';

async function runCustomerModuleTests() {
  console.log('================================================================');
  console.log('  CUSTOMER MANAGEMENT MODULE — VERIFICATION & INTEGRATION SUITE ');
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

  // Start ephemeral test server on random free port
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;

  try {
    // -------------------------------------------------------------
    // Setup: Retrieve Test Tenants and Generate Valid JWT Tokens
    // -------------------------------------------------------------
    const tenant1 = await prisma.tenant.findUnique({ where: { slug: 'royal-bespoke' } });
    if (!tenant1) throw new Error('Tenant 1 (royal-bespoke) not found. Run db seed first.');

    const tenant2 = await prisma.tenant.findUnique({ where: { slug: 'elite-stitching' } });
    if (!tenant2) throw new Error('Tenant 2 (elite-stitching) not found. Run db seed first.');

    const owner1 = await prisma.user.findFirst({
      where: { tenantId: tenant1.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner1) throw new Error('Shop owner for Tenant 1 not found.');

    const owner2 = await prisma.user.findFirst({
      where: { tenantId: tenant2.id, role: RoleType.SHOP_OWNER }
    });
    if (!owner2) throw new Error('Shop owner for Tenant 2 not found.');

    const token1 = jwt.sign(
      { id: owner1.id, tenantId: tenant1.id, email: owner1.email, role: owner1.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const token2 = jwt.sign(
      { id: owner2.id, tenantId: tenant2.id, email: owner2.email, role: owner2.role },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    // Clean up any leftovers from previous test runs
    const testMobile = '9845112233';
    await prisma.customer.deleteMany({
      where: { mobile: testMobile }
    });

    let createdCustomerId = '';

    // -------------------------------------------------------------
    // Test 1: Customer Creation with All Fields & WhatsApp Preference
    // -------------------------------------------------------------
    console.log('[1/10] Testing Customer Creation with Full Schema & WhatsApp Preference...');
    const createRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({
        firstName: 'Vikram',
        lastName: 'Singhania',
        mobile: testMobile,
        whatsapp: testMobile,
        email: 'vikram.singhania@example.com',
        gender: 'Male',
        dob: '1988-06-15',
        address: '102 Embassy Heights, MG Road',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        notes: 'Prefers English wool, sharp peak lapels',
        preferences: {
          preferredContactMethod: 'WHATSAPP',
          fabricPreferences: '100% Super 140s Wool',
          fitPreference: 'Slim Italian Cut',
          notes: 'Narrow cuff, high armhole'
        }
      })
    });

    const createData: any = await createRes.json();
    assert(createRes.status === 201 && createData.success === true, 'Customer created with HTTP 201');
    assert(createData.data?.customerId?.startsWith('CUST-'), 'Assigned collision-safe customerId: ' + createData.data?.customerId);
    assert(createData.data?.firstName === 'Vikram' && createData.data?.lastName === 'Singhania', 'Name accurately recorded');
    assert(createData.data?.preferences?.preferredContactMethod === 'WHATSAPP', 'WhatsApp preference saved');
    assert(createData.data?.tenantId === tenant1.id, 'Tenant context properly set to Tenant 1');

    createdCustomerId = createData.data.id;

    // -------------------------------------------------------------
    // Test 2: Input Validation (Required Fields, Phone, Email)
    // -------------------------------------------------------------
    console.log('\n[2/10] Testing Input Validation & Error Responses (400)...');

    // Missing Name
    const missingNameRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ firstName: '', lastName: '', mobile: '9123456780' })
    });
    const missingNameData: any = await missingNameRes.json();
    assert(missingNameRes.status === 400 && missingNameData.error?.code === 'MISSING_FIELDS', 'Rejects empty name with MISSING_FIELDS');

    // Invalid Phone (< 7 digits)
    const invalidPhoneRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ firstName: 'Test', lastName: 'User', mobile: '123' })
    });
    const invalidPhoneData: any = await invalidPhoneRes.json();
    assert(invalidPhoneRes.status === 400 && invalidPhoneData.error?.code === 'INVALID_PHONE', 'Rejects invalid phone with INVALID_PHONE');

    // Invalid Email
    const invalidEmailRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ firstName: 'Test', lastName: 'User', mobile: '9123456780', email: 'not-an-email' })
    });
    const invalidEmailData: any = await invalidEmailRes.json();
    assert(invalidEmailRes.status === 400 && invalidEmailData.error?.code === 'INVALID_EMAIL', 'Rejects invalid email with INVALID_EMAIL');

    // -------------------------------------------------------------
    // Test 3: Duplicate Mobile Prevention within the Same Tenant
    // -------------------------------------------------------------
    console.log('\n[3/10] Testing Duplicate Mobile Prevention (409 Conflict)...');
    const duplicateRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        firstName: 'Duplicate',
        lastName: 'Attempt',
        mobile: testMobile // Exact duplicate of Vikram Singhania
      })
    });
    const duplicateData: any = await duplicateRes.json();
    assert(duplicateRes.status === 409, 'Returns HTTP 409 Conflict for duplicate phone');
    assert(duplicateData.error?.code === 'DUPLICATE_MOBILE', 'Error code is DUPLICATE_MOBILE');
    assert(duplicateData.error?.existingCustomerId === createdCustomerId, 'Returns existingCustomerId for friendly UI redirect');

    // -------------------------------------------------------------
    // Test 4: Customer Directory & Multi-Word Search
    // -------------------------------------------------------------
    console.log('\n[4/10] Testing Customer Directory & Multi-Word Search...');

    // Single name search
    const singleSearchRes = await fetch(`${baseUrl}/customers?search=Vikram`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const singleSearchData: any = await singleSearchRes.json();
    assert(singleSearchData.data?.customers?.some((c: any) => c.id === createdCustomerId), 'Search by first name ("Vikram") finds customer');

    // Multi-word name search ("Vikram Singhania")
    const multiSearchRes = await fetch(`${baseUrl}/customers?search=Vikram%20Singhania`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const multiSearchData: any = await multiSearchRes.json();
    assert(multiSearchData.data?.customers?.some((c: any) => c.id === createdCustomerId), 'Multi-word search ("Vikram Singhania") finds customer');

    // Phone search with formatting
    const phoneSearchRes = await fetch(`${baseUrl}/customers?search=${testMobile}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const phoneSearchData: any = await phoneSearchRes.json();
    assert(phoneSearchData.data?.customers?.some((c: any) => c.id === createdCustomerId), 'Search by phone number finds customer');

    // -------------------------------------------------------------
    // Test 5: Customer Profile (Basic info, Contact, Measurements, Orders, Payments)
    // -------------------------------------------------------------
    console.log('\n[5/10] Testing Customer Profile Retrieval...');
    const profileRes = await fetch(`${baseUrl}/customers/${createdCustomerId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const profileData: any = await profileRes.json();
    assert(profileRes.status === 200 && profileData.success === true, 'Profile loaded with HTTP 200');
    assert(profileData.data?.id === createdCustomerId, 'Profile customer ID matches');
    assert(profileData.data?.preferences !== null, 'Customer preferences included in profile');
    assert(Array.isArray(profileData.data?.measurements), 'Measurements array included in profile');
    assert(Array.isArray(profileData.data?.orders), 'Orders array included in profile');
    assert(Array.isArray(profileData.data?.payments), 'Payments array included in profile');
    assert(typeof profileData.data?.totalSpend === 'number', 'Aggregated totalSpend calculated');
    assert(typeof profileData.data?.outstandingBalance === 'number', 'Aggregated outstandingBalance calculated');

    // -------------------------------------------------------------
    // Test 6: Customer Profile Update
    // -------------------------------------------------------------
    console.log('\n[6/10] Testing Customer Profile Update & Validation...');
    const updateRes = await fetch(`${baseUrl}/customers/${createdCustomerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        firstName: 'Vikramaditya',
        lastName: 'Singhania',
        city: 'Mysore',
        notes: 'VIP client - high priority delivery'
      })
    });
    const updateData: any = await updateRes.json();
    assert(updateRes.status === 200, 'Customer details updated with HTTP 200');
    assert(updateData.data?.firstName === 'Vikramaditya', 'Updated name reflected in response');
    assert(updateData.data?.city === 'Mysore', 'Updated city reflected');
    assert(updateData.data?.notes === 'VIP client - high priority delivery', 'Updated VIP notes reflected');

    // -------------------------------------------------------------
    // Test 7: Update Customer Preferences
    // -------------------------------------------------------------
    console.log('\n[7/10] Testing Customer Preferences Update...');
    const prefRes = await fetch(`${baseUrl}/customers/${createdCustomerId}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        preferredContactMethod: 'WHATSAPP',
        fitPreference: 'Extra Slim Fit',
        fabricPreferences: 'Irish Linen & Cashmere',
        notes: 'No polyester lining'
      })
    });
    const prefData: any = await prefRes.json();
    assert(prefRes.status === 200 && prefData.success === true, 'Preferences updated with HTTP 200');
    assert(prefData.data?.fitPreference === 'Extra Slim Fit', 'Fit preference successfully updated');
    assert(prefData.data?.preferredContactMethod === 'WHATSAPP', 'Preferred contact method is WHATSAPP');

    // -------------------------------------------------------------
    // Test 8: Strict Multi-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n[8/10] Testing Strict Multi-Tenant Isolation...');

    // Tenant 2 attempts to read Tenant 1's customer
    const leakReadRes = await fetch(`${baseUrl}/customers/${createdCustomerId}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    assert(leakReadRes.status === 404, 'Cross-tenant GET returns 404 (Customer completely hidden across tenants)');

    // Tenant 2 attempts to update Tenant 1's customer
    const leakUpdateRes = await fetch(`${baseUrl}/customers/${createdCustomerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ firstName: 'Hacked' })
    });
    assert(leakUpdateRes.status === 404, 'Cross-tenant PUT returns 404 (Zero cross-tenant modification)');

    // Tenant 2 attempts to update preferences of Tenant 1's customer
    const leakPrefRes = await fetch(`${baseUrl}/customers/${createdCustomerId}/preferences`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({ fitPreference: 'Hacked Fit' })
    });
    assert(leakPrefRes.status === 404, 'Cross-tenant preferences PUT returns 404');

    // Tenant 2 can create customer with SAME mobile in their own tenant (Tenant isolation for phone uniqueness)
    const tenant2CreateRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
      body: JSON.stringify({
        firstName: 'Vikram',
        lastName: 'Tenant2',
        mobile: testMobile // Same mobile, different tenant!
      })
    });
    assert(tenant2CreateRes.status === 201, 'Same mobile number is permitted in independent tenant (Tenant-scoped uniqueness)');

    // Clean up tenant 2 customer
    const tenant2Data: any = await tenant2CreateRes.json();
    if (tenant2Data.data?.id) {
      await prisma.customer.delete({ where: { id: tenant2Data.data.id } });
    }

    // -------------------------------------------------------------
    // Test 9: Customer Soft Delete & Restore Lifecycle
    // -------------------------------------------------------------
    console.log('\n[9/10] Testing Customer Soft-Delete & Restore Lifecycle...');
    const deleteRes = await fetch(`${baseUrl}/customers/${createdCustomerId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({ deletionReason: 'Customer relocation' })
    });
    assert(deleteRes.status === 200, 'Customer soft-deleted successfully');

    // Verify soft-deleted customer does NOT show in active list
    const activeListRes = await fetch(`${baseUrl}/customers?search=${testMobile}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const activeListData: any = await activeListRes.json();
    assert(
      !activeListData.data?.customers?.some((c: any) => c.id === createdCustomerId),
      'Soft-deleted customer excluded from default customer directory'
    );

    // Restore customer
    const restoreRes = await fetch(`${baseUrl}/customers/${createdCustomerId}/restore`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` }
    });
    assert(restoreRes.status === 200, 'Customer restored successfully');

    // -------------------------------------------------------------
    // Test 10: Customer → Order Booking Flow (No Duplicate Records)
    // -------------------------------------------------------------
    console.log('\n[10/10] Testing Customer -> Order Booking Flow (Zero Duplicate Records)...');
    const garments = await prisma.garmentType.findMany();
    const shirtGarment = garments.find(g => g.code === 'SHIRT') || garments[0];

    const orderRes = await fetch(`${baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token1}` },
      body: JSON.stringify({
        customerId: createdCustomerId, // Link to existing customer
        deliveryDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        priority: 'REGULAR',
        discountType: 'FIXED',
        discountValue: 0,
        gstRate: 0,
        isGstInclusive: false,
        items: [
          {
            garmentTypeId: shirtGarment.id,
            itemPrice: 3500,
            stitchingCharge: 500,
            fabricCharge: 0,
            quantity: 1,
            measurementSnapshot: {
              valuesSnapshot: { Chest: 40, Waist: 34, Shoulder: 18 },
              unit: 'INCHES'
            }
          }
        ]
      })
    });

    const orderData: any = await orderRes.json();
    assert(orderRes.status === 201 && orderData.success === true, 'Order created successfully for customer');
    assert(orderData.data?.customerId === createdCustomerId, 'Order strictly references existing customer ID');

    // Verify customer count for this mobile is STILL EXACTLY 1 (No duplicate created!)
    const customerCount = await prisma.customer.count({
      where: { tenantId: tenant1.id, mobile: testMobile }
    });
    assert(customerCount === 1, 'ZERO duplicate customer records created during Order booking (Exactly 1 record in DB)');

    // Verify order is visible in customer's profile order list
    const updatedProfileRes = await fetch(`${baseUrl}/customers/${createdCustomerId}`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const updatedProfileData: any = await updatedProfileRes.json();
    assert(
      updatedProfileData.data?.orders?.some((o: any) => o.id === orderData.data.id),
      'New order appears in customer profile order history'
    );

    // Clean up created order and customer
    if (orderData.data?.id) {
      await prisma.orderItem.deleteMany({ where: { orderId: orderData.data.id } });
      await prisma.order.delete({ where: { id: orderData.data.id } });
    }

    await prisma.customerPreference.deleteMany({ where: { customerId: createdCustomerId } });
    await prisma.customer.delete({ where: { id: createdCustomerId } });
    console.log('\n  ✔ Test data cleaned up successfully.');

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`  CUSTOMER TESTS FINISHED: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerModuleTests().catch((err) => {
  console.error('Fatal error during customer module tests:', err);
  process.exit(1);
});
