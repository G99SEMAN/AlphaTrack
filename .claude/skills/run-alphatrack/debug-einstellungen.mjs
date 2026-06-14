import { chromium } from 'playwright';

const BASE = process.env.ALPHATRACK_URL || 'http://localhost:3002';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('console', msg => console.log('[CONSOLE]', msg.type(), msg.text()));
page.on('pageerror', err => console.log('[PAGE ERROR]', err.message));
page.on('response', res => {
  if (res.status() >= 400) console.log('[HTTP]', res.status(), res.url());
});

try {
  const res = await page.goto(BASE + '/einstellungen', { waitUntil: 'networkidle', timeout: 20000 });
  console.log('[STATUS]', res.status());
  const body = await page.content();
  // Print first 2000 chars of body
  console.log('[BODY]', body.substring(0, 2000));
} catch (e) {
  console.log('[GOTO ERROR]', e.message);
}

await browser.close();
