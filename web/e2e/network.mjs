// Phase 5 checks: (1) the only hosts the app talks to are itself, the Arc RPC and the naira rate service, with no
// cookies set; (2) kill switch: with an unreachable RPC the app says "Could not reach Arc" and does not crash.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const DEAD_RPC_APP = process.env.DEAD_APP_URL ?? 'http://localhost:5174';
const RPC_HOST = '127.0.0.1:8545';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const src = readFileSync('e2e/rehearsal.mjs', 'utf8');
const shim = src.slice(src.indexOf('function walletShim'), src.indexOf('async function openAs'));
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const FAMILY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let ok = true;

// 1. Hosts contacted by the page itself (the test wallet's own calls to the node are excluded: in real use the
//    wallet extension makes those, not the page).
{
  const hosts = new Map();
  for (const account of [SENDER, FAMILY]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(`${shim}; walletShim({ account: '${account}', rpc: 'http://${RPC_HOST}', chainId: '0x4cef52' });`);
    const page = await context.newPage();
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (url.protocol.startsWith('http')) hosts.set(url.host, (hosts.get(url.host) ?? 0) + 1);
    });
    await page.goto(`${APP}/#/`);
    await page.getByRole('button', { name: 'Connect wallet' }).click();
    await page.waitForURL(/#\/(send|family)$/);
    for (const path of account === SENDER ? ['/#/send', '/#/p/1', '/#/activity', '/#/settings'] : ['/#/family', '/#/family/pay/1']) {
      await page.goto(`${APP}${path}`);
      await page.waitForTimeout(2_500);
    }
    const cookies = await context.cookies();
    if (cookies.length) {
      ok = false;
      console.log(`FAIL  cookies set: ${cookies.map((c) => `${c.name}@${c.domain}`).join(', ')}`);
    }
    await context.close();
  }
  const allowed = new Set([new URL(APP).host, RPC_HOST, 'open.er-api.com']);
  const unexpected = [...hosts.keys()].filter((h) => !allowed.has(h));
  console.log(`${unexpected.length ? 'FAIL' : 'PASS'}  hosts contacted: ${[...hosts.entries()].map(([h, n]) => `${h} (${n})`).join(', ')}`);
  if (unexpected.length) ok = false;
}

// 2. Kill switch: the RPC is unreachable.
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(`${shim}; walletShim({ account: '${SENDER}', rpc: 'http://${RPC_HOST}', chainId: '0x4cef52' });`);
  const page = await context.newPage();
  const crashes = [];
  page.on('pageerror', (e) => crashes.push(e.message));
  await page.goto(`${DEAD_RPC_APP}/#/view/1`);
  const shown = await page.getByText('Could not reach Arc').first().waitFor({ timeout: 60_000 }).then(() => true, () => false);
  const tryAgain = await page.getByRole('button', { name: 'Try again' }).first().isVisible().catch(() => false);
  const pass = shown && tryAgain && crashes.length === 0;
  if (!pass) ok = false;
  console.log(`${pass ? 'PASS' : 'FAIL'}  unreachable RPC shows "Could not reach Arc" with Try again, no crash${crashes.length ? `: ${crashes.join('; ')}` : ''}`);
  await context.close();
}

await browser.close();
process.exit(ok ? 0 : 1);
