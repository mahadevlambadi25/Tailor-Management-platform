import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.resolve('C:\\Users\\Reshma\\AppData\\Local\\Temp\\chrome_cdp_staff_eval');
const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000/api/v1';

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

  async evaluate(expression: string): Promise<any> {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res?.result?.value;
  }

  async wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  close() {
    this.ws?.close();
  }
}

async function runStaffUiVerification() {
  console.log('===============================================================');
  console.log('  STARTING STAFF MANAGEMENT FRONTEND UI VERIFICATION (via CDP) ');
  console.log('===============================================================');

  if (fs.existsSync(TEMP_PROFILE)) {
    try { fs.rmSync(TEMP_PROFILE, { recursive: true, force: true }); } catch {}
  }

  // 1. Obtain owner authentication token from backend API
  console.log('\n[1/6] Obtaining authenticated owner session...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenantSlug: 'royal-bespoke',
      email: 'owner@royalbespoke.com',
      password: 'Password@123'
    })
  });
  const loginData: any = await loginRes.json();
  if (!loginData.success) throw new Error('API login failed: ' + JSON.stringify(loginData));
  const token = loginData.data.token;
  const user = loginData.data.user;

  const chromeProc = spawn(CHROME_PATH, [
    '--remote-debugging-port=9222',
    `--user-data-dir=${TEMP_PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    `${APP_URL}/login`
  ]);

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
    // Wait for Chrome to bind port 9222
    let versionData: any = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const resp = await fetch('http://127.0.0.1:9222/json/version');
        versionData = await resp.json();
        break;
      } catch {}
    }

    if (!versionData) throw new Error('Chrome did not initialize debugging port 9222.');

    const targetsResp = await fetch('http://127.0.0.1:9222/json/list');
    const targets: any = await targetsResp.json();
    const pageTarget = targets.find((t: any) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found.');

    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');

    console.log('[2/6] Injecting session and loading Dashboard...');
    await cdp.send('Page.navigate', { url: `${APP_URL}/login` });
    await cdp.wait(1500);

    // Inject session credentials
    await cdp.evaluate(`
      (() => {
        localStorage.setItem('tailor_token', ${JSON.stringify(token)});
        localStorage.setItem('tailor_user', ${JSON.stringify(JSON.stringify(user))});
        localStorage.setItem('tailor_tenant_slug', 'royal-bespoke');
      })()
    `);

    // Navigate to /staff
    await cdp.send('Page.navigate', { url: `${APP_URL}/staff` });
    await cdp.wait(2500);

    const currentPath = await cdp.evaluate('window.location.pathname');
    assert(currentPath === '/staff', 'Successfully loaded /staff with authenticated session');

    // -------------------------------------------------------------
    // Test 3: Navbar "Change Password" button
    // -------------------------------------------------------------
    console.log('\n[3/6] Verifying Navbar "Change Password" button...');
    const navbarBtnCheck = await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('header button[title="Change Password"], header button[aria-label="Change Password"]');
        return { exists: !!btn };
      })()
    `);
    assert(navbarBtnCheck.exists, 'Navbar contains "Change Password" button (Key icon)');

    // Click Navbar Change Password button
    await cdp.evaluate(`
      (() => {
        const btn = document.querySelector('header button[title="Change Password"], header button[aria-label="Change Password"]');
        if (btn) btn.click();
      })()
    `);
    await cdp.wait(800);

    const ownModalCheck = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Change Password"]');
        const title = modal?.querySelector('h2')?.textContent;
        const currentInput = modal?.querySelector('input[placeholder*="current password" i]');
        const newInput = modal?.querySelector('input[placeholder*="Minimum 6 characters" i]');
        const confirmInput = modal?.querySelector('input[placeholder*="Re-enter new password" i]');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');
        const submitBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Change Password'));

        return {
          isOpen: !!modal,
          title,
          hasCurrentInput: !!currentInput,
          hasNewInput: !!newInput,
          hasConfirmInput: !!confirmInput,
          hasCancelBtn: !!cancelBtn,
          hasSubmitBtn: !!submitBtn
        };
      })()
    `);

    assert(ownModalCheck.isOpen, 'Own "Change Password" modal opened');
    assert(ownModalCheck.title === 'Change Password', 'Modal title is "Change Password"');
    assert(ownModalCheck.hasCurrentInput, 'Modal has Current Password input');
    assert(ownModalCheck.hasNewInput, 'Modal has New Password input');
    assert(ownModalCheck.hasConfirmInput, 'Modal has Confirm New Password input');
    assert(ownModalCheck.hasCancelBtn && ownModalCheck.hasSubmitBtn, 'Modal has Cancel and Change Password action buttons');

    // Close the own password modal
    await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Change Password"]');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.wait(500);

    // -------------------------------------------------------------
    // Test 4: Table columns and Status badges
    // -------------------------------------------------------------
    console.log('\n[4/6] Verifying Staff table columns and status badges...');
    const tableColumns = await cdp.evaluate(`
      (() => {
        const ths = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent?.trim());
        return ths;
      })()
    `);

    assert(tableColumns.includes('Staff Member'), 'Table contains "Staff Member" column');
    assert(tableColumns.includes('Role'), 'Table contains "Role" column');
    assert(tableColumns.includes('Status'), 'Table contains "Status" column');
    assert(tableColumns.includes('Branch Location'), 'Table contains "Branch Location" column');
    assert(tableColumns.includes('Skills / Specializations'), 'Table contains "Skills / Specializations" column');
    assert(tableColumns.includes('Last Active'), 'Table contains "Last Active" column');
    assert(tableColumns.includes('Actions'), 'Table contains "Actions" column');

    const rowsEvaluation = await cdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.map(r => {
          const text = r.innerText;
          const buttons = Array.from(r.querySelectorAll('button')).map(b => b.textContent?.trim());
          const hasActiveBadge = text.includes('Active');
          const hasDeactivatedBadge = text.includes('Deactivated');
          const isYou = text.includes('You');
          return { text, buttons, hasActiveBadge, hasDeactivatedBadge, isYou };
        });
      })()
    `);

    const ownerRow = rowsEvaluation.find((r: any) => r.isYou || r.text.includes('owner@royalbespoke.com'));
    assert(!!ownerRow, 'Owner row found in staff table');
    assert(ownerRow?.buttons.includes('Change Password'), 'Owner row has own "Change Password" button');
    assert(ownerRow?.hasActiveBadge, 'Owner row displays Active status badge');

    const tailorRow = rowsEvaluation.find((r: any) => !r.isYou && r.text.includes('tailor@royalbespoke.com'));
    assert(!!tailorRow, 'Tailor row found in staff table');
    assert(tailorRow?.buttons.includes('Reset Password'), 'Tailor row has admin "Reset Password" button');
    assert(tailorRow?.buttons.includes('Deactivate'), 'Tailor row has "Deactivate" button');
    assert(tailorRow?.buttons.includes('Delete'), 'Tailor row has "Delete" button');

    // -------------------------------------------------------------
    // Test 5: Admin Reset Staff Password Modal
    // -------------------------------------------------------------
    console.log('\n[5/6] Verifying Admin Reset Staff Password Modal...');
    await cdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const tailor = rows.find(r => r.innerText.includes('tailor@royalbespoke.com'));
        const resetBtn = Array.from(tailor?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Reset Password'));
        if (resetBtn) resetBtn.click();
      })()
    `);
    await cdp.wait(800);

    const adminResetCheck = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Change Staff Password"]');
        const title = modal?.querySelector('h2')?.textContent;
        const newInput = modal?.querySelector('input[placeholder*="new password" i]');
        const confirmInput = modal?.querySelector('input[placeholder*="Re-enter new password" i]');
        const hasStaffInfo = modal?.innerText.includes('tailor@royalbespoke.com') || modal?.innerText.includes('Staff Member');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');
        const updateBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Update Password'));

        return {
          isOpen: !!modal,
          title,
          hasStaffInfo,
          newInput: !!newInput,
          confirmInput: !!confirmInput,
          cancelBtn: !!cancelBtn,
          updateBtn: !!updateBtn
        };
      })()
    `);

    assert(adminResetCheck.isOpen, 'Admin Reset Staff Password modal opened');
    assert(adminResetCheck.title === 'Change Staff Password', 'Modal title is "Change Staff Password"');
    assert(adminResetCheck.hasStaffInfo, 'Modal displays target staff member info');
    assert(adminResetCheck.newInput && adminResetCheck.confirmInput, 'Modal has New Password and Confirm New Password inputs');
    assert(adminResetCheck.cancelBtn && adminResetCheck.updateBtn, 'Modal has Cancel and Update Password action buttons');

    // Close admin reset modal
    await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Change Staff Password"]');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.wait(500);

    // -------------------------------------------------------------
    // Test 6: Deactivate & Delete Confirmation Modals
    // -------------------------------------------------------------
    console.log('\n[6/6] Verifying Deactivate & Delete Confirmation Modals...');

    // Open Deactivate modal
    await cdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const tailor = rows.find(r => r.innerText.includes('tailor@royalbespoke.com'));
        const deactBtn = Array.from(tailor?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Deactivate'));
        if (deactBtn) deactBtn.click();
      })()
    `);
    await cdp.wait(800);

    const deactCheck = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Deactivate Staff?"]');
        const title = modal?.querySelector('h2')?.textContent;
        const text = modal?.innerText || '';
        const hasWarning = text.includes('They will no longer be able to sign in, but their existing business records will be preserved.');
        const deactBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Deactivate');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');

        return {
          isOpen: !!modal,
          title,
          hasWarning,
          deactBtn: !!deactBtn,
          cancelBtn: !!cancelBtn
        };
      })()
    `);

    assert(deactCheck.isOpen, 'Deactivate Staff modal opened');
    assert(deactCheck.title === 'Deactivate Staff?', 'Modal title is "Deactivate Staff?"');
    assert(deactCheck.hasWarning, 'Modal displays business records preservation notice');
    assert(deactCheck.deactBtn && deactCheck.cancelBtn, 'Modal has Deactivate and Cancel buttons');

    // Close deactivate modal
    await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Deactivate Staff?"]');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.wait(500);

    // Open Delete modal
    await cdp.evaluate(`
      (() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        const tailor = rows.find(r => r.innerText.includes('tailor@royalbespoke.com'));
        const delBtn = Array.from(tailor?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Delete'));
        if (delBtn) delBtn.click();
      })()
    `);
    await cdp.wait(800);

    const delCheck = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Delete Staff Member?"]');
        const title = modal?.querySelector('h2')?.textContent;
        const text = modal?.innerText || '';
        const hasWarning = text.includes('Are you sure you want to permanently remove') && text.includes('This action cannot be undone.');
        const deleteBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.includes('Delete Staff'));
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');

        return {
          isOpen: !!modal,
          title,
          hasWarning,
          deleteBtn: !!deleteBtn,
          cancelBtn: !!cancelBtn
        };
      })()
    `);

    assert(delCheck.isOpen, 'Delete Staff modal opened');
    assert(delCheck.title === 'Delete Staff Member?', 'Modal title is "Delete Staff Member?"');
    assert(delCheck.hasWarning, 'Modal displays permanent removal warning: "This action cannot be undone."');
    assert(delCheck.deleteBtn && delCheck.cancelBtn, 'Modal has Delete Staff and Cancel action buttons');

    // Close delete modal
    await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('[role="dialog"][aria-label="Delete Staff Member?"]');
        const cancelBtn = Array.from(modal?.querySelectorAll('button') || []).find(b => b.textContent?.trim() === 'Cancel');
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.wait(500);

    console.log('\n===============================================================');
    console.log(`  STAFF UI VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) process.exit(1);
  } catch (err: any) {
    console.error('Staff UI verification error:', err);
    process.exit(1);
  } finally {
    if (cdp) cdp.close();
    chromeProc.kill('SIGKILL');
    if (fs.existsSync(TEMP_PROFILE)) {
      try { fs.rmSync(TEMP_PROFILE, { recursive: true, force: true }); } catch {}
    }
  }
}

runStaffUiVerification();
