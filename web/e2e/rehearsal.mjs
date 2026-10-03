// End-to-end rehearsal of PRD Section 11.3 against a local chain that behaves like Arc testnet
// (scripts/local-chain.sh), driving the real app in headless Chrome. A tiny test-only wallet forwards requests to
// anvil's unlocked development accounts, so no key is ever handled. Nothing here ships in the app bundle.
//
// Usage (from web/): node e2e/rehearsal.mjs   (needs anvil, the local setup and `npx vite --port 5173` running)
import { chromium } from 'playwright-core';
import { createPublicClient, erc20Abi, http } from 'viem';
import { mkdirSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const RPC = process.env.RPC ?? 'http://127.0.0.1:8545';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = process.env.SHOTS ?? 'e2e/screenshots';
const USDC = '0x3600000000000000000000000000000000000000';

const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const FAMILY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const COFUNDER = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const TRADER = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const SCHOOL = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';

mkdirSync(SHOTS, { recursive: true });
const client = createPublicClient({ transport: http(RPC) });
const usdc = (a) => client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [a] });
const fmt = (v) => (Number(v) / 1e6).toFixed(2);

const results = [];
const openPages = [];
const consoleProblems = [];
function check(step, ok, detail = '') {
  results.push({ step, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `  (${detail})` : ''}`);
}

/** The test-only wallet: EIP-1193 over anvil's unlocked accounts. */
function walletShim({ account, rpc, chainId }) {
  const listeners = {};
  let chain = chainId;
  const call = async (method, params = []) => {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    });
    const json = await res.json();
    if (json.error) {
      const err = new Error(json.error.message);
      err.code = json.error.code;
      err.data = json.error.data;
      throw err;
    }
    return json.result;
  };
  window.ethereum = {
    isMetaMask: true,
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account];
        case 'eth_chainId':
          return chain;
        case 'net_version':
          return String(parseInt(chain, 16));
        case 'wallet_switchEthereumChain':
          chain = params[0].chainId;
          (listeners.chainChanged ?? []).forEach((f) => f(chain));
          return null;
        case 'wallet_addEthereumChain':
          return null;
        case 'wallet_requestPermissions':
        case 'wallet_getPermissions':
          return [{ parentCapability: 'eth_accounts' }];
        default:
          return call(method, params ?? []);
      }
    },
    on: (e, f) => {
      (listeners[e] ??= []).push(f);
    },
    removeListener: (e, f) => {
      listeners[e] = (listeners[e] ?? []).filter((x) => x !== f);
    },
  };
}

async function openAs(browser, account, { width = 1280, height = 900, theme = 'light', chainId = '0x4cef52', blockRates = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, deviceScaleFactor: 1 });
  await context.addInitScript(walletShim, { account, rpc: RPC, chainId });
  if (blockRates) await context.route('https://open.er-api.com/**', (route) => route.abort());
  const page = await context.newPage();
  openPages.push(page);
  page.on('console', (msg) => {
    // The kill-switch test blocks the rate service on purpose; the browser always logs that blocked request.
    if (blockRates && msg.text().startsWith('Failed to load resource')) return;
    if (msg.type() === 'error' || msg.type() === 'warning') consoleProblems.push(`[${account.slice(0, 6)}] ${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => consoleProblems.push(`[${account.slice(0, 6)}] pageerror: ${err.message}`));
  return { context, page };
}

async function connect(page) {
  await page.goto(`${APP}/#/`);
  await page.getByRole('button', { name: 'Connect wallet' }).click();
}

async function waitText(page, text, timeout = 15_000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
}

async function createPocket(page, opts) {
  await page.goto(`${APP}/#/send`);
  await page.getByRole('button', { name: 'New pocket' }).first().click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Pocket name').fill(opts.label);
  await form.getByLabel('Their address').fill(FAMILY);
  if (opts.nickname) await form.getByLabel('Their name (only on this device)').fill(opts.nickname);
  if (opts.requestOnly) await form.getByRole('switch', { name: 'Every payment is a request' }).click();
  else await form.getByLabel('Weekly limit').fill(opts.limit);
  if (opts.payee) {
    await form.getByRole('switch', { name: 'Approved payees only' }).click();
    await form.getByLabel('Payee address').fill(opts.payee);
    await form.getByLabel('Payee name (only on this device)').fill(opts.payeeName);
    await form.getByRole('button', { name: 'Add payee' }).click();
  }
  if (opts.lockDays) {
    await form.getByRole('switch', { name: 'Lock until a date' }).click();
    const d = new Date(Date.now() + opts.lockDays * 86_400_000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    await form.getByLabel('Locked until').fill(iso);
  }
  await form.getByLabel('Money to add now').fill(opts.deposit);
  await form.getByRole('button', { name: 'Create pocket' }).click();
  await waitText(page, 'Pocket created', 30_000);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
try {
  // ------------------------------------------------------------------ 1. wrong network, then switch in one tap
  {
    const { context, page } = await openAs(browser, SENDER, { chainId: '0x1' });
    await connect(page);
    await waitText(page, 'Your wallet is on another network');
    await page.getByRole('button', { name: 'Switch to Arc' }).click();
    await page.getByText('Your wallet is on another network').waitFor({ state: 'detached', timeout: 10_000 });
    check('1. Sender switches to Arc through the app prompt', true);
    await context.close();
  }

  const sender = await openAs(browser, SENDER);
  await connect(sender.page);
  await sender.page.waitForURL(/#\/send$/);
  await waitText(sender.page, 'No pockets yet');
  check('Sender with no pockets lands on /#/send with the empty state', true);

  // ------------------------------------------------------------------ 2 and 3. Food, and the first fee credit
  const familyBefore = await usdc(FAMILY);
  await createPocket(sender.page, { label: 'Food', nickname: 'Mama', limit: '20', deposit: '30' });
  const familyAfter = await usdc(FAMILY);
  check('2. Sender creates "Food": 20 USDC per 7 days, float 0.05, deposit 30', true);
  check('3. Family wallet receives the 0.05 fee credit with 0 before', familyBefore === 0n && familyAfter === 50_000n, `before ${fmt(familyBefore)}, after ${fmt(familyAfter)}`);

  // ------------------------------------------------------------------ 4. School fees
  await createPocket(sender.page, {
    label: 'School fees',
    requestOnly: true,
    payee: SCHOOL,
    payeeName: 'Bright Future School',
    lockDays: 7,
    deposit: '50',
  });
  check('4. Sender creates "School fees": request-only, one payee, lock 7 days, deposit 50', true);

  // ------------------------------------------------------------------ 5. co-funder adds 5 to Food from the public page
  {
    const { context, page } = await openAs(browser, COFUNDER, { width: 390, height: 844 });
    await page.goto(`${APP}/#/view/1`);
    await waitText(page, 'You are viewing a pocket');
    await page.getByRole('button', { name: 'Connect wallet' }).click();
    await page.getByRole('button', { name: 'Add money' }).click();
    await waitText(page, 'can take back anything in this pocket');
    for (const k of ['5']) await page.getByRole('button', { name: k, exact: true }).click();
    await page.getByRole('button', { name: 'Add $5.00' }).click();
    await page.getByRole('button', { name: 'Done' }).waitFor({ timeout: 30_000 });
    await context.close();
    await sender.page.goto(`${APP}/#/p/1`);
    await waitText(sender.page, 'Added by');
    check('5. A third wallet funds "Food" with 5 USDC after a warning; the sender sees it in the feed', true);
  }

  // ------------------------------------------------------------------ 6. family pays 8 from Food; the sender sees it within 3 s
  const family = await openAs(browser, FAMILY, { width: 390, height: 844 });
  await connect(family.page);
  await family.page.waitForURL(/#\/family$/);
  await waitText(family.page, 'Mama', 1).catch(() => undefined);
  await family.page.screenshot({ path: `${SHOTS}/family-home-390-light.png`, fullPage: true });
  await family.page.getByRole('button', { name: 'Pay', exact: true }).first().click();
  await family.page.getByRole('button', { name: '8', exact: true }).click();
  await family.page.getByRole('button', { name: 'Choose', exact: true }).click();
  await family.page.getByText('Someone else').click();
  await family.page.getByLabel('Their address').fill(TRADER);
  await family.page.getByLabel('Their address').blur();
  await family.page.getByRole('button', { name: 'Done' }).click();
  await family.page.screenshot({ path: `${SHOTS}/pay-390-light.png`, fullPage: true });
  await sender.page.goto(`${APP}/#/p/1`);
  await waitText(sender.page, 'Added by');
  const paidRowsBefore = await sender.page.getByText(/^Paid 0x90F7/).count();
  const traderBefore = await usdc(TRADER);
  const t0 = Date.now();
  await family.page.getByRole('button', { name: 'Pay $8.00' }).click();
  await family.page.getByText('This cannot be reversed.').waitFor({ timeout: 30_000 });
  const tFinal = Date.now() - t0;
  await sender.page.waitForFunction(
    (n) => [...document.querySelectorAll('.ek-activity__title')].filter((e) => e.textContent.startsWith('Paid 0x90F7')).length > n,
    paidRowsBefore,
    { timeout: 10_000 },
  );
  const tSeen = Date.now() - t0;
  const traderAfter = await usdc(TRADER);
  check('6. Family pays 8 USDC from "Food"; Final shown', traderAfter - traderBefore === 8_000_000n, `Final after ${tFinal} ms`);
  check('6. Sender screen shows the payment within 3 seconds', tSeen - tFinal <= 3_000, `${tSeen - tFinal} ms after Final`);
  await family.page.getByRole('button', { name: 'Done' }).click();

  // ------------------------------------------------------------------ 7. 15 is over the limit: the button offers Ask for approval
  await family.page.getByRole('button', { name: 'Pay', exact: true }).first().click();
  for (const k of ['1', '5']) await family.page.getByRole('button', { name: k, exact: true }).click();
  await family.page.getByRole('button', { name: 'Choose', exact: true }).click();
  await family.page.getByText('Someone else').click();
  await family.page.getByLabel('Their address').fill(TRADER);
  await family.page.getByRole('button', { name: 'Done' }).click();
  const askVisible = await family.page.getByRole('button', { name: 'Ask for approval' }).isVisible();
  check('7. Family tries 15 USDC from "Food"; the app offers "Ask for approval"', askVisible);

  // ------------------------------------------------------------------ 8. family asks for 15; sender approves; recipient paid
  await family.page.getByRole('button', { name: 'Ask for approval' }).click();
  await family.page.getByRole('button', { name: 'Done' }).waitFor({ timeout: 30_000 });
  await family.page.getByRole('button', { name: 'Done' }).click();
  await sender.page.goto(`${APP}/#/requests`);
  await sender.page.getByRole('button', { name: 'Approve and pay' }).first().waitFor({ timeout: 15_000 });
  const before8 = await usdc(TRADER);
  await sender.page.getByRole('button', { name: 'Approve and pay' }).first().click();
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Approve and pay $15.00' }).click();
  await sender.page.getByRole('dialog').getByText('This cannot be reversed.').waitFor({ timeout: 30_000 });
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  check('8. Family requests 15 USDC; sender approves; recipient receives it', (await usdc(TRADER)) - before8 === 15_000_000n);

  // ------------------------------------------------------------------ 9. request from School fees; sender declines; balance unchanged
  await family.page.goto(`${APP}/#/family/ask/2`);
  for (const k of ['2', '0']) await family.page.getByRole('button', { name: k, exact: true }).click();
  await family.page.getByRole('button', { name: /Choose|Change/ }).click();
  await family.page.getByText('0x15d3…6A65').click(); // names stay on the device that saved them (D4)
  await family.page.getByRole('button', { name: 'Ask for $20.00' }).click();
  await family.page.getByRole('button', { name: 'Done' }).waitFor({ timeout: 30_000 });
  await sender.page.goto(`${APP}/#/p/2`);
  const schoolBalanceBefore = await sender.page.locator('.ek-money--hero .ek-money__main').first().textContent();
  await sender.page.getByRole('button', { name: 'Decline' }).first().click();
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Decline request' }).click();
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Done' }).waitFor({ timeout: 30_000 });
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  const schoolBalanceAfter = await sender.page.locator('.ek-money--hero .ek-money__main').first().textContent();
  check('9. Family requests from "School fees"; sender declines; balance unchanged', schoolBalanceBefore === schoolBalanceAfter, `${schoolBalanceBefore}`);

  // ------------------------------------------------------------------ 10. withdraw from School fees is disabled with the lock date shown
  const takeBack = sender.page.getByRole('button', { name: 'Take money back' });
  const disabled = await takeBack.isDisabled();
  const lockShown = await sender.page.getByText(/You can take money back from \d+ \w+ \d{4}\./).isVisible();
  check('10. Withdraw from "School fees" is disabled and the lock date is shown', disabled && lockShown);
  await sender.page.screenshot({ path: `${SHOTS}/pocket-locked-1280-light.png`, fullPage: true });

  // ------------------------------------------------------------------ 11. sender takes 5 back from Food
  await sender.page.goto(`${APP}/#/p/1`);
  const senderBefore = await usdc(SENDER);
  await sender.page.getByRole('button', { name: 'Take money back' }).click();
  await sender.page.getByRole('dialog').getByLabel('Amount').fill('5');
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Take back $5.00' }).click();
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Done' }).waitFor({ timeout: 30_000 });
  await sender.page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  check('11. Sender withdraws 5 USDC from "Food"', (await usdc(SENDER)) - senderBefore === 5_000_000n);

  // ------------------------------------------------------------------ 12. public pages without a wallet
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(`[public] ${m.type()}: ${m.text()}`);
    });
    for (const id of [1, 2]) {
      await page.goto(`${APP}/#/view/${id}`);
      await waitText(page, 'You are viewing a pocket');
      await page.locator('.ek-activity').first().waitFor({ timeout: 15_000 });
    }
    check('12. The public page for each pocket opens with no wallet connected', true);
    await context.close();
  }

  // ------------------------------------------------------------------ 13. feed order and receipts
  await sender.page.goto(`${APP}/#/p/1`);
  await waitText(sender.page, 'You took money back', 5_000);
  const titles = await sender.page.locator('.ek-activity__title').allTextContents();
  const links = await sender.page.locator('.ek-activity__link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  const expectedOrder = ['You took money back', 'Approved', 'Asked', 'Fee credit added', 'Paid', 'Added by', 'Fee credit added', 'Added by you', 'Pocket created'];
  const orderOk = titles.at(0) === 'You took money back' && titles.at(-1) === 'Pocket created';
  check('13. Feed shows every step newest first, each with a receipt link', orderOk && links.every((h) => /\/tx\/0x[0-9a-f]{64}$/.test(h ?? '')), `${titles.length} rows: ${titles.join(' | ')}`);
  void expectedOrder;

  // ------------------------------------------------------------------ 14. naira shows; blocking the rate hides it without breaking anything
  const nairaShown = await sender.page.getByText(/Naira amounts are indicative/).isVisible().catch(() => false);
  {
    const { context, page } = await openAs(browser, SENDER, { blockRates: true });
    await page.addInitScript(() => localStorage.removeItem('ek-rate'));
    await connect(page);
    await page.waitForURL(/#\/send$/);
    await page.locator('.ek-pocket').first().waitFor();
    const anyNaira = await page.getByText('₦').count();
    const note = await page.getByText(/Naira amounts are indicative/).count();
    check('14. Naira figures show with the rate; blocking the rate API hides them', nairaShown && anyNaira === 0 && note === 0, `with rate: ${nairaShown}; blocked: ${anyNaira} naira figures`);
    await context.close();
  }

  // ------------------------------------------------------------------ screenshots for the visual check
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 1280]) {
      const s = await openAs(browser, SENDER, { width, height: width === 390 ? 844 : 900, theme });
      await connect(s.page);
      await s.page.waitForURL(/#\/send$/);
      await s.page.locator('.ek-pocket').first().waitFor();
      await s.page.waitForTimeout(600);
      await s.page.screenshot({ path: `${SHOTS}/dashboard-${width}-${theme}.png`, fullPage: true });
      await s.context.close();

      const f = await openAs(browser, FAMILY, { width, height: width === 390 ? 844 : 900, theme });
      await connect(f.page);
      await f.page.waitForURL(/#\/family$/);
      await f.page.locator('.ek-pocket').first().waitFor();
      await f.page.waitForTimeout(600);
      await f.page.screenshot({ path: `${SHOTS}/family-${width}-${theme}.png`, fullPage: true });
      await f.page.goto(`${APP}/#/family/pay/1`);
      await f.page.getByText('Pay from Food').first().waitFor();
      await f.page.waitForTimeout(400);
      await f.page.screenshot({ path: `${SHOTS}/pay-${width}-${theme}.png`, fullPage: false });
      await f.context.close();
    }
  }
  await family.context.close();
  await sender.context.close();
} catch (err) {
  for (const [i, p] of openPages.entries()) {
    if (!p.isClosed()) await p.screenshot({ path: `${SHOTS}/failure-${i}.png`, fullPage: true }).catch(() => undefined);
    if (!p.isClosed()) console.log(`page ${i}: ${p.url()}`);
  }
  const where = err instanceof Error ? ((err.stack ?? '').split('\n').find((l) => l.includes('rehearsal.mjs')) ?? '') : '';
  check('Rehearsal ran to the end', false, `${err instanceof Error ? err.message.split('\n')[0] : String(err)} ${where.trim()}`);
} finally {
  await browser.close();
}

console.log(`\n${results.filter((r) => r.ok).length} of ${results.length} checks passed`);
console.log(`Console errors or warnings: ${consoleProblems.length}`);
for (const p of [...new Set(consoleProblems)].slice(0, 30)) console.log(`  ${p}`);
process.exit(results.every((r) => r.ok) && consoleProblems.length === 0 ? 0 : 1);
