import { chromium, type Page } from '@playwright/test';
import path from 'node:path';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';

const VIEWPORT = { width: 1280, height: 720 };
const URL = process.env.DEMO_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve('.demo-recording');
const OUT_VIDEO = path.resolve(OUT_DIR, 'demo.webm');

async function pause(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

/** Smooth-click: glide the cursor to the target, hold briefly, then click. */
async function cinematicClick(page: Page, locator: ReturnType<Page['locator']>) {
  const box = await locator.boundingBox();
  if (!box) {
    await locator.click();
    return;
  }
  const tx = box.x + box.width / 2;
  const ty = box.y + box.height / 2;
  await page.mouse.move(tx, ty, { steps: 18 });
  await pause(page, 180);
  await page.mouse.click(tx, ty);
}

async function run() {
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: OUT_DIR, size: VIEWPORT },
    // 2x device scale renders antialiased text/UI; scaled down to 800w later = crisp
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForSelector('[role="application"]', { timeout: 20000 });

  // ---- 0. Establishing shot — hold on empty drawer ----
  await pause(page, 1600);

  // ---- 1. Open bin palette, pick 2×2 (deliberate pacing) ----
  const palette = page.getByRole('button', { name: /Bin Palette/i });
  if (await palette.isVisible().catch(() => false)) {
    await cinematicClick(page, palette);
    await pause(page, 700);
  }

  const size2x2 = page.getByRole('button', { name: /select paint size: 2×2/i }).first();
  await cinematicClick(page, size2x2);
  await pause(page, 900);

  // ---- 2. Fill layer — the reveal ----
  const sidebar = page.locator('[data-sidebar]');
  const fillBtn = sidebar.getByRole('button', { name: /fill.*2.*2/i });
  await cinematicClick(page, fillBtn);
  await page
    .getByText(/added \d+ bins/i)
    .waitFor({ timeout: 8000 })
    .catch(() => {});
  // Let the viewer appreciate the filled layer
  await pause(page, 2200);

  await page.keyboard.press('Escape');
  await pause(page, 700);

  // ---- 3. Open 3D preview ----
  const toggle3D = page.getByRole('button', { name: /3D preview/i }).first();
  await cinematicClick(page, toggle3D);
  await page.waitForSelector('canvas', { timeout: 15000 });
  // Long hold on the isometric reveal
  await pause(page, 1600);

  // ---- 4. Slow, smooth camera orbit ----
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    // Wider, slower arc — 40 steps × 40ms = ~1.6s of continuous motion
    for (let i = 0; i < 40; i++) {
      await page.mouse.move(cx + i * 4, cy - i * 1.1, { steps: 3 });
      await pause(page, 40);
    }
    await page.mouse.up();
  }

  // Final hold — lets the fade-out play on a still image
  await pause(page, 1600);

  await context.close();
  await browser.close();

  const files = readdirSync(OUT_DIR).filter((f) => f.endsWith('.webm'));
  if (!files.length) throw new Error('No webm captured');
  renameSync(path.join(OUT_DIR, files[0]), OUT_VIDEO);
  console.log('Recorded:', OUT_VIDEO);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
