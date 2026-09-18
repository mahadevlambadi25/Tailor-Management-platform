async function testLiveDemoFlow() {
  const BASE_URL = 'http://localhost:5000/api/v1';

  console.log('1. Logging in as shop owner...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: 'royal-bespoke',
      email: 'owner@royalbespoke.com',
      password: 'Password@123'
    })
  });

  const loginData: any = await loginRes.json();
  if (!loginData.success) {
    throw new Error('Login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.data.token;
  console.log('  ✔ Logged in, token received.');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'x-tenant-slug': 'royal-bespoke'
  };

  console.log('2. Checking initial tenant demo status...');
  let tenantRes = await fetch(`${BASE_URL}/tenants`, { headers });
  let tenantData: any = await tenantRes.json();
  console.log('  Demo stats:', tenantData.data.demoStats);

  console.log('3. Loading demo data via POST /tenants/demo-data/load...');
  const loadRes = await fetch(`${BASE_URL}/tenants/demo-data/load`, {
    method: 'POST',
    headers
  });
  const loadData: any = await loadRes.json();
  console.log('  Message:', loadData.message);

  tenantRes = await fetch(`${BASE_URL}/tenants`, { headers });
  tenantData = await tenantRes.json();
  console.log('  Demo stats after load:', tenantData.data.demoStats);
  if (!tenantData.data.demoStats.hasDemoData) {
    throw new Error('Expected hasDemoData to be true after load!');
  }

  console.log('4. Activating subscription via POST /tenants/subscribe (auto-purging demo data)...');
  const subRes = await fetch(`${BASE_URL}/tenants/subscribe`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      planName: 'PRO_ENTERPRISE_ACTIVE',
      clearDemo: true
    })
  });
  const subData: any = await subRes.json();
  console.log('  Subscription message:', subData.message);
  console.log('  Purge result:', subData.data?.purgeResult);

  tenantRes = await fetch(`${BASE_URL}/tenants`, { headers });
  tenantData = await tenantRes.json();
  console.log('  Demo stats after subscribe:', tenantData.data.demoStats);
  console.log('  Subscription status:', tenantData.data.subscription?.status);

  if (tenantData.data.demoStats.hasDemoData) {
    throw new Error('Expected hasDemoData to be false after subscribe purge!');
  }

  console.log('5. Loading demo data again to test manual clear...');
  await fetch(`${BASE_URL}/tenants/demo-data/load`, { method: 'POST', headers });
  tenantRes = await fetch(`${BASE_URL}/tenants`, { headers });
  tenantData = await tenantRes.json();
  console.log('  Demo stats after second load:', tenantData.data.demoStats);

  console.log('6. Clearing demo data via POST /tenants/demo-data/clear...');
  const clearRes = await fetch(`${BASE_URL}/tenants/demo-data/clear`, { method: 'POST', headers });
  const clearData: any = await clearRes.json();
  console.log('  Clear message:', clearData.message);

  tenantRes = await fetch(`${BASE_URL}/tenants`, { headers });
  tenantData = await tenantRes.json();
  console.log('  Demo stats after clear:', tenantData.data.demoStats);
  if (tenantData.data.demoStats.hasDemoData) {
    throw new Error('Expected hasDemoData to be false after manual clear!');
  }

  console.log('\n✔ ALL LIVE HTTP DEMO LIFECYCLE TESTS PASSED PERFECTLY!');
}

testLiveDemoFlow().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
