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
 * Set EXAMPLE_ID=<id>[,<id>] to (re)render only specific examples.
 */

import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
// gltf-pipeline ships no types; processGlb takes a glb Buffer and resolves { glb }.
import gltfPipeline from 'gltf-pipeline';
import { EXAMPLE_DESIGNS } from '../src/features/bin-designer/data/examples';

interface GltfPipeline {
  processGlb: (
    glb: Buffer,
    options: { dracoOptions: { compressionLevel: number } }
  ) => Promise<{ glb: Buffer }>;
}

const { processGlb } = gltfPipeline as unknown as GltfPipeline;

const OUT = resolve(process.cwd(), 'src/features/bin-designer/data/examples/thumbnails');
const MESH_OUT = resolve(process.cwd(), 'src/features/bin-designer/data/examples/meshes');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

interface ThumbnailCaptureBridge {
  __thumbnailReady?: boolean;
  __captureThumbnail?: () => string | null;
  __exportGlb?: () => Promise<string | null>;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(MESH_OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  page.on('console', (msg) => console.error(`[page:${msg.type()}] ${msg.text()}`));

  const only = process.env.EXAMPLE_ID?.split(',').map((s) => s.trim());
  const targets = only ? EXAMPLE_DESIGNS.filter((e) => only.includes(e.id)) : EXAMPLE_DESIGNS;

  for (const e of targets) {
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

    const glb = await page.evaluate(
      () => (window as unknown as ThumbnailCaptureBridge).__exportGlb?.() ?? null
    );
    if (glb) {
      const raw = Buffer.from(glb, 'base64');
      const { glb: compressed } = await processGlb(raw, {
        dracoOptions: { compressionLevel: 7 },
      });
      writeFileSync(resolve(MESH_OUT, `${e.id}.glb`), compressed);
      console.error(`wrote ${e.id}.glb (${raw.length} -> ${compressed.length} bytes, draco)`);
    } else {
      console.error(`no GLB for ${e.id} (export returned null)`);
    }
  }

  await browser.close();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
