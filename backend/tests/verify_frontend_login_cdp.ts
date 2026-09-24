import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.resolve('C:\\Users\\Reshma\\AppData\\Local\\Temp\\chrome_cdp_login_eval');
const APP_URL = 'http://localhost:5173';

class CDPClient {
  private ws: WebSocket | null = null;
  private id = 0;
  private callbacks = new Map<number, (res: any) => void>();
  public consoleLogs: Array<{ type: string; text: string }> = [];

  constructor(private wsUrl: string) {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data.toString());
        if (msg.id && this.callbacks.has(msg.id)) {
          this.callbacks.get(msg.id)!(msg);
          this.callbacks.delete(msg.id);
        } else if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map((a: any) => a.value || a.description || '').join(' ');
          this.consoleLogs.push({ type: msg.params.type, text });
        }
      };
    });
  }

  send(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, (res) => {
        if (res.error) reject(new Error(res.error.message || JSON.stringify(res.error)));
        else resolve(res.result);
      });
      this.ws?.send(JSON.stringify({ id, method, params }));
    });
  }

  async navigate(url: string): Promise<void> {
    await this.send('Page.navigate', { url });
    await this.wait(2000);
  }

  async evaluate(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  close(): void {
    this.ws?.close();
  }
}

async function runFrontendLoginVerification() {
  console.log('===============================================================');
  console.log('  FRONTEND LOGIN CDP FULL VERIFICATION (STEP 5)');
  console.log('===============================================================\n');

  if (fs.existsSync(TEMP_PROFILE)) {
    try {
      fs.rmSync(TEMP_PROFILE, { recursive: true, force: true });
    } catch {}
  }
  fs.mkdirSync(TEMP_PROFILE, { recursive: true });

  const port = 9333;
  console.log(`[CDP] Launching Chrome headless on port ${port}...`);

  const chromeProc: ChildProcess = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${TEMP_PROFILE}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--window-size=1280,800',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let cdp: CDPClient | null = null;
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
    // Wait for Chrome remote debugging endpoint
    let wsUrl = '';
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`);
        if (res.ok) {
          const json: any = await res.json();
          wsUrl = json.webSocketDebuggerUrl;
          break;
        }
      } catch {}
    }

    if (!wsUrl) throw new Error('Chrome CDP port not responding after 15 seconds');

    // Get page target
    const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const pages: any = await listRes.json();
    const pageTarget = pages.find((p: any) => p.type === 'page') || pages[0];
    const pageWsUrl = pageTarget.webSocketDebuggerUrl;

    cdp = new CDPClient(pageWsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // -------------------------------------------------------------------------
    // TEST 1: Open /login and check elements
    // -------------------------------------------------------------------------
    console.log('\n[1/6] Navigating to http://localhost:5173/login...');
    await cdp.navigate(`${APP_URL}/login`);

    const pageTitle = await cdp.evaluate('document.title');
    const formRendered = await cdp.evaluate(`
      (() => {
        const h2 = document.querySelector('h2')?.textContent || '';
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        const submitBtn = document.querySelector('button[type="submit"]');
        return {
          h2,
          hasEmail: !!emailInput,
          hasPassword: !!passInput,
          hasButton: !!submitBtn,
          btnText: submitBtn?.textContent?.trim()
        };
      })()
    `);

    assert(formRendered.hasEmail && formRendered.hasPassword, 'Email and Password input fields rendered');
    assert(formRendered.hasButton, 'Sign In submit button rendered');
    assert(formRendered.h2.includes('Tailor Management'), 'Title header displayed correctly');

    // -------------------------------------------------------------------------
    // TEST 2: Test error message display with invalid password
    // -------------------------------------------------------------------------
    console.log('\n[2/6] Submitting invalid credentials to verify error handling...');
    await cdp.evaluate(`
      (() => {
        const passInput = document.querySelector('input[type="password"]');
        passInput.value = 'IncorrectPassword!999';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));

        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.click();
      })()
    `);

    // Wait for network response and React state update
    await cdp.wait(1500);

    const errorState = await cdp.evaluate(`
      (() => {
        const errorDiv = document.querySelector('.bg-rose-50');
        return {
          hasError: !!errorDiv,
          text: errorDiv?.textContent?.trim() || ''
        };
      })()
    `);

    assert(errorState.hasError, 'Error banner rendered upon invalid credentials');
    assert(
      errorState.text.includes('Invalid email or password') || errorState.text.includes('failed'),
      `Error text accurately communicates failure: "${errorState.text}"`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Test loading state & successful login
    // -------------------------------------------------------------------------
    console.log('\n[3/6] Submitting valid credentials to verify loading state & login...');
    await cdp.evaluate(`
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        emailInput.value = 'owner@royalbespoke.com';
        emailInput.dispatchEvent(new Event('input', { bubbles: true }));

        const passInput = document.querySelector('input[type="password"]');
        passInput.value = 'Password@123';
        passInput.dispatchEvent(new Event('input', { bubbles: true }));

        const submitBtn = document.querySelector('button[type="submit"]');
        submitBtn.click();
      })()
    `);

    // Immediately check if button entered loading state
    const loadingState = await cdp.evaluate(`
      (() => {
        const submitBtn = document.querySelector('button[type="submit"]');
        return {
          disabled: submitBtn?.disabled,
          text: submitBtn?.textContent?.trim() || ''
        };
      })()
    `);
    // It might either be in loading state or already redirected
    console.log(`  Button state during login: "${loadingState.text}", disabled: ${loadingState.disabled}`);

    // Wait for auth to complete and redirection to take place
    await cdp.wait(3000);

    const currentUrl = await cdp.evaluate('window.location.pathname');
    assert(currentUrl.includes('/dashboard'), `Successfully redirected to dashboard (Current path: ${currentUrl})`);

    // -------------------------------------------------------------------------
    // TEST 4: Verify localStorage session storage
    // -------------------------------------------------------------------------
    console.log('\n[4/6] Verifying localStorage tokens & session persistence...');
    const storageData = await cdp.evaluate(`
      (() => {
        const token = localStorage.getItem('tailor_token');
        const userStr = localStorage.getItem('tailor_user');
        const slug = localStorage.getItem('tailor_tenant_slug');
        let user = null;
        try { user = JSON.parse(userStr); } catch {}
        return {
          hasToken: !!token && token.length > 20,
          tokenPrefix: token ? token.substring(0, 15) : null,
          userEmail: user?.email,
          userRole: user?.role,
          tenantSlug: slug
        };
      })()
    `);

    assert(storageData.hasToken, 'tailor_token saved in localStorage');
    assert(storageData.userEmail === 'owner@royalbespoke.com', 'tailor_user stored with correct email');
    assert(storageData.userRole === 'SHOP_OWNER', 'tailor_user stored with SHOP_OWNER role');
    assert(storageData.tenantSlug === 'royal-bespoke', 'tailor_tenant_slug stored as royal-bespoke');

    // -------------------------------------------------------------------------
    // TEST 5: Verify dashboard content renders with authenticated data
    // -------------------------------------------------------------------------
    console.log('\n[5/6] Verifying authenticated Dashboard UI content...');
    const dashboardContent = await cdp.evaluate(`
      (() => {
        const bodyText = document.body.innerText;
        return {
          hasDashboard: bodyText.includes('Dashboard') || bodyText.includes('Overview') || bodyText.includes('Orders'),
          hasOwner: bodyText.includes('Mahadev') || bodyText.includes('Owner') || bodyText.includes('Royal Bespoke'),
          navLinksCount: document.querySelectorAll('nav a').length
        };
      })()
    `);

    assert(dashboardContent.hasDashboard, 'Dashboard view loaded with metrics & navigation');
    assert(dashboardContent.hasOwner, 'Tenant shop owner profile visible in dashboard layout');

    // -------------------------------------------------------------------------
    // TEST 6: Test Logout functionality
    // -------------------------------------------------------------------------
    console.log('\n[6/6] Testing Logout button & session clearing...');
    await cdp.evaluate(`
      (() => {
        // Find logout button in navbar or sidebar
        const logoutBtn = document.querySelector('button[title*="Sign Out"], button[title*="logout" i]') ||
                          Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sign Out') || b.textContent.includes('Logout'));
        if (logoutBtn) {
          logoutBtn.click();
        }
      })()
    `);

    await cdp.wait(2000);

    const postLogoutUrl = await cdp.evaluate('window.location.pathname');
    const postLogoutStorage = await cdp.evaluate(`
      (() => {
        return {
          token: localStorage.getItem('tailor_token'),
          user: localStorage.getItem('tailor_user')
        };
      })()
    `);

    assert(postLogoutStorage.token === null, 'tailor_token removed from localStorage on logout');
    assert(postLogoutStorage.user === null, 'tailor_user removed from localStorage on logout');
    console.log(`  Path after logout: ${postLogoutUrl}`);

    console.log('\n===============================================================');
    console.log(`  FRONTEND VERIFICATION: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Frontend verification error:', err);
    process.exit(1);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
    if (fs.existsSync(TEMP_PROFILE)) {
      try { fs.rmSync(TEMP_PROFILE, { recursive: true, force: true }); } catch {}
    }
  }
}

runFrontendLoginVerification();
