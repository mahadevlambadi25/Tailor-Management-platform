import { prisma } from '../src/core/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { RoleType } from '@prisma/client';

async function runStaffCreationAndAuthTests() {
  console.log('====================================================');
  console.log('  TESTING STAFF CREATION, AUTHENTICATION & SECURITY  ');
  console.log('====================================================\n');

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
    // Test 1: Verify Existing Demo Staff & Owner Login Still Works
    // -------------------------------------------------------------
    console.log('[1/12] Verifying existing demo accounts (Owner & Tailor)...');
    
    // Owner login
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
    assert(ownerLoginData.success === true, 'Existing Owner (owner@royalbespoke.com) logs in successfully');
    assert(ownerLoginData.data?.user?.role === 'SHOP_OWNER', 'Owner has role SHOP_OWNER');
    const ownerToken = ownerLoginData.data?.token;
    const ownerHeaders = {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json'
    };

    // Existing Tailor login
    const tailorLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'tailor@royalbespoke.com',
        password: 'Password@123'
      })
    });
    const tailorLoginData: any = await tailorLoginRes.json();
    assert(tailorLoginData.success === true, 'Existing Tailor (tailor@royalbespoke.com) logs in successfully');
    assert(tailorLoginData.data?.user?.role === 'TAILOR', 'Tailor has role TAILOR');

    // -------------------------------------------------------------
    // Test 2: Validation on Staff Creation (Name, Email, Role)
    // -------------------------------------------------------------
    console.log('\n[2/12] Testing Validation on Staff Creation API...');

    // Missing / invalid name
    const invalidNameRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: ' ',
        email: 'test@royalbespoke.com',
        role: 'TAILOR'
      })
    });
    const invalidNameData: any = await invalidNameRes.json();
    assert(invalidNameRes.status === 400 && invalidNameData.error?.code === 'INVALID_NAME', 
      'Rejects empty/whitespace staff name');

    // Invalid email
    const invalidEmailRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'John Doe',
        email: 'not-an-email',
        role: 'TAILOR'
      })
    });
    const invalidEmailData: any = await invalidEmailRes.json();
    assert(invalidEmailRes.status === 400 && invalidEmailData.error?.code === 'INVALID_EMAIL', 
      'Rejects malformed email address');

    // Invalid role
    const invalidRoleRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'John Doe',
        email: 'johndoe@example.com',
        role: 'SUPER_ADMIN_HACK'
      })
    });
    const invalidRoleData: any = await invalidRoleRes.json();
    assert(invalidRoleRes.status === 400 && invalidRoleData.error?.code === 'INVALID_ROLE', 
      'Rejects invalid/unrecognized system role');

    // Short password (<6 chars) if explicitly provided
    const shortPassRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'John Doe',
        email: 'johndoe@example.com',
        role: 'TAILOR',
        password: '123'
      })
    });
    const shortPassData: any = await shortPassRes.json();
    assert(shortPassRes.status === 400 && shortPassData.error?.code === 'PASSWORD_TOO_SHORT', 
      'Rejects short password (< 6 characters)');

    // -------------------------------------------------------------
    // Test 3: Cross-Tenant Branch Isolation
    // -------------------------------------------------------------
    console.log('\n[3/12] Testing Branch Isolation (prevent assigning branch from another tenant)...');
    
    // Find or create a branch in another tenant
    const otherTenant = await prisma.tenant.findFirst({
      where: { slug: { not: 'royal-bespoke' } }
    });
    let foreignBranchId: string | null = null;
    if (otherTenant) {
      const foreignBranch = await prisma.branch.findFirst({
        where: { tenantId: otherTenant.id }
      });
      foreignBranchId = foreignBranch?.id || null;
    }

    if (foreignBranchId) {
      const crossBranchRes = await fetch(`${BASE_URL}/users`, {
        method: 'POST',
        headers: ownerHeaders,
        body: JSON.stringify({
          name: 'Attacker Staff',
          email: 'attacker@example.com',
          role: 'TAILOR',
          branchId: foreignBranchId
        })
      });
      const crossBranchData: any = await crossBranchRes.json();
      assert(crossBranchRes.status === 400 && crossBranchData.error?.code === 'INVALID_BRANCH', 
        'Blocks assigning branch belonging to a different tenant');
    } else {
      console.log('  ⚠ SKIP: No secondary tenant branch found for cross-branch test');
    }

    // -------------------------------------------------------------
    // Test 4: Create Staff User with Auto-Generated Temporary Password
    // -------------------------------------------------------------
    console.log('\n[4/12] Creating Staff User with Auto-Generated Temporary Password...');
    const testTimestamp = Date.now();
    const staff1Email = `auto.staff.${testTimestamp}@royalbespoke.com`;
    
    const createStaffRes1 = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Auto Generated Staff',
        email: `  ${staff1Email.toUpperCase()}  `, // Test normalization
        role: 'CUTTER',
        skills: ['Cutting', 'Pattern Making']
      })
    });

    const createStaffData1: any = await createStaffRes1.json();
    assert(createStaffRes1.status === 201 && createStaffData1.success === true, 
      'Staff account created with auto-generated temporary password');
    const generatedTempPassword = createStaffData1.data?.temporaryPassword || createStaffData1.temporaryPassword;
    assert(typeof generatedTempPassword === 'string' && generatedTempPassword.length >= 8,
      'Response returns generated temporaryPassword of sufficient length');
    assert(createStaffData1.data?.email === staff1Email.toLowerCase(), 
      'Staff email was correctly trimmed and normalized to lowercase');
    assert(createStaffData1.data?.role === 'CUTTER', 
      'Staff role assigned as CUTTER');

    // -------------------------------------------------------------
    // Test 5: Verify Password Hashing & Security in DB
    // -------------------------------------------------------------
    console.log('\n[5/12] Verifying Password Hashing in Database...');
    const dbUser = await prisma.user.findFirst({
      where: { email: staff1Email.toLowerCase() }
    });
    assert(!!dbUser, 'Staff record found in database');
    assert(dbUser!.passwordHash !== generatedTempPassword, 'Plaintext password is NEVER stored in database');
    assert(dbUser!.passwordHash.startsWith('$2a$') || dbUser!.passwordHash.startsWith('$2b$'), 
      'Password is securely hashed with bcrypt ($2a$ or $2b$)');
    
    const isBcryptValid = await bcrypt.compare(generatedTempPassword, dbUser!.passwordHash);
    assert(isBcryptValid === true, 'Stored bcrypt hash verifies against the generated temporary password');

    // -------------------------------------------------------------
    // Test 6: Create Staff User with Explicit Temporary Password
    // -------------------------------------------------------------
    console.log('\n[6/12] Creating Staff User with Explicit Temporary Password...');
    const staff2Email = `explicit.staff.${testTimestamp}@royalbespoke.com`;
    const explicitPassword = 'TempSecurePass!987';

    const createStaffRes2 = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Explicit Password Staff',
        email: staff2Email,
        role: 'TAILOR',
        password: explicitPassword,
        skills: ['Embroidery', 'Stitching']
      })
    });

    const createStaffData2: any = await createStaffRes2.json();
    assert(createStaffRes2.status === 201 && createStaffData2.success === true, 
      'Staff account created with explicit temporary password');
    assert((createStaffData2.data?.temporaryPassword || createStaffData2.temporaryPassword) === explicitPassword, 
      'Response confirms explicit temporary password for sharing');

    // -------------------------------------------------------------
    // Test 7: Duplicate Email in Same Tenant Rejection
    // -------------------------------------------------------------
    console.log('\n[7/12] Testing Duplicate Staff Email Rejection...');
    const dupRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Duplicate Staff',
        email: staff2Email,
        role: 'TAILOR'
      })
    });
    const dupData: any = await dupRes.json();
    assert(dupRes.status === 400 && dupData.error?.code === 'DUPLICATE_STAFF_EMAIL', 
      'Rejects duplicate staff email in same tenant with code DUPLICATE_STAFF_EMAIL');

    // -------------------------------------------------------------
    // Test 8: Staff Login via Normal Login with Temporary Password
    // -------------------------------------------------------------
    console.log('\n[8/12] Testing Staff Normal Login via Email + Temporary Password...');
    
    // Login with auto-generated staff
    const staffLoginRes1 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: staff1Email,
        password: generatedTempPassword
      })
    });
    const staffLoginData1: any = await staffLoginRes1.json();
    assert(staffLoginRes1.status === 200 && staffLoginData1.success === true, 
      'Staff with auto-generated password logs in successfully');
    assert(staffLoginData1.data?.user?.role === 'CUTTER', 'Staff token resolves to role CUTTER');
    assert(staffLoginData1.data?.user?.tenant?.id === dbUser!.tenantId, 'Staff belongs to the correct tenant');
    
    // Verify JWT payload
    const staffToken1 = staffLoginData1.data?.token;
    const decodedStaff1: any = jwt.decode(staffToken1);
    assert(decodedStaff1?.role === 'CUTTER' && decodedStaff1?.tenantId === dbUser!.tenantId, 
      'Staff JWT contains verified role and tenantId');

    // Login with explicit password staff
    const staffLoginRes2 = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: staff2Email,
        password: explicitPassword
      })
    });
    const staffLoginData2: any = await staffLoginRes2.json();
    assert(staffLoginRes2.status === 200 && staffLoginData2.success === true, 
      'Staff with explicit password logs in successfully');
    assert(staffLoginData2.data?.user?.role === 'TAILOR', 'Staff token resolves to role TAILOR');

    // -------------------------------------------------------------
    // Test 9: Staff RBAC Permission Scoping
    // -------------------------------------------------------------
    console.log('\n[9/12] Testing Staff RBAC Permission Scoping...');
    const staff1Headers = {
      Authorization: `Bearer ${staffToken1}`,
      'Content-Type': 'application/json'
    };

    // CUTTER / TAILOR cannot view/list staff users
    const listAttemptRes = await fetch(`${BASE_URL}/users`, {
      method: 'GET',
      headers: staff1Headers
    });
    assert(listAttemptRes.status === 403, 
      'Staff (CUTTER) is forbidden from listing users (RBAC enforced)');

    // CUTTER / TAILOR cannot create new staff users
    const createAttemptRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: staff1Headers,
      body: JSON.stringify({
        name: 'Illegal Staff',
        email: 'illegal@royalbespoke.com',
        role: 'TAILOR'
      })
    });
    assert(createAttemptRes.status === 403, 
      'Staff (CUTTER) is forbidden from creating staff users (RBAC enforced)');

    // -------------------------------------------------------------
    // Test 10: Multi-Tenant Isolation (Cannot access other tenant)
    // -------------------------------------------------------------
    console.log('\n[10/12] Testing Multi-Tenant Isolation...');
    // Attempting login with staff email under another tenant slug
    const crossTenantLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'classic-bespoke', // different tenant
        email: staff1Email,
        password: generatedTempPassword
      })
    });
    const crossTenantLoginData: any = await crossTenantLoginRes.json();
    assert(crossTenantLoginData.success === false, 
      'Staff cannot authenticate into an arbitrary tenant where they do not have membership');

    // -------------------------------------------------------------
    // Test 11: Customer Portal OTP Separation
    // -------------------------------------------------------------
    console.log('\n[11/12] Testing Customer Portal OTP Separation...');
    // Verify Customer Portal OTP is completely separate and untouched
    const sampleCustomer = await prisma.customer.findFirst({
      where: { tenantId: dbUser!.tenantId }
    });
    if (sampleCustomer?.mobile) {
      const portalRequestRes = await fetch(`${BASE_URL}/auth/customer/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': dbUser!.tenantId
        },
        body: JSON.stringify({
          mobile: sampleCustomer.mobile
        })
      });
      const portalRequestData: any = await portalRequestRes.json();
      assert(portalRequestRes.status === 200 && portalRequestData.success === true, 
        'Customer Portal OTP request endpoint functions normally and untouched');
    }

    // Verify Customer Portal OTP rejects non-existent customer mobile
    const staffInPortalRes = await fetch(`${BASE_URL}/auth/customer/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': dbUser!.tenantId
      },
      body: JSON.stringify({
        mobile: '0000000000'
      })
    });
    const staffInPortalData: any = await staffInPortalRes.json();
    assert(staffInPortalRes.status === 404 && staffInPortalData.error?.code === 'CUSTOMER_NOT_FOUND', 
      'Customer Portal OTP rejects unregistered customer numbers');

    // -------------------------------------------------------------
    // Test 12: Password Hash Leak Prevention
    // -------------------------------------------------------------
    console.log('\n[12/12] Testing Password Hash Leak Prevention in User Lists...');
    const userListRes = await fetch(`${BASE_URL}/users`, {
      headers: ownerHeaders
    });
    const userListData: any = await userListRes.json();
    assert(userListData.success === true, 'GET /users returns user list');
    
    let hasLeakedHash = false;
    for (const u of userListData.data) {
      if (u.passwordHash || u.password) {
        hasLeakedHash = true;
        break;
      }
    }
    assert(!hasLeakedHash, 'User list NEVER exposes password or passwordHash');

    // Clean up created test staff
    console.log('\nCleaning up test staff accounts...');
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [staff1Email.toLowerCase(), staff2Email.toLowerCase()]
        }
      }
    });
    console.log('Cleanup completed.\n');

  } catch (err: any) {
    console.error('Unexpected error in test runner:', err.message || err);
    failed++;
  }

  console.log('====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runStaffCreationAndAuthTests();
