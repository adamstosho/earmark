// Screenshots of every screen at the design system's test widths, after e2e/rehearsal.mjs has created pockets.
// Also fails if any page scrolls sideways or logs a console error or warning.
import { chromium } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = 'e2e/screenshots/screens';
mkdirSync(SHOTS, { recursive: true });

const src = readFileSync('e2e/rehearsal.mjs', 'utf8');
const shimSource = src.slice(src.indexOf('function walletShim'), src.indexOf('async function openAs'));
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const FAMILY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const screens = [
  { name: 'landing', account: null, path: '/#/', widths: [360, 1440] },
  { name: 'dashboard', account: SENDER, path: '/#/send', widths: [360, 412, 768, 1024, 1440] },
  { name: 'new-pocket', account: SENDER, path: '/#/new', widths: [390, 1280] },
  { name: 'pocket', account: SENDER, path: '/#/p/2', widths: [412, 768, 1280] },
  { name: 'requests', account: SENDER, path: '/#/requests', widths: [768] },
  { name: 'activity', account: SENDER, path: '/#/activity', widths: [360, 1280] },
  { name: 'settings', account: SENDER, path: '/#/settings', widths: [390, 1440] },
  { name: 'family', account: FAMILY, path: '/#/family', widths: [360, 412] },
  { name: 'ask', account: FAMILY, path: '/#/family/ask/2', widths: [360, 768] },
  { name: 'public', account: null, path: '/#/view/1', widths: [360, 1280] },
  { name: 'not-found', account: null, path: '/#/nowhere', widths: [390] },
];

const problems = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const s of screens) {
  for (const width of s.widths) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      if (s.account) {
        await context.addInitScript(`${shimSource}; walletShim({ account: '${s.account}', rpc: 'http://127.0.0.1:8545', chainId: '0x4cef52' });`);
      }
      const page = await context.newPage();
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') problems.push(`${s.name}@${width}: ${m.text()}`);
      });
      if (s.account) {
        await page.goto(`${APP}/#/`);
        await page.getByRole('button', { name: 'Connect wallet' }).click();
        await page.waitForURL(/#\/(send|family)$/);
      }
      await page.goto(`${APP}${s.path}`);
      await page.waitForTimeout(1_500);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 0) problems.push(`${s.name}@${width} ${theme}: scrolls sideways by ${overflow}px`);
      await page.screenshot({ path: `${SHOTS}/${s.name}-${width}-${theme}.png`, fullPage: true });
      await context.close();
    }
  }
}
await browser.close();
console.log(`Screens captured. Problems: ${problems.length}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
