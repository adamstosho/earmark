// Accessibility audit (axe-core, the engine behind Lighthouse's accessibility score) of the screens that need a
// wallet, which Lighthouse cannot connect: sender dashboard, family home and pay, at 390 and 1280 px, both themes.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const APP = process.env.APP_URL ?? 'http://localhost:4173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const src = readFileSync('e2e/rehearsal.mjs', 'utf8');
const shim = src.slice(src.indexOf('function walletShim'), src.indexOf('async function openAs'));
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const FAMILY = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const cases = [
  { name: 'dashboard', account: SENDER, path: '/#/send' },
  { name: 'pocket', account: SENDER, path: '/#/p/1' },
  { name: 'new pocket', account: SENDER, path: '/#/new' },
  { name: 'family home', account: FAMILY, path: '/#/family' },
  { name: 'pay', account: FAMILY, path: '/#/family/pay/1' },
  { name: 'settings', account: SENDER, path: '/#/settings' },
];

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let total = 0;
for (const c of cases) {
  for (const width of [390, 1280]) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      await context.addInitScript(`${shim}; walletShim({ account: '${c.account}', rpc: 'http://127.0.0.1:8545', chainId: '0x4cef52' });`);
      const page = await context.newPage();
      await page.goto(`${APP}/#/`);
      await page.getByRole('button', { name: 'Connect wallet' }).click();
      await page.waitForURL(/#\/(send|family)$/);
      await page.goto(`${APP}${c.path}`);
      await page.waitForTimeout(1_500);
      await page.addScriptTag({ content: axeSource });
      const result = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
        return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.help} — ${v.nodes[0]?.target.join(' ')}`);
      });
      total += result.length;
      console.log(`${result.length === 0 ? 'PASS' : 'FAIL'}  ${c.name} @${width} ${theme}`);
      for (const v of result) console.log(`   ${v}`);
      await context.close();
    }
  }
}
await browser.close();
console.log(`\n${total} WCAG 2.2 AA violations`);
process.exit(total ? 1 : 0);
