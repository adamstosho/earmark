// Two wallet extensions in one browser: a "rogue" wallet that owns window.ethereum and rejects every request (the
// "You cancelled in your wallet" symptom), and MetaMask announcing itself through EIP-6963. Earmark must offer a
// choice and connect through MetaMask. Read-only: nothing is signed or sent.
// Usage (from web/, with `npx vite --port 5173` running): node e2e/multi-wallet.mjs
import { chromium } from 'playwright-core';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SENDER = process.env.SENDER ?? '0x7689d4cFA7f26E26D56dD86f9E9A935Be62c84D1';

function twoWallets({ account }) {
  const rejecting = {
    request: async () => {
      throw Object.assign(new Error('User rejected the request.'), { code: 4001 });
    },
    on: () => {},
    removeListener: () => {},
  };
  // Not authorised until the person connects, so the page does not auto-reconnect before the wallet choice appears.
  let authorised = false;
  const metamask = {
    isMetaMask: true,
    request: async ({ method }) => {
      if (method === 'eth_requestAccounts') {
        authorised = true;
        return [account];
      }
      if (method === 'eth_accounts') return authorised ? [account] : [];
      if (method === 'eth_chainId') return '0x4cef52';
      if (method === 'wallet_requestPermissions' || method === 'wallet_getPermissions') return [{ parentCapability: 'eth_accounts' }];
      throw Object.assign(new Error('read-only test wallet'), { code: 4200 });
    },
    on: () => {},
    removeListener: () => {},
  };
  window.ethereum = rejecting;
  const announce = (name, rdns, provider) =>
    window.dispatchEvent(
      new CustomEvent('eip6963:announceProvider', {
        detail: Object.freeze({ info: { uuid: crypto.randomUUID(), name, icon: 'data:image/svg+xml,<svg/>', rdns }, provider }),
      }),
    );
  const announceAll = () => {
    announce('Rogue Wallet', 'com.example.rogue', rejecting);
    announce('MetaMask', 'io.metamask', metamask);
  };
  window.addEventListener('eip6963:requestProvider', announceAll);
  announceAll();
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addInitScript(twoWallets, { account: SENDER });
const page = await context.newPage();
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text());
});

await page.goto(`${APP}/#/`);
await page.getByRole('button', { name: 'Connect wallet' }).click();
await page.getByText('Choose your wallet').waitFor({ timeout: 10_000 });
const names = await page.getByRole('group', { name: 'Choose your wallet' }).getByRole('button').allTextContents();
console.log(`Wallets offered: ${names.join(', ')}`);
await page.getByRole('button', { name: 'MetaMask' }).click();
const connected = await page.waitForURL(/#\/(send|family)$/, { timeout: 30_000 }).then(() => true, () => false);
const dashboard = connected && (await page.getByText('No pockets yet').first().waitFor({ timeout: 30_000 }).then(() => true, () => false));
console.log(`${connected && dashboard ? 'PASS' : 'FAIL'}  chose MetaMask and reached the dashboard (${page.url()})`);
console.log(`Console errors or warnings: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
await browser.close();
process.exit(connected && dashboard && problems.length === 0 ? 0 : 1);
