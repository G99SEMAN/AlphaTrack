/**
 * AlphaTrack Playwright driver.
 * Usage: node driver.mjs [command] [args]
 *
 * Commands:
 *   screenshot [path] [url_path]   - Take a screenshot (default: ss.png, /dashboard)
 *   check [url_path]               - Check page loads and print title
 *   api [path]                     - GET an API route and print JSON
 */
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import path from 'path';

const BASE = process.env.ALPHATRACK_URL || 'http://localhost:3000';
const SKILL_DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

async function getPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  return ctx.newPage();
}

const [cmd = 'screenshot', arg1, arg2] = process.argv.slice(2);

const browser = await chromium.launch({ headless: true });

try {
  if (cmd === 'screenshot') {
    const outPath = arg1 || path.join(SKILL_DIR, 'ss.png');
    const urlPath = arg2 || '/dashboard';
    const page = await getPage(browser);
    await page.goto(BASE + urlPath, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Screenshot saved: ${outPath}`);
  }
  else if (cmd === 'check') {
    const urlPath = arg1 || '/dashboard';
    const page = await getPage(browser);
    const res = await page.goto(BASE + urlPath, { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`Status: ${res.status()} | Title: ${await page.title()}`);
  }
  else if (cmd === 'api') {
    const apiPath = arg1 || '/api/profiles';
    const page = await getPage(browser);
    const res = await page.goto(BASE + apiPath, { waitUntil: 'load', timeout: 10000 });
    const text = await page.content();
    const jsonMatch = text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) || text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    console.log(jsonMatch ? jsonMatch[1].trim() : text.substring(0, 500));
  }
  else {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }
} finally {
  await browser.close();
}
