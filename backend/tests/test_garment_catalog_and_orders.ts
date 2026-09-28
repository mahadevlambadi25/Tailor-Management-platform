import { prisma } from '../src/core/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';
import { RoleType } from '@prisma/client';

async function runGarmentCatalogAndOrderTests() {
  console.log('================================================================');
  console.log('    TESTING GARMENT CATALOG, TENANT ISOLATION & ORDER INTEGRITY ');
  console.log('================================================================\n');

  const BASE_URL = 'http://localhost:5000/api/v1';
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✔ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✖ FAIL: ${testName}`, detail || '');
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Existing Demo Tenant (royal-bespoke) Garments & Styles
    // -------------------------------------------------------------
    console.log('[1/12] Testing Demo Tenant (Royal Bespoke) Garment Catalog...');
    const ownerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'owner@royalbespoke.com',
        password: 'Password@123'
      })
    });
    const ownerLoginData: any = await ownerLoginRes.json();
    assert(ownerLoginData.success === true, 'Royal Bespoke owner logged in');
    const demoToken = ownerLoginData.data.token;
    const demoTenantId = ownerLoginData.data.user.tenant.id;

    const demoGarmentsRes = await fetch(`${BASE_URL}/garments`, {
      headers: { Authorization: `Bearer ${demoToken}`, 'x-tenant-slug': 'royal-bespoke' }
    });
    const demoGarmentsData: any = await demoGarmentsRes.json();
    assert(demoGarmentsRes.status === 200 && demoGarmentsData.success === true, 'GET /garments returns 200 OK');
    assert(Array.isArray(demoGarmentsData.data) && demoGarmentsData.data.length >= 4, 
      `Royal Bespoke has real garment types (count: ${demoGarmentsData.data?.length})`);
    
    const shirtGarment = demoGarmentsData.data.find((g: any) => g.code === 'SHIRT');
    const pantGarment = demoGarmentsData.data.find((g: any) => g.code === 'PANT');
    assert(!!shirtGarment, 'Found SHIRT garment type in catalog');
    assert(!!pantGarment, 'Found PANT garment type in catalog');

    // -------------------------------------------------------------
    // Test 2: Styles Library & Dependent Filtering
    // -------------------------------------------------------------
    console.log('\n[2/12] Testing Styles Library & Dependent Filtering...');
    const demoStylesRes = await fetch(`${BASE_URL}/styles`, {
      headers: { Authorization: `Bearer ${demoToken}`, 'x-tenant-slug': 'royal-bespoke' }
    });
    const demoStylesData: any = await demoStylesRes.json();
    assert(demoStylesRes.status === 200 && demoStylesData.success === true, 'GET /styles returns 200 OK');
    assert(Array.isArray(demoStylesData.data), 'Returns array of styles');

    // Filter styles by garmentTypeId for Shirt
    const shirtStylesRes = await fetch(`${BASE_URL}/styles?garmentTypeId=${shirtGarment.id}`, {
      headers: { Authorization: `Bearer ${demoToken}`, 'x-tenant-slug': 'royal-bespoke' }
    });
    const shirtStylesData: any = await shirtStylesRes.json();
    assert(shirtStylesRes.status === 200 && shirtStylesData.success === true, 'GET /styles?garmentTypeId=SHIRT returns 200 OK');
    assert(shirtStylesData.data.every((s: any) => s.garmentTypeId === shirtGarment.id), 
      'Dependent filter strictly returns styles belonging to SHIRT');

    // -------------------------------------------------------------
    // Test 3: New Real Clean Tenant Auto-Provisioning
    // -------------------------------------------------------------
    console.log('\n[3/12] Registering a completely clean real tenant...');
    const testSuffix = Date.now().toString().slice(-6);
    const cleanEmail = `test.atelier.${testSuffix}@example.com`;
    const cleanName = `Test Atelier ${testSuffix}`;

    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        password: 'Password@123',
        confirmPassword: 'Password@123'
      })
    });
    const regData: any = await regRes.json();
    assert(regRes.status === 201 && regData.success === true, 'Clean real tenant registered successfully');
    const realToken = regData.data.token;
    const realTenantId = regData.data.user.tenant.id;
    const realTenantSlug = regData.data.user.tenant.slug;

    // -------------------------------------------------------------
    // Test 4: Verify Clean Tenant Has Real Garments But Zero Demo Transactions
    // -------------------------------------------------------------
    console.log('\n[4/12] Verifying Clean Tenant Master Catalog & Clean Workspace...');
    const realGarmentsRes = await fetch(`${BASE_URL}/garments`, {
      headers: { Authorization: `Bearer ${realToken}`, 'x-tenant-slug': realTenantSlug }
    });
    const realGarmentsData: any = await realGarmentsRes.json();
    assert(realGarmentsRes.status === 200 && realGarmentsData.success === true, 
      'Real tenant GET /garments returns 200 OK');
    assert(Array.isArray(realGarmentsData.data) && realGarmentsData.data.length >= 8, 
      `Real tenant receives full master garment catalog (count: ${realGarmentsData.data?.length})`);

    const realCodes = realGarmentsData.data.map((g: any) => g.code);
    assert(realCodes.includes('SHIRT') && realCodes.includes('PANT') && realCodes.includes('SUIT') && realCodes.includes('KURTA'),
      'Catalog contains canonical types: SHIRT, PANT, SUIT, KURTA');

    // Verify ZERO demo transactional records
    const custCount = await prisma.customer.count({ where: { tenantId: realTenantId } });
    const orderCount = await prisma.order.count({ where: { tenantId: realTenantId } });
    const payCount = await prisma.payment.count({ where: { tenantId: realTenantId } });
    assert(custCount === 0, `Clean tenant has 0 customers (actual: ${custCount})`);
    assert(orderCount === 0, `Clean tenant has 0 orders (actual: ${orderCount})`);
    assert(payCount === 0, `Clean tenant has 0 payments (actual: ${payCount})`);

    // -------------------------------------------------------------
    // Test 5: Create Custom Garment Type via API (Styles & Designs)
    // -------------------------------------------------------------
    console.log('\n[5/12] Creating Custom Garment Type via POST /garments...');
    const customGarmentRes = await fetch(`${BASE_URL}/garments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Custom Tuxedo Jacket',
        code: 'TUXEDO',
        category: 'Men',
        defaultPrice: 9500
      })
    });
    const customGarmentData: any = await customGarmentRes.json();
    assert(customGarmentRes.status === 201 && customGarmentData.success === true, 
      'POST /garments creates custom garment type');
    assert(customGarmentData.data.code === 'TUXEDO' && customGarmentData.data.name === 'Custom Tuxedo Jacket', 
      'Custom garment attributes saved accurately');
    const customGarmentId = customGarmentData.data.id;

    // -------------------------------------------------------------
    // Test 6: Rejection of Duplicate Garment Code in Same Tenant
    // -------------------------------------------------------------
    console.log('\n[6/12] Testing Duplicate Garment Code Rejection...');
    const dupGarmentRes = await fetch(`${BASE_URL}/garments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Another Tuxedo',
        code: 'TUXEDO',
        category: 'Men',
        defaultPrice: 8000
      })
    });
    const dupGarmentData: any = await dupGarmentRes.json();
    assert(dupGarmentRes.status === 400 && dupGarmentData.error?.code === 'DUPLICATE_GARMENT_CODE', 
      'Rejects duplicate garment code with DUPLICATE_GARMENT_CODE');

    // -------------------------------------------------------------
    // Test 7: Create Style Cut for Garment Type
    // -------------------------------------------------------------
    console.log('\n[7/12] Creating Style Cut for Custom Garment via POST /styles...');
    const newStyleRes = await fetch(`${BASE_URL}/styles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        garmentTypeId: customGarmentId,
        name: 'Satin Shawl Lapel',
        category: 'Lapel',
        description: 'Silk satin shawl collar for black tie tuxedo'
      })
    });
    const newStyleData: any = await newStyleRes.json();
    assert(newStyleRes.status === 201 && newStyleData.success === true, 'Created style cut linked to custom garment');
    const customStyleId = newStyleData.data.id;

    // -------------------------------------------------------------
    // Test 8: Tenant Isolation - Tenant B cannot see Tenant A's custom garment
    // -------------------------------------------------------------
    console.log('\n[8/12] Testing Tenant Isolation on Garment Catalogs...');
    const demoGarmentsAfterRes = await fetch(`${BASE_URL}/garments`, {
      headers: { Authorization: `Bearer ${demoToken}`, 'x-tenant-slug': 'royal-bespoke' }
    });
    const demoGarmentsAfterData: any = await demoGarmentsAfterRes.json();
    const demoHasTuxedo = demoGarmentsAfterData.data.some((g: any) => g.code === 'TUXEDO');
    assert(!demoHasTuxedo, 'Royal Bespoke NEVER sees Test Atelier custom TUXEDO garment (strict isolation)');

    // -------------------------------------------------------------
    // Test 9: Cross-Tenant Style Creation Rejection
    // -------------------------------------------------------------
    console.log('\n[9/12] Testing Cross-Tenant Style Reference Protection...');
    // Real tenant attempts to create a style referencing Royal Bespoke's garmentTypeId
    const crossStyleRes = await fetch(`${BASE_URL}/styles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        garmentTypeId: shirtGarment.id, // belongs to Royal Bespoke!
        name: 'Hacked Style',
        category: 'Collar'
      })
    });
    const crossStyleData: any = await crossStyleRes.json();
    assert(crossStyleRes.status === 400 && crossStyleData.error?.code === 'INVALID_GARMENT_TYPE', 
      'Rejects style cut referencing another tenant garmentTypeId (INVALID_GARMENT_TYPE)');

    // -------------------------------------------------------------
    // Test 10: Create Real Order with Selected Garment Type & Style
    // -------------------------------------------------------------
    console.log('\n[10/12] Creating Order with Selected Garments & Style Cuts...');
    
    // First create a customer for real tenant
    const custRes = await fetch(`${BASE_URL}/customers`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstName: 'Vikram',
        lastName: 'Malhotra',
        mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        email: `vikram.${testSuffix}@example.com`
      })
    });
    const custData: any = await custRes.json();
    assert(custRes.status === 201 && custData.success === true, 'Created real customer for order');
    const realCustomerId = custData.data.id;

    // Pick real tenant's SHIRT and custom TUXEDO
    const realShirt = realGarmentsData.data.find((g: any) => g.code === 'SHIRT');
    const deliveryDate = new Date(Date.now() + 7 * 86400000).toISOString();

    const orderPayload = {
      customerId: realCustomerId,
      deliveryDate,
      priority: 'REGULAR',
      items: [
        {
          garmentTypeId: realShirt.id,
          itemPrice: 1500,
          stitchingCharge: 500,
          fabricCharge: 0,
          quantity: 2,
          measurementSnapshot: {
            valuesSnapshot: { Chest: 40, Waist: 34, Neck: 16, Sleeve: 25 },
            unit: 'INCHES'
          },
          styleOptions: []
        },
        {
          garmentTypeId: customGarmentId,
          itemPrice: 9500,
          stitchingCharge: 1500,
          fabricCharge: 0,
          quantity: 1,
          measurementSnapshot: {
            valuesSnapshot: { Chest: 40, Waist: 34, Shoulder: 18, Length: 31 },
            unit: 'INCHES'
          },
          styleOptions: [{ styleId: customStyleId }]
        }
      ],
      advancePayment: {
        amount: 2000,
        paymentMethod: 'UPI'
      }
    };

    const orderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderPayload)
    });
    const orderData: any = await orderRes.json();
    assert(orderRes.status === 201 && orderData.success === true, 'Order created successfully with multi-garments');
    const createdOrderId = orderData.data.id;

    // -------------------------------------------------------------
    // Test 11: Reopen Order & Verify Garment Data Persistence
    // -------------------------------------------------------------
    console.log('\n[11/12] Reopening Order & Verifying Garment Data Integrity in DB...');
    const getOrderRes = await fetch(`${BASE_URL}/orders/${createdOrderId}`, {
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug
      }
    });
    const getOrderData: any = await getOrderRes.json();
    assert(getOrderRes.status === 200 && getOrderData.success === true, 'GET /orders/:id returns 200 OK');
    
    const items = getOrderData.data.items;
    assert(items.length === 2, 'Order has exactly 2 garments');
    
    const item1 = items.find((i: any) => i.garmentTypeId === realShirt.id);
    assert(!!item1, 'Garment #1 (Shirt) persisted correctly');
    assert(item1.garmentType?.name === realShirt.name, 'Garment #1 has correct garmentType name');
    assert(item1.quantity === 2, 'Garment #1 quantity intact (2)');
    assert(Number(item1.itemPrice) === 1500, 'Garment #1 base price intact (₹1500)');

    const item2 = items.find((i: any) => i.garmentTypeId === customGarmentId);
    assert(!!item2, 'Garment #2 (Custom Tuxedo) persisted correctly');
    assert(item2.garmentType?.name === 'Custom Tuxedo Jacket', 'Garment #2 has correct custom garment name');
    assert(item2.styles?.length === 1 && item2.styles[0].style?.name === 'Satin Shawl Lapel', 
      'Garment #2 has selected style cut persisted');

    // -------------------------------------------------------------
    // Test 12: Cross-Tenant Order Item Rejection
    // -------------------------------------------------------------
    console.log('\n[12/12] Testing Cross-Tenant Garment Reference Rejection in Orders...');
    // Real tenant attempts to book an order referencing Royal Bespoke's shirtGarment.id
    const crossOrderRes = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${realToken}`,
        'x-tenant-slug': realTenantSlug,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerId: realCustomerId,
        deliveryDate,
        items: [
          {
            garmentTypeId: shirtGarment.id, // belongs to Royal Bespoke!
            itemPrice: 1500,
            quantity: 1
          }
        ]
      })
    });
    const crossOrderData: any = await crossOrderRes.json();
    assert(crossOrderRes.status === 400 && crossOrderData.error?.code === 'INVALID_GARMENT_TYPE', 
      'Cross-tenant garment reference in orders is strictly rejected (INVALID_GARMENT_TYPE)');

    // Clean up test tenant
    console.log('\nCleaning up test tenant...');
    await prisma.order.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.customer.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.style.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.measurementTemplate.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.garmentType.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.user.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.branch.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.subscription.deleteMany({ where: { tenantId: realTenantId } });
    await prisma.tenant.deleteMany({ where: { id: realTenantId } });
    console.log('Cleanup completed.\n');

  } catch (err: any) {
    console.error('Unexpected test error:', err.message || err);
    failed++;
  }

  console.log('================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runGarmentCatalogAndOrderTests();
