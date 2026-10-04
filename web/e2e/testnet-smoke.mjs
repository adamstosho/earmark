// Read-only smoke test against the real Arc testnet deployment: every screen loads its data from Arc with no console
// errors. The test wallet only answers account and chain questions; it cannot sign or send anything here.
// Usage (from web/, with web/.env.local pointing at Arc testnet and `npx vite --port 5173` running):
//   node e2e/testnet-smoke.mjs
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SENDER = process.env.SENDER ?? '0x7689d4cFA7f26E26D56dD86f9E9A935Be62c84D1';
const FAMILY = process.env.FAMILY ?? '0x1dAaf2C7B71b82084ED8549A1De246f712203503';

/** Answers account and chain questions only; anything that would sign or send is refused. */
function readOnlyWallet({ account }) {
  window.ethereum = {
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [account];
      if (method === 'eth_chainId') return '0x4cef52';
      if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }];
      throw Object.assign(new Error('read-only test wallet'), { code: 4200 });
    },
    on: () => {},
    removeListener: () => {},
  };
}

const problems = [];
let ok = true;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function visit(name, account, path, expectText, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 } });
  if (account) await context.addInitScript(readOnlyWallet, { account });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${name}: ${m.text()}`);
  });
  const t0 = Date.now();
  await page.goto(`${APP}/#/`);
  if (account) {
    await page.getByRole('button', { name: 'Connect wallet' }).click();
    await page.waitForURL(/#\/(send|family)$/, { timeout: 30_000 });
  }
  if (path) await page.goto(`${APP}${path}`);
  const seen = await page.getByText(expectText).first().waitFor({ timeout: 30_000 }).then(() => true, () => false);
  const ms = Date.now() - t0;
  if (!seen) ok = false;
  console.log(`${seen ? 'PASS' : 'FAIL'}  ${name}: "${expectText}" (${ms} ms)`);
  await context.close();
}

await visit('landing', null, null, 'Money sent home, with a purpose.');
await visit('public page (pocket 1)', null, '/#/view/1', 'In this pocket');
await visit('sender dashboard (Sender wallet)', SENDER, '/#/send', 'Share family link', 1280);
await visit('family home (Family wallet)', FAMILY, '/#/family', 'Pay from these pockets whenever you need to.');
await visit('settings', SENDER, '/#/settings', 'Earmark on the Arc explorer');
await browser.close();

console.log(`\nConsole errors or warnings: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(ok && problems.length === 0 ? 0 : 1);
