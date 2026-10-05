import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.resolve('C:\\Users\\Reshma\\AppData\\Local\\Temp\\chrome_debug_dom');
const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000/api/v1';

async function debug() {
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
  const token = loginData.data.token;
  const user = loginData.data.user;

  if (fs.existsSync(TEMP_PROFILE)) {
    try { fs.rmSync(TEMP_PROFILE, { recursive: true, force: true }); } catch {}
  }

  const chromeProc = spawn(CHROME_PATH, [
    '--remote-debugging-port=9224',
    `--user-data-dir=${TEMP_PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    `${APP_URL}/login`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const listRes = await fetch('http://127.0.0.1:9224/json/list');
  const pages: any = await listRes.json();
  const page = pages.find((p: any) => p.type === 'page');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 0;
  const callbacks = new Map<number, (res: any) => void>();
  const consoleLogs: string[] = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)!(msg);
      callbacks.delete(msg.id);
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      consoleLogs.push(msg.params.args.map((a: any) => a.value || a.description || '').join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleLogs.push('EXCEPTION: ' + JSON.stringify(msg.params.exceptionDetails));
    }
  };

  function send(method: string, params: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const curId = ++id;
      callbacks.set(curId, (res) => {
        if (res.error) reject(res.error);
        else resolve(res.result);
      });
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }

  async function evaluate(expression: string) {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  // Set mobile viewport 390x844
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  // Navigate to login, set auth
  await send('Page.navigate', { url: `${APP_URL}/login` });
  await new Promise(r => setTimeout(r, 1500));

  await evaluate(`
    localStorage.setItem('tailor_token', ${JSON.stringify(token)});
    localStorage.setItem('tailor_user', ${JSON.stringify(JSON.stringify(user))});
    localStorage.setItem('tailor_tenant_slug', 'royal-bespoke');
    localStorage.setItem('onboarding_completed_${user.tenant.id}', 'true');
    localStorage.setItem('onboarding_dismissed_${user.tenant.id}', 'true');
  `);

  // Navigate to /dashboard
  await send('Page.navigate', { url: `${APP_URL}/dashboard` });
  await new Promise(r => setTimeout(r, 3000));

  const debugInfo = await evaluate(`
    (() => {
      const toRect = (r) => r ? ({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }) : null;
      const header = document.querySelector('header');
      const headerRect = toRect(header ? header.getBoundingClientRect() : null);
      const headerStyles = header ? window.getComputedStyle(header) : null;
      const main = document.querySelector('main');
      const mainRect = toRect(main ? main.getBoundingClientRect() : null);
      const bottomNav = document.querySelector('nav[aria-label="Mobile Navigation"]');
      const bottomNavRect = toRect(bottomNav ? bottomNav.getBoundingClientRect() : null);
      const bodyChildren = Array.from(document.body.children).map(c => ({
        tag: c.tagName,
        id: c.id,
        className: c.className,
        rect: c.getBoundingClientRect()
      }));

      return {
        url: window.location.href,
        headerExists: Boolean(header),
        headerRect,
        headerDisplay: headerStyles ? headerStyles.display : null,
        headerVisibility: headerStyles ? headerStyles.visibility : null,
        headerHeight: headerStyles ? headerStyles.height : null,
        headerTop: headerStyles ? headerStyles.top : null,
        headerPosition: headerStyles ? headerStyles.position : null,
        mainExists: Boolean(main),
        mainRect,
        bottomNavExists: Boolean(bottomNav),
        bottomNavRect,
        bodyChildren,
        appRootHtml: document.getElementById('root')?.innerHTML?.slice(0, 1500)
      };
    })()
  `);

  console.log('DEBUG INFO:', JSON.stringify(debugInfo, null, 2));
  console.log('CONSOLE LOGS:', consoleLogs);

  ws.close();
  chromeProc.kill();
}

debug().catch(console.error);
