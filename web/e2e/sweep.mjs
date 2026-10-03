// Click-through sweep of every screen and control, on the local chain after e2e/rehearsal.mjs has seeded pockets.
// Read-only apart from saving a nickname in localStorage: it never sends anything on chain.
// Usage (from web/): node e2e/sweep.mjs   (needs anvil, the local setup, the seeded rehearsal and `npx vite --port 5173`)
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const src = readFileSync('e2e/rehearsal.mjs', 'utf8');
const shim = src.slice(src.indexOf('function walletShim'), src.indexOf('async function openAs'));
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const FAMILY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const results = [];
const consoleProblems = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

async function open({ account, width = 1280, height = 900, reduced = false, theme = 'light' }) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: APP }).catch(() => {});
  if (account) await context.addInitScript(`${shim}; walletShim({ account: '${account}', rpc: 'http://127.0.0.1:8545', chainId: '0x4cef52' });`);
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consoleProblems.push(`${m.text().slice(0, 160)} @ ${page.url()}`);
  });
  page.on('pageerror', (e) => consoleProblems.push(`pageerror ${e.message} @ ${page.url()}`));
  return { context, page };
}
const go = async (page, hash, wait = 900) => {
  await page.goto(`${APP}/#${hash}`);
  await page.waitForTimeout(wait);
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ---------------------------------------------------------------- landing, logo and hero motion
{
  const { context, page } = await open({ account: null });
  await go(page, '/', 1500);
  check('Landing: headline and the add-a-wallet line show when there is no wallet (D12)', (await page.locator('h1').innerText()).length > 5 && (await page.getByText('add a wallet', { exact: false }).first().isVisible()));
  const art = await page.evaluate(() => ({
    chips: document.querySelectorAll('.app-art__chip').length,
    running: document.querySelector('.app-art').getAnimations({ subtree: true }).filter((a) => a.playState === 'running').length,
    hidden: document.querySelector('.app-art').getAttribute('aria-hidden'),
  }));
  check('Hero graphic: 6 orbiting pockets, animations running, hidden from screen readers', art.chips === 6 && art.running > 10 && art.hidden === 'true', `${art.running} animations`);
  const logoAnims = await page.evaluate(() => document.querySelector('svg.ek-logo').getAnimations({ subtree: true }).length);
  check('Logo is animated', logoAnims >= 2, `${logoAnims} animations`);
  await page.setViewportSize({ width: 390, height: 700 });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1500);
  const paused = await page.evaluate(() => document.querySelector('.app-art').hasAttribute('data-paused'));
  check('Hero graphic pauses when scrolled out of view', paused);
  const revealed = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].every((e) => e.classList.contains('is-in')));
  check('Scroll reveal shows every step card and the notice', revealed);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  check('Landing: no sideways scroll', (await noSideScroll(page)) === 0);
  await context.close();
}
{
  const { context, page } = await open({ account: null, reduced: true });
  await go(page, '/', 1500);
  const moving = await page.evaluate(() => {
    const running = [...document.querySelectorAll('.app-art *, svg.ek-logo *')].flatMap((e) => e.getAnimations()).filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity);
    return running.length;
  });
  check('Reduced motion: no looping animation in the hero or logo', moving === 0, `${moving} looping`);
  const shown = await page.evaluate(() => [...document.querySelectorAll('[data-reveal]')].every((e) => getComputedStyle(e).opacity === '1'));
  check('Reduced motion: steps are visible without scrolling', shown);
  await context.close();
}
for (const width of [360, 768, 1440]) {
  const { context, page } = await open({ account: null, width });
  await go(page, '/', 1200);
  check(`Landing at ${width}px: hero graphic fits and keeps its shape`, await page.evaluate(() => { const r = document.querySelector('.app-art').getBoundingClientRect(); return Math.abs(r.width - r.height) < 2 && r.right <= innerWidth + 1; }));
  await context.close();
}

// ---------------------------------------------------------------- not found and public page, no wallet
{
  const { context, page } = await open({ account: null, width: 390 });
  await go(page, '/nowhere');
  check('Unknown address shows the not-found screen', (await page.locator('main, body').first().innerText()).toLowerCase().includes('not'));
  await go(page, '/view/1');
  check('Public pocket opens and shows its balance and activity', /\$/.test(await page.locator('main').innerText()) && (await page.locator('.ek-activity').count()) > 0);
  await go(page, '/view/9999');
  check('Public pocket that does not exist says so', await page.getByText('This pocket does not exist').isVisible());
  check('Public page at 390px: no sideways scroll', (await noSideScroll(page)) === 0);
  await go(page, '/send');
  check('Signed-out /send shows the wallet gate instead of data', (await page.locator('.ek-pocket').count()) === 0 && (await page.getByText('add a wallet', { exact: false }).first().isVisible()));
  await context.close();
}

// ---------------------------------------------------------------- sender, laptop
{
  const { context, page } = await open({ account: SENDER });
  await go(page, '/');
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.waitForURL(/#\/send$/, { timeout: 15_000 });
  await page.waitForTimeout(1200);
  check('Sender lands on Pockets with the pocket cards', (await page.locator('.ek-pocket').count()) >= 2);

  // Side navigation: every link opens its page.
  for (const [label, re] of [['Requests', /#\/requests/], ['Activity', /#\/activity/], ['Settings', /#\/settings/], ['Pockets', /#\/send/]]) {
    await page.locator('nav').getByRole('link', { name: label }).first().click();
    await page.waitForTimeout(500);
    check(`Side navigation: ${label} opens`, re.test(page.url()) && (await page.locator('h1').count()) > 0);
  }

  // Pocket detail.
  await page.locator('.ek-pocket').first().locator('a, button').first().click().catch(() => {});
  await go(page, '/p/2');
  check('Pocket page shows the balance, rules and activity', (await page.locator('.app-rules li').count()) >= 3 && (await page.locator('.ek-activity').count()) > 0);
  await page.getByRole('button', { name: 'Add money' }).first().click();
  await page.waitForTimeout(500);
  const dialog = page.locator('dialog[open]');
  check('Add money opens a dialog', (await dialog.count()) === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  check('Escape closes the dialog', (await page.locator('dialog[open]').count()) === 0);
  const locked = await page.getByRole('button', { name: 'Take money back' }).first().isDisabled();
  check('Take money back is disabled while the lock runs', locked);
  await page.getByRole('button', { name: 'Move lock date' }).click();
  await page.waitForTimeout(500);
  check('Move lock date opens a dialog', (await page.locator('dialog[open]').count()) === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Share pocket button exists', (await page.getByRole('button', { name: 'Share pocket' }).count()) > 0);

  // New pocket: validation and pickers, without creating one.
  await go(page, '/new', 1200);
  const nd = page.locator('dialog[open]');
  check('New pocket opens as a dialog on a laptop', (await nd.count()) === 1);
  await nd.getByRole('radio').nth(3).click();
  await nd.locator('.app-pick[role="radio"]').nth(8).click().catch(() => {});
  const submit = nd.getByRole('button', { name: /create|continue|next/i }).last();
  if (await submit.count()) {
    await submit.click();
    await page.waitForTimeout(500);
    const errors = await nd.locator('.ek-field__error, [role="alert"], .is-error, [aria-invalid="true"]').count();
    check('New pocket: submitting an empty form shows errors and sends nothing', errors > 0 && (await nd.count()) === 1, `${errors} problems flagged`);
  } else check('New pocket: has a submit button', false);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Settings.
  await go(page, '/settings');
  for (const [label, theme] of [['Dark', 'dark'], ['Light', 'light']]) {
    await page.getByRole('radio', { name: label }).click();
    await page.waitForTimeout(250);
    check(`Settings: ${label} theme applies`, (await page.evaluate(() => document.documentElement.dataset.theme)) === theme);
  }
  await page.getByRole('radio', { name: 'System' }).click();
  await page.getByRole('textbox', { name: 'Address' }).fill('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Mama');
  await page.getByRole('button', { name: 'Save name' }).click();
  await page.waitForTimeout(600);
  check('Settings: a saved name shows on this device', await page.getByText('Mama').first().isVisible());
  await go(page, '/send');
  check('Nickname replaces the address on the dashboard', (await page.locator('main').innerText()).includes('Mama'));
  const famLink = await (async () => { await go(page, '/settings'); return page.locator('.app-linkbox').first().innerText(); })();
  check('Family link points at /#/family', famLink.includes('#/family'));
  await page.getByRole('button', { name: /disconnect/i }).click();
  await page.waitForTimeout(800);
  check('Disconnect returns to the landing page', /#\/$/.test(page.url()) || (await page.getByRole('button', { name: 'Connect wallet' }).count()) > 0);
  await context.close();
}

// ---------------------------------------------------------------- sender, phone
{
  const { context, page } = await open({ account: SENDER, width: 390, height: 800 });
  await go(page, '/');
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.waitForURL(/#\/send$/, { timeout: 15_000 });
  await page.waitForTimeout(1000);
  check('Phone: tab bar shows four tabs', (await page.locator('.ek-tabbar a, .ek-tabbar__item').count()) === 4);
  for (const label of ['Requests', 'Activity', 'Settings', 'Pockets']) {
    await page.locator('.ek-tabbar').getByRole('link', { name: label }).click();
    await page.waitForTimeout(450);
    check(`Phone tab ${label} opens without sideways scroll`, (await noSideScroll(page)) === 0);
  }
  await go(page, '/new', 1000);
  check('Phone: New pocket is a full screen with no tab bar', (await page.locator('.ek-tabbar:visible').count()) === 0 && (await page.locator('dialog[open]').count()) === 0);
  check('Phone: New pocket has one way out (back)', (await page.getByRole('button', { name: /back|close/i }).count()) + (await page.getByRole('link', { name: /back|close/i }).count()) > 0);
  await go(page, '/p/2', 1000);
  check('Phone: pocket page has no sideways scroll', (await noSideScroll(page)) === 0);
  await context.close();
}

// ---------------------------------------------------------------- family, phone
{
  const { context, page } = await open({ account: FAMILY, width: 390, height: 800 });
  await go(page, '/');
  await page.getByRole('button', { name: 'Connect wallet' }).click();
  await page.waitForURL(/#\/family$/, { timeout: 15_000 });
  await page.waitForTimeout(1000);
  check('Spend-only wallet lands on the family home', (await page.locator('.ek-pocket').count()) >= 1);
  check('Family tab bar shows three tabs', (await page.locator('.ek-tabbar a, .ek-tabbar__item').count()) === 3);
  await page.getByRole('button', { name: 'Pay', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(700);
  if (/#\/family\/pay\//.test(page.url())) {
    const amount = page.locator('.ek-amount__input');
    for (const k of ['1', '2', '.', '5']) await page.locator('.ek-keypad__key', { hasText: new RegExp(`^${k.replace('.', '\\.')}$`) }).first().click();
    check('Pay: the keypad types an amount', (await amount.inputValue()) === '12.5');
    await page.getByRole('button', { name: 'Delete last digit' }).click();
    check('Pay: backspace removes a digit', (await amount.inputValue()) === '12.');
    check('Pay: an amount above what is available offers Ask for approval', await page.getByText('Ask for approval instead').isVisible());
    check('Pay: no sideways scroll', (await noSideScroll(page)) === 0);
  } else check('Family Pay screen opens', false, page.url());
  await go(page, '/family/ask/2', 900);
  check('Ask screen opens for a request-only pocket', (await page.locator('main, .app-task, dialog[open]').first().innerText()).toLowerCase().includes('ask'));
  await go(page, '/family/activity');
  check('Family activity lists its steps', (await page.locator('.ek-activity').count()) > 0);
  await context.close();
}

// ---------------------------------------------------------------- keyboard
{
  const { context, page } = await open({ account: null });
  await go(page, '/view/1', 1200);
  const seen = [];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    seen.push(await page.evaluate(() => { const e = document.activeElement; const cs = getComputedStyle(e); return { tag: e.tagName, ring: cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 }; }));
  }
  check('Keyboard: Tab reaches the logo link and the share button, each with a visible focus ring', seen.every((x) => x.tag !== 'BODY' && x.ring), JSON.stringify(seen.map((x) => x.tag)));
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
console.log(`Console errors or warnings: ${consoleProblems.length}`);
for (const p of consoleProblems) console.log(`  ${p}`);
process.exit(failed || consoleProblems.length ? 1 : 0);
