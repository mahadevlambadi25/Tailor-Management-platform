import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = path.resolve('C:\\Users\\Reshma\\AppData\\Local\\Temp\\chrome_screenshot');
const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5000/api/v1';

async function capture() {
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
    '--remote-debugging-port=9225',
    `--user-data-dir=${TEMP_PROFILE}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    `${APP_URL}/login`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const listRes = await fetch('http://127.0.0.1:9225/json/list');
  const pages: any = await listRes.json();
  const page = pages.find((p: any) => p.type === 'page');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 0;
  const callbacks = new Map<number, (res: any) => void>();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)!(msg);
      callbacks.delete(msg.id);
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Page.navigate', { url: `${APP_URL}/login` });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('tailor_token', ${JSON.stringify(token)});
      localStorage.setItem('tailor_user', ${JSON.stringify(JSON.stringify(user))});
      localStorage.setItem('tailor_tenant_slug', 'royal-bespoke');
      localStorage.setItem('onboarding_completed_${user.tenant.id}', 'true');
      localStorage.setItem('onboarding_dismissed_${user.tenant.id}', 'true');
    `
  });

  await send('Page.navigate', { url: `${APP_URL}/dashboard` });
  await new Promise(r => setTimeout(r, 3000));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const outPath = path.resolve(__dirname, 'mobile_screenshot.png');
  fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
  console.log('Screenshot saved to:', outPath);

  ws.close();
  chromeProc.kill();
}

capture().catch(console.error);
