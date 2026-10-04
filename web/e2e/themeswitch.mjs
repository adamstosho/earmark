// Clicks the floating theme switch on the landing page and a signed-out public page, at phone and laptop widths.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const APP = process.env.APP_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SHOTS = 'e2e/screenshots/themeswitch';
mkdirSync(SHOTS, { recursive: true });
const problems = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const [path, width] of [['/#/', 390], ['/#/', 1280], ['/#/nowhere', 390]]) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) problems.push(`${path} ${width}: ${m.text()}`); });
  await page.goto(APP + path);
  const btn = page.getByRole('button', { name: /Switch to (dark|light) theme/ });
  await btn.waitFor();
  const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
  const before = await theme();
  const box = await btn.boundingBox();
  if (box.x + box.width > width || box.y + box.height > 800) problems.push(`off screen at ${width}`);
  await page.screenshot({ path: `${SHOTS}/${width}-${before}.png` });
  await btn.click();
  await page.waitForTimeout(900);
  const after = await theme();
  const label = await btn.getAttribute('aria-label');
  const stored = await page.evaluate(() => localStorage.getItem('ek-theme'));
  console.log(path, width, before, '->', after, '|', label, '| stored', stored);
  if (before === after) problems.push(`theme did not change at ${width}`);
  await page.screenshot({ path: `${SHOTS}/${width}-${after}.png` });
  await page.reload();
  if ((await theme()) !== after) problems.push('theme not kept after reload');
  await context.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'ok: no problems');
