/* eslint-disable no-console -- Build script uses console for status output */
/**
 * Pre-renders committed PNG thumbnails for each gallery example.
 *
 * Thumbnails need THREE.WebGLRenderer + the brepjs WASM worker, so they can
 * only be produced in a real browser. This drives the dev-only
 * `?devThumbnails=1&example=<id>` route (see DevThumbnailRoute) once per
 * example and writes the captured PNG into the committed thumbnails dir.
 *
 * Usage: pnpm run dev (separately), then `pnpm run gen:example-thumbnails`.
 * Set BASE_URL if the dev server is not on the default port.
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXAMPLE_DESIGNS } from '../src/features/bin-designer/data/examples';

const OUT = resolve(process.cwd(), 'src/features/bin-designer/data/examples/thumbnails');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

interface ThumbnailCaptureBridge {
  __thumbnailReady?: boolean;
  __captureThumbnail?: () => string | null;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  page.on('console', (msg) => console.error(`[page:${msg.type()}] ${msg.text()}`));

  for (const e of EXAMPLE_DESIGNS) {
    await page.goto(`${BASE}/?devThumbnails=1&example=${e.id}`);
    await page.waitForFunction(
      () => (window as unknown as ThumbnailCaptureBridge).__thumbnailReady === true,
      null,
      { timeout: 90000 }
    );
    const dataUrl = await page.evaluate(() => {
      const bridge = window as unknown as ThumbnailCaptureBridge;
      return bridge.__captureThumbnail?.() ?? null;
    });
    if (!dataUrl) throw new Error(`capture returned null for ${e.id}`);
    writeFileSync(
      resolve(OUT, `${e.id}.png`),
      Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64')
    );
    console.error(`wrote ${e.id}.png`);
  }

  await browser.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
