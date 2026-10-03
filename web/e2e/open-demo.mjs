// Opens Earmark in two visible Chrome windows on the local chain, each with a test wallet already connected:
// the sender (laptop size) and the family member (phone size). Local preview only; nothing here ships.
// Usage (from web/): node e2e/open-demo.mjs   (needs anvil, the local setup, the seeded rehearsal and `npx vite`)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const src = readFileSync('e2e/rehearsal.mjs', 'utf8');
const shim = src.slice(src.indexOf('function walletShim'), src.indexOf('async function openAs'));

const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const FAMILY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const COFUNDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const TRADER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const SCHOOL = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

// Names each person would have saved on their own device (D4: names never leave the browser).
const senderNames = { [FAMILY]: 'Mama', [COFUNDER]: 'Tunde', [TRADER]: 'Rice seller', [SCHOOL]: 'Bright Future School' };
const familyNames = { [SENDER]: 'Ṣadé', [COFUNDER]: 'Tunde', [TRADER]: 'Rice seller', [SCHOOL]: 'Bright Future School' };
const lower = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));

async function open({ account, names, width, height, x, path }) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: false,
    args: [`--window-size=${width},${height}`, `--window-position=${x},20`, '--app=about:blank'],
  });
  const context = await browser.newContext({ viewport: null });
  await context.addInitScript(`${shim}; walletShim({ account: '${account}', rpc: 'http://127.0.0.1:8545', chainId: '0x4cef52' });`);
  await context.addInitScript((book) => {
    try {
      if (!localStorage.getItem('ek-names')) localStorage.setItem('ek-names', JSON.stringify(book));
    } catch {}
  }, lower(names));
  const page = await context.newPage();
  await page.goto(`${APP}/#/`);
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.waitForURL(/#\/(send|family)$/);
  if (path) await page.goto(`${APP}${path}`);
  return browser;
}

const sender = await open({ account: SENDER, names: senderNames, width: 1300, height: 900, x: 0, path: '/#/send' });
const family = await open({ account: FAMILY, names: familyNames, width: 420, height: 900, x: 1320, path: '/#/family' });
console.log('Two windows are open: the sender (left) and the family member (right). Close both to finish.');
await Promise.all([
  new Promise((resolve) => sender.on('disconnected', resolve)),
  new Promise((resolve) => family.on('disconnected', resolve)),
]);
