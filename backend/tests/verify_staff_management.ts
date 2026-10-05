import { prisma } from '../src/core/prisma';
import bcrypt from 'bcryptjs';
import { RoleType } from '@prisma/client';

async function runStaffManagementTests() {
  console.log('====================================================');
  console.log('  TESTING STAFF MANAGEMENT & SECURITY FEATURES     ');
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
    // Setup: Get demo owner & create test users (Tailor & Manager)
    // -------------------------------------------------------------
    console.log('[Setup] Logging in as Royal Bespoke Owner...');
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
    assert(ownerLoginData.success === true, 'Owner login successful');
    const ownerToken = ownerLoginData.data.token;
    const ownerId = ownerLoginData.data.user.id;
    const ownerHeaders = {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json'
    };

    // Create a temporary test Tailor in royal-bespoke
    const testStaffEmail = `test.staff.${Date.now()}@royalbespoke.com`;
    const createStaffRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Test Tailor Member',
        email: testStaffEmail,
        role: 'TAILOR',
        password: 'InitialPassword@123'
      })
    });
    const createStaffData: any = await createStaffRes.json();
    assert(createStaffData.success === true, 'Created test staff (Tailor)');
    const testStaffId = createStaffData.data.id;

    // Create a temporary test Manager in royal-bespoke
    const testManagerEmail = `test.manager.${Date.now()}@royalbespoke.com`;
    const createManagerRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Test Manager Member',
        email: testManagerEmail,
        role: 'MANAGER',
        password: 'ManagerPassword@123'
      })
    });
    const createManagerData: any = await createManagerRes.json();
    assert(createManagerData.success === true, 'Created test staff (Manager)');
    const testManagerId = createManagerData.data.id;

    // Log in as the test Tailor
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: testStaffEmail,
        password: 'InitialPassword@123'
      })
    });
    const staffLoginData: any = await staffLoginRes.json();
    assert(staffLoginData.success === true, 'Test staff can log in with initial password');
    const staffToken = staffLoginData.data.token;
    const staffHeaders = {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json'
    };

    // Log in as the test Manager
    const managerLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: testManagerEmail,
        password: 'ManagerPassword@123'
      })
    });
    const managerLoginData: any = await managerLoginRes.json();
    assert(managerLoginData.success === true, 'Test manager can log in');
    const managerToken = managerLoginData.data.token;
    const managerHeaders = {
      Authorization: `Bearer ${managerToken}`,
      'Content-Type': 'application/json'
    };

    // -------------------------------------------------------------
    // Part 1: Change OWN Password
    // -------------------------------------------------------------
    console.log('\n[Part 1] Testing Change OWN Password...');

    // 1.1 Missing current password
    const missingCurrentRes = await fetch(`${BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123'
      })
    });
    const missingCurrentData: any = await missingCurrentRes.json();
    assert(missingCurrentRes.status === 400 && missingCurrentData.error?.code === 'MISSING_CURRENT_PASSWORD', 'Rejected when current password is missing');

    // 1.2 Wrong current password
    const wrongCurrentRes = await fetch(`${BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        currentPassword: 'WrongPassword@999',
        newPassword: 'NewPassword@123',
        confirmPassword: 'NewPassword@123'
      })
    });
    const wrongCurrentData: any = await wrongCurrentRes.json();
    assert(wrongCurrentRes.status === 400 && wrongCurrentData.error?.code === 'INVALID_CURRENT_PASSWORD', 'Rejected when current password is incorrect');

    // 1.3 Password mismatch
    const mismatchRes = await fetch(`${BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        currentPassword: 'InitialPassword@123',
        newPassword: 'NewPassword@123',
        confirmPassword: 'DifferentPassword@123'
      })
    });
    const mismatchData: any = await mismatchRes.json();
    assert(mismatchRes.status === 400 && mismatchData.error?.code === 'PASSWORDS_DONT_MATCH', 'Rejected when new passwords do not match');

    // 1.4 Short password (< 6 chars)
    const shortPassRes = await fetch(`${BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        currentPassword: 'InitialPassword@123',
        newPassword: '123',
        confirmPassword: '123'
      })
    });
    const shortPassData: any = await shortPassRes.json();
    assert(shortPassRes.status === 400 && shortPassData.error?.code === 'PASSWORD_TOO_SHORT', 'Rejected when new password is too short');

    // 1.5 Successful own password change via /users/change-password
    const ownChangeRes = await fetch(`${BASE_URL}/users/change-password`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        currentPassword: 'InitialPassword@123',
        newPassword: 'UpdatedOwnPassword@456',
        confirmPassword: 'UpdatedOwnPassword@456'
      })
    });
    const ownChangeData: any = await ownChangeRes.json();
    assert(ownChangeRes.status === 200 && ownChangeData.success === true, 'Test staff can change own password successfully');

    // 1.6 Verify old password fails and new password succeeds
    const oldLoginFailRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: testStaffEmail,
        password: 'InitialPassword@123'
      })
    });
    assert(oldLoginFailRes.status === 401, 'Old password fails to login');

    const newLoginSuccessRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: testStaffEmail,
        password: 'UpdatedOwnPassword@456'
      })
    });
    const newLoginData: any = await newLoginSuccessRes.json();
    assert(newLoginSuccessRes.status === 200 && newLoginData.success === true, 'New password logs in successfully');
    const updatedStaffToken = newLoginData.data.token;
    const updatedStaffHeaders = {
      Authorization: `Bearer ${updatedStaffToken}`,
      'Content-Type': 'application/json'
    };

    // 1.7 Also verify /auth/change-password alias works
    const authChangeRes = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: updatedStaffHeaders,
      body: JSON.stringify({
        currentPassword: 'UpdatedOwnPassword@456',
        newPassword: 'UpdatedOwnPassword@789',
        confirmPassword: 'UpdatedOwnPassword@789'
      })
    });
    const authChangeData: any = await authChangeRes.json();
    assert(authChangeRes.status === 200 && authChangeData.success === true, '/auth/change-password alias works');

    // -------------------------------------------------------------
    // Part 2: Admin/Owner & Manager Reset Staff Password
    // -------------------------------------------------------------
    console.log('\n[Part 2] Testing Admin/Owner & Manager Reset Staff Password...');

    // 2.1 Unauthorized normal staff attempting to reset someone else's password
    const unauthResetRes = await fetch(`${BASE_URL}/users/${ownerId}/password`, {
      method: 'PATCH',
      headers: updatedStaffHeaders,
      body: JSON.stringify({
        newPassword: 'HackedPassword@123',
        confirmPassword: 'HackedPassword@123'
      })
    });
    assert(unauthResetRes.status === 403, 'Normal staff cannot reset another user\'s password');

    // 2.2 Authorized owner resets staff password
    const adminResetRes = await fetch(`${BASE_URL}/users/${testStaffId}/password`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({
        newPassword: 'AdminAssignedPass@999',
        confirmPassword: 'AdminAssignedPass@999'
      })
    });
    const adminResetData: any = await adminResetRes.json();
    assert(adminResetRes.status === 200 && adminResetData.success === true, 'Owner can reset staff password');

    // 2.3 Manager can reset non-owner staff password
    const managerResetRes = await fetch(`${BASE_URL}/users/${testStaffId}/password`, {
      method: 'PATCH',
      headers: managerHeaders,
      body: JSON.stringify({
        newPassword: 'ManagerAssignedPass@888',
        confirmPassword: 'ManagerAssignedPass@888'
      })
    });
    const managerResetData: any = await managerResetRes.json();
    assert(managerResetRes.status === 200 && managerResetData.success === true, 'Manager can reset non-owner staff password');

    // 2.4 Manager CANNOT reset owner password
    const managerResetOwnerRes = await fetch(`${BASE_URL}/users/${ownerId}/password`, {
      method: 'PATCH',
      headers: managerHeaders,
      body: JSON.stringify({
        newPassword: 'ManagerHackedOwner@123',
        confirmPassword: 'ManagerHackedOwner@123'
      })
    });
    assert(managerResetOwnerRes.status === 403, 'Manager cannot reset owner password');

    // 2.5 Cross-tenant reset isolation check: create user in another tenant
    const otherTenant = await prisma.tenant.findFirst({
      where: { slug: { not: 'royal-bespoke' } },
      include: { users: true }
    });
    if (otherTenant && otherTenant.users.length > 0) {
      const otherUserId = otherTenant.users[0].id;
      const crossTenantResetRes = await fetch(`${BASE_URL}/users/${otherUserId}/password`, {
        method: 'PATCH',
        headers: ownerHeaders,
        body: JSON.stringify({
          newPassword: 'CrossTenantPass@123',
          confirmPassword: 'CrossTenantPass@123'
        })
      });
      assert(crossTenantResetRes.status === 404, 'Cross-tenant staff access is rejected with 404');
    }

    // -------------------------------------------------------------
    // Part 3: Deactivate & Activate Staff
    // -------------------------------------------------------------
    console.log('\n[Part 3] Testing Staff Deactivation & Reactivation...');

    // 3.1 Owner cannot deactivate themselves
    const ownerSelfDeactRes = await fetch(`${BASE_URL}/users/${ownerId}/status`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ isActive: false })
    });
    const ownerSelfDeactData: any = await ownerSelfDeactRes.json();
    assert(ownerSelfDeactRes.status === 400 && ownerSelfDeactData.error?.code === 'SELF_DEACTIVATION_NOT_ALLOWED', 'Owner cannot deactivate themselves');

    // 3.2 Staff / Manager cannot deactivate themselves
    const managerSelfDeactRes = await fetch(`${BASE_URL}/users/${testManagerId}/status`, {
      method: 'PATCH',
      headers: managerHeaders,
      body: JSON.stringify({ isActive: false })
    });
    const managerSelfDeactData: any = await managerSelfDeactRes.json();
    assert(managerSelfDeactRes.status === 400 && managerSelfDeactData.error?.code === 'SELF_DEACTIVATION_NOT_ALLOWED', 'Staff cannot deactivate themselves');

    const staffSelfDeactRes = await fetch(`${BASE_URL}/users/${testStaffId}/status`, {
      method: 'PATCH',
      headers: updatedStaffHeaders,
      body: JSON.stringify({ isActive: false })
    });
    assert(staffSelfDeactRes.status === 403, 'Normal staff cannot access deactivation');

    // 3.3 Manager cannot deactivate owner
    const managerDeactOwnerRes = await fetch(`${BASE_URL}/users/${ownerId}/status`, {
      method: 'PATCH',
      headers: managerHeaders,
      body: JSON.stringify({ isActive: false })
    });
    assert(managerDeactOwnerRes.status === 403, 'Manager cannot deactivate owner');

    // 3.4 Manager can deactivate non-owner staff
    const managerDeactStaffRes = await fetch(`${BASE_URL}/users/${testStaffId}/status`, {
      method: 'PATCH',
      headers: managerHeaders,
      body: JSON.stringify({ isActive: false })
    });
    const managerDeactStaffData: any = await managerDeactStaffRes.json();
    assert(managerDeactStaffRes.status === 200 && managerDeactStaffData.success === true, 'Manager can deactivate non-owner staff');

    // 3.5 Deactivated user cannot log in
    const deactLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: testStaffEmail,
        password: 'ManagerAssignedPass@888'
      })
    });
    const deactLoginData: any = await deactLoginRes.json();
    assert(deactLoginRes.status === 403 && deactLoginData.error?.code === 'ACCOUNT_DEACTIVATED', 'Deactivated user cannot login');

    // 3.6 Owner can reactivate staff member
    const reactivateRes = await fetch(`${BASE_URL}/users/${testStaffId}/activate`, {
      method: 'POST',
      headers: ownerHeaders
    });
    const reactivateData: any = await reactivateRes.json();
    assert(reactivateRes.status === 200 && reactivateData.success === true, 'Reactivation works');

    // 3.7 Reactivated staff can log in again
    const reactivateLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: testStaffEmail,
        password: 'ManagerAssignedPass@888'
      })
    });
    assert(reactivateLoginRes.status === 200, 'Reactivated user can log in');

    // -------------------------------------------------------------
    // Part 4: Delete Staff Permissions & Integrity
    // -------------------------------------------------------------
    console.log('\n[Part 4] Testing Delete Staff Permissions & Integrity...');

    // 4.1 Owner cannot delete themselves
    const ownerSelfDeleteRes = await fetch(`${BASE_URL}/users/${ownerId}`, {
      method: 'DELETE',
      headers: ownerHeaders
    });
    const ownerSelfDeleteData: any = await ownerSelfDeleteRes.json();
    assert(ownerSelfDeleteRes.status === 400 && ownerSelfDeleteData.error?.code === 'SELF_DELETE_NOT_ALLOWED', 'Owner cannot delete themselves');

    // 4.2 Staff cannot delete themselves
    const staffSelfDeleteRes = await fetch(`${BASE_URL}/users/${testStaffId}`, {
      method: 'DELETE',
      headers: updatedStaffHeaders
    });
    assert(staffSelfDeleteRes.status === 403 || staffSelfDeleteRes.status === 400, 'Staff cannot delete themselves');

    // 4.3 Manager cannot delete staff
    const managerDeleteStaffRes = await fetch(`${BASE_URL}/users/${testStaffId}`, {
      method: 'DELETE',
      headers: managerHeaders
    });
    assert(managerDeleteStaffRes.status === 403, 'Manager cannot delete staff');

    // 4.4 Primary Owner cannot be deleted
    const deleteOwnerRes = await fetch(`${BASE_URL}/users/${ownerId}`, {
      method: 'DELETE',
      headers: ownerHeaders
    });
    assert(deleteOwnerRes.status === 400, 'Owner cannot be deleted');

    // 4.5 Owner can delete staff (when no historical records)
    const zeroRecordEmail = `zero.record.${Date.now()}@royalbespoke.com`;
    const createZeroRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Zero Records Staff',
        email: zeroRecordEmail,
        role: 'TAILOR',
        password: 'Password@123'
      })
    });
    const createZeroData: any = await createZeroRes.json();
    const zeroStaffId = createZeroData.data.id;

    const deleteRes = await fetch(`${BASE_URL}/users/${zeroStaffId}`, {
      method: 'DELETE',
      headers: ownerHeaders
    });
    const deleteData: any = await deleteRes.json();
    assert(deleteRes.status === 200 && deleteData.success === true, 'Owner can delete staff');

    const deletedUser = await prisma.user.findUnique({ where: { id: zeroStaffId } });
    assert(!deletedUser, 'User record is cleanly hard deleted when no references exist');

    // 4.6 Historical staff references do not cause foreign-key failures (safe soft-decommission)
    console.log('\n[Part 4.6] Testing Historical References Safety...');
    const staffWithRecordsEmail = `staff.with.records.${Date.now()}@royalbespoke.com`;
    const createStaff2Res = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        name: 'Staff With History',
        email: staffWithRecordsEmail,
        role: 'TAILOR',
        password: 'Password@123'
      })
    });
    const createStaff2Data: any = await createStaff2Res.json();
    const staff2Id = createStaff2Data.data.id;

    // Attach historical records: audit log, appointment, etc.
    await prisma.auditLog.create({
      data: {
        tenantId: ownerLoginData.data.user.tenant.id,
        userId: staff2Id,
        action: 'HISTORICAL_TASK_ACTION',
        entity: 'User',
        entityId: staff2Id
      }
    });

    const deleteStaff2Res = await fetch(`${BASE_URL}/users/${staff2Id}`, {
      method: 'DELETE',
      headers: ownerHeaders
    });
    const deleteStaff2Data: any = await deleteStaff2Res.json();
    assert(deleteStaff2Res.status === 200 && deleteStaff2Data.success === true, 'Historical staff references do not cause foreign-key failures');

    const staff2InDb = await prisma.user.findUnique({ where: { id: staff2Id } });
    assert(staff2InDb !== null && staff2InDb.isActive === false, 'Staff with history is safely soft-decommissioned (isActive: false)');
    assert(Boolean(staff2InDb?.passwordHash.startsWith('DECOMMISSIONED_')), 'Password hash is scrambled with DECOMMISSIONED_');

    // Clean up staff2
    await prisma.auditLog.deleteMany({ where: { userId: staff2Id } });
    await prisma.user.delete({ where: { id: staff2Id } });

    // -------------------------------------------------------------
    // Part 5: Security - Password hashes never returned
    // -------------------------------------------------------------
    console.log('\n[Part 5] Testing Password Hash Leak Prevention...');
    const listRes = await fetch(`${BASE_URL}/users`, {
      headers: ownerHeaders
    });
    const listData: any = await listRes.json();
    assert(listData.success === true, 'User list returned successfully');

    let exposedHashCount = 0;
    for (const u of listData.data) {
      if (u.passwordHash || u.password) exposedHashCount++;
    }
    assert(exposedHashCount === 0, 'Password hashes are never returned');

    // Clean up temporary staff & manager
    await prisma.user.deleteMany({
      where: { id: { in: [testStaffId, testManagerId] } }
    });

    console.log(`\n====================================================`);
    console.log(`  STAFF MANAGEMENT VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log(`====================================================\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

runStaffManagementTests();
