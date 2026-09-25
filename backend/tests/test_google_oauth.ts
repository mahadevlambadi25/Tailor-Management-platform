import jwt from 'jsonwebtoken';
import { prisma } from '../src/core/prisma';
import { config } from '../src/config';
import { GoogleAuthService } from '../src/modules/auth/googleAuthService';
import { RoleType, SubscriptionStatus } from '@prisma/client';

const BASE_URL = 'http://localhost:5000';

async function runGoogleOAuthTests() {
  console.log('===============================================================');
  console.log('  GOOGLE OAUTH & AUTHENTICATION INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

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

  // Cleanup test tenant & user helper
  const testEmail = `google_test_${Date.now()}@bespoketailors.test`;
  let createdTenantId: string | null = null;
  let createdUserId: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // 1. URL Generation & State Safety
    // -------------------------------------------------------------------------
    console.log('[Scenario 1] Testing Google Auth URL Generation...');
    const originalClientId = config.googleClientId;
    config.googleClientId = 'test-client-id-123.apps.googleusercontent.com';

    const authUrl = GoogleAuthService.generateGoogleAuthUrl('test-state-abc');
    assert(authUrl.includes('accounts.google.com/o/oauth2/v2/auth'), 'URL points to Google OAuth endpoint');
    assert(authUrl.includes('client_id=test-client-id-123.apps.googleusercontent.com'), 'URL contains configured client_id');
    assert(authUrl.includes('state=test-state-abc'), 'URL contains encoded state parameter');
    assert(authUrl.includes('scope=openid+email+profile') || authUrl.includes('scope=openid%20email%20profile'), 'URL requests openid, email, and profile scopes');

    // -------------------------------------------------------------------------
    // 2. Existing User Login via Google OAuth
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 2] Existing User Google OAuth Login (Royal Bespoke Owner)...');
    const existingEmail = 'owner@royalbespoke.com';
    const initialTenantCount = await prisma.tenant.count();
    const initialUserCount = await prisma.user.count();

    const existingLoginResult = await GoogleAuthService.authenticateOrRegisterGoogleUser({
      email: existingEmail,
      name: 'Mahadev Owner',
      sub: 'google-sub-existing-123'
    });

    assert(existingLoginResult.isNewUser === false, 'Existing user identified as isNewUser=false');
    assert(existingLoginResult.user.email === existingEmail, 'Returned user email matches existing user');
    assert(existingLoginResult.user.role === RoleType.SHOP_OWNER, 'Existing user role preserved as SHOP_OWNER');
    assert(existingLoginResult.user.tenant.slug === 'royal-bespoke', 'User mapped to existing royal-bespoke tenant');

    // Verify token validity
    const decodedExistingToken: any = jwt.verify(existingLoginResult.token, config.jwtSecret);
    assert(decodedExistingToken.email === existingEmail, 'JWT token contains correct email');
    assert(decodedExistingToken.role === 'SHOP_OWNER', 'JWT token contains correct role');

    // Verify no duplicate tenant or user was created
    const postExistingTenantCount = await prisma.tenant.count();
    const postExistingUserCount = await prisma.user.count();
    assert(postExistingTenantCount === initialTenantCount, 'No duplicate tenant created for existing user');
    assert(postExistingUserCount === initialUserCount, 'No duplicate user created for existing user');

    // -------------------------------------------------------------------------
    // 3. New User Registration via Google OAuth
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 3] New User Google OAuth Registration (Fresh Atelier)...');
    const newLoginResult = await GoogleAuthService.authenticateOrRegisterGoogleUser({
      email: testEmail,
      name: 'Aarav Mehta',
      sub: 'google-sub-new-456'
    });

    assert(newLoginResult.isNewUser === true, 'New user identified as isNewUser=true');
    assert(newLoginResult.user.email === testEmail, 'New user email matches Google email');
    assert(newLoginResult.user.name === 'Aarav Mehta', 'New user name extracted from Google profile');
    assert(newLoginResult.user.role === RoleType.SHOP_OWNER, 'New Google registrant assigned SHOP_OWNER role');
    assert(newLoginResult.user.tenant.name === "Aarav Mehta's Atelier", 'Dedicated tenant created for new user');
    assert(newLoginResult.user.tenant.slug.startsWith('aarav-mehta-'), 'Tenant slug derived from name with unique suffix');

    createdTenantId = newLoginResult.user.tenant.id;
    createdUserId = newLoginResult.user.id;

    // Verify database records for new tenant
    const createdTenant = await prisma.tenant.findUnique({
      where: { id: createdTenantId },
      include: { branches: true, subscription: true, users: true }
    });

    assert(!!createdTenant, 'Tenant record exists in database');
    assert(createdTenant?.isDemo === false, 'New tenant is not a demo tenant');
    assert(createdTenant?.isActive === true, 'New tenant is active');

    // Verify primary branch
    assert(createdTenant?.branches.length === 1, 'Main workshop branch created');
    assert(createdTenant?.branches[0].isMain === true, 'Branch marked as isMain=true');

    // Verify initial subscription matches trial-enforcement architecture
    assert(!!createdTenant?.subscription, 'Initial subscription record exists');
    assert(createdTenant?.subscription?.planName === 'FREE_TRIAL', 'Initial subscription planName is FREE_TRIAL');
    assert(createdTenant?.subscription?.status === SubscriptionStatus.PENDING, 'Initial subscription status is PENDING');
    assert(createdTenant?.subscription?.trialUsed === false, 'Initial subscription has trialUsed=false (eligible for 14-day trial)');

    // Verify user record
    const createdUser = createdTenant?.users[0];
    assert(createdUser?.email === testEmail, 'User stored with correct email');
    assert(createdUser?.role === RoleType.SHOP_OWNER, 'User stored with SHOP_OWNER role');
    assert(typeof createdUser?.passwordHash === 'string' && createdUser.passwordHash.length > 20, 'Cryptographically secure password hash generated');

    // Verify JWT token for new user
    const decodedNewToken: any = jwt.verify(newLoginResult.token, config.jwtSecret);
    assert(decodedNewToken.email === testEmail, 'New user JWT email matches');
    assert(decodedNewToken.tenantId === createdTenantId, 'New user JWT tenantId matches new tenant');

    // -------------------------------------------------------------------------
    // 4. Subsequent Login for the Same Google User (Zero Duplicates)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 4] Subsequent Login for Same Google User...');
    const tenantCountBeforeReLogin = await prisma.tenant.count();
    const userCountBeforeReLogin = await prisma.user.count();

    const reLoginResult = await GoogleAuthService.authenticateOrRegisterGoogleUser({
      email: testEmail,
      name: 'Aarav Mehta',
      sub: 'google-sub-new-456'
    });

    assert(reLoginResult.isNewUser === false, 'Subsequent login recognized as existing user (isNewUser=false)');
    assert(reLoginResult.user.id === createdUserId, 'Matched exact same user ID');
    assert(reLoginResult.user.tenant.id === createdTenantId, 'Matched exact same tenant ID');

    const tenantCountAfterReLogin = await prisma.tenant.count();
    const userCountAfterReLogin = await prisma.user.count();
    assert(tenantCountAfterReLogin === tenantCountBeforeReLogin, 'No duplicate tenant on re-login');
    assert(userCountAfterReLogin === userCountBeforeReLogin, 'No duplicate user on re-login');

    // -------------------------------------------------------------------------
    // 5. Tenant Isolation Verification
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 5] Tenant Isolation Verification...');
    assert(createdTenantId !== 'royal-bespoke', 'New user tenant is distinct from Royal Bespoke');
    assert(createdTenant?.slug !== 'demo-tailors', 'New user tenant is distinct from Demo Tailors');

    // -------------------------------------------------------------------------
    // 6. Security Guards: Inactive Tenant & Deactivated User
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 6] Security Guards: Inactive Tenant & Deactivated User...');
    // A. Deactivated user
    await prisma.user.update({
      where: { id: createdUserId },
      data: { isActive: false }
    });

    let deactivatedRejected = false;
    try {
      await GoogleAuthService.authenticateOrRegisterGoogleUser({ email: testEmail });
    } catch (err: any) {
      if (err.code === 'ACCOUNT_DEACTIVATED') {
        deactivatedRejected = true;
      }
    }
    assert(deactivatedRejected, 'Deactivated user rejected with ACCOUNT_DEACTIVATED');

    // Re-activate user, deactivate tenant
    await prisma.user.update({
      where: { id: createdUserId },
      data: { isActive: true }
    });

    await prisma.tenant.update({
      where: { id: createdTenantId! },
      data: { isActive: false }
    });

    let inactiveTenantRejected = false;
    try {
      await GoogleAuthService.authenticateOrRegisterGoogleUser({ email: testEmail });
    } catch (err: any) {
      if (err.code === 'TENANT_INACTIVE') {
        inactiveTenantRejected = true;
      }
    }
    assert(inactiveTenantRejected, 'Inactive tenant rejected with TENANT_INACTIVE');

    // Restore tenant
    await prisma.tenant.update({
      where: { id: createdTenantId! },
      data: { isActive: true }
    });

    // -------------------------------------------------------------------------
    // 7. HTTP API Regression Testing (Standard Email/Password & Demo Login)
    // -------------------------------------------------------------------------
    console.log('\n[Scenario 7] HTTP API Regression: Existing Login Unchanged...');

    // A. Standard Royal Bespoke login
    const royalLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'owner@royalbespoke.com',
        password: 'Password@123'
      })
    });
    assert(royalLoginRes.status === 200, 'Existing Royal Bespoke email/password login returns HTTP 200');

    // B. Demo Tailors login
    const demoLoginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'demo-tailors',
        email: 'owner@demo-tailors.com',
        password: 'Password@123'
      })
    });
    assert(demoLoginRes.status === 200, 'Existing Demo Tailors login returns HTTP 200');

    // C. Incorrect password rejection
    const wrongPassRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantSlug: 'royal-bespoke',
        email: 'owner@royalbespoke.com',
        password: 'WrongPassword'
      })
    });
    assert(wrongPassRes.status === 401, 'Incorrect password rejected with HTTP 401');

    // D. Google direct token login rejects missing credentials
    const googleEmptyRes = await fetch(`${BASE_URL}/api/v1/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert(googleEmptyRes.status === 400, 'POST /auth/google rejects missing credentials with HTTP 400');

    // Restore original client id
    config.googleClientId = originalClientId;

  } finally {
    // Teardown: Clean up test tenant
    if (createdTenantId) {
      console.log('\n[Teardown] Cleaning up test Google tenant...');
      await prisma.user.deleteMany({ where: { tenantId: createdTenantId } });
      await prisma.subscription.deleteMany({ where: { tenantId: createdTenantId } });
      await prisma.branch.deleteMany({ where: { tenantId: createdTenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId: createdTenantId } });
      await prisma.tenant.delete({ where: { id: createdTenantId } });
      console.log('  ✔ Test tenant cleaned up successfully.');
    }
  }

  console.log('\n===============================================================');
  console.log(`  FINAL RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runGoogleOAuthTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
