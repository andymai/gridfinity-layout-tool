import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await page.goto('http://localhost:5174/?devThumbnails=1&example=hero-multicolor-organizer');
await page.waitForFunction(() => window.__thumbnailReady === true, null, { timeout: 90000 });
const info = await page.evaluate(() => window.__debugScene?.() ?? null);
console.log(JSON.stringify(info, null, 2));
await browser.close();
