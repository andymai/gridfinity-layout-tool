/**
 * Visual regression guard for the multi-color 3D preview.
 *
 * The existing 3MF export e2e covers the export pipeline; this covers the
 * preview itself. After setting distinct body and lip colors, the rendered
 * canvas must contain pixels that match (or are close to) both colors —
 * verifying the worker→bridge→BinMesh→Three.js path produces multi-material
 * output, not a single-color collapse.
 *
 * If setShapeOrigin, face-group propagation, or material wiring regresses,
 * the lip pixels stop matching the lip hex and this test fails.
 */

import { test, expect } from '../fixtures';

const LABS_KEY = 'gridfinity-labs-v1';
const LAB_FLAG = 'multi_color_export';
const BODY_HEX = '#00aaff';
const LIP_HEX = '#ff0066';
const PER_CHANNEL_TOLERANCE = 64;
// 0.25% of pixels ≈ a 48×48 block on a 1280×720 canvas
const MIN_PIXEL_RATIO = 0.0025;

test.describe('Bin Designer — multi-color 3D preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ key, flag }) => {
        const prefs = {
          enabledFeatures: { [flag]: true },
          lastModified: new Date().toISOString(),
          version: 1,
        };
        try {
          localStorage.setItem(key, JSON.stringify(prefs));
        } catch {
          /* visibility assertion below will fail loudly if labs init breaks */
        }
      },
      { key: LABS_KEY, flag: LAB_FLAG }
    );
  });

  test('rendered preview contains pixels matching both body and lip colors', async ({ page }) => {
    await page.goto('/designer');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 30000 });

    for (const [label, hex] of [
      [/^Body: /i, BODY_HEX],
      [/^Stacking Lip: /i, LIP_HEX],
    ] as const) {
      const trigger = page.getByRole('button', { name: label });
      await expect(trigger).toBeVisible({ timeout: 5000 });
      await trigger.click();
      const popover = page.locator('[role="dialog"]').last();
      await popover.getByRole('textbox').first().fill(hex);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: new RegExp(`${hex}$`, 'i') })).toBeVisible({
        timeout: 5000,
      });
    }

    // Poll the framebuffer until both colors are present rather than sleeping
    // a fixed interval. The first paint after the color change happens after
    // a worker round-trip; on a slow CI runner this can be a few seconds, on
    // a fast machine it's tens of ms. Poll fails fast on a real regression
    // and never sleeps longer than needed.
    await expect
      .poll(
        async () => sampleCanvas(page, BODY_HEX, LIP_HEX, PER_CHANNEL_TOLERANCE, MIN_PIXEL_RATIO),
        {
          timeout: 15000,
          intervals: [200, 500, 1000],
          message: 'multi-color preview never produced both body and lip pixels',
        }
      )
      .toMatchObject({ bodyOk: true, lipOk: true });
  });
});

interface PixelSample {
  bodyHits: number;
  lipHits: number;
  total: number;
  minHits: number;
  bodyOk: boolean;
  lipOk: boolean;
}

/**
 * Read pixels from the WebGL canvas via an offscreen 2D context — WebGL
 * canvases can't expose getImageData directly. Returns hit counts for the
 * body and lip colors plus boolean gates the caller polls against.
 */
async function sampleCanvas(
  page: import('@playwright/test').Page,
  bodyHex: string,
  lipHex: string,
  perChannelTol: number,
  minRatio: number
): Promise<PixelSample> {
  return page.evaluate(
    (args: { bodyHex: string; lipHex: string; perChannelTol: number; minRatio: number }) => {
      const hexToRgb = (hex: string): [number, number, number] => {
        const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
        if (!m) throw new Error(`bad hex: ${hex}`);
        return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
      };
      const distSq = (a: number[], b: number[]): number =>
        (a[0]! - b[0]!) ** 2 + (a[1]! - b[1]!) ** 2 + (a[2]! - b[2]!) ** 2;

      const src = document.querySelector('canvas');
      if (!src) throw new Error('canvas not found');
      const w = src.width;
      const h = src.height;
      const off = document.createElement('canvas');
      off.width = w;
      off.height = h;
      const ctx = off.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(src, 0, 0);
      const data = ctx.getImageData(0, 0, w, h).data;

      const bodyRgb = hexToRgb(args.bodyHex);
      const lipRgb = hexToRgb(args.lipHex);
      const threshSq = 3 * args.perChannelTol * args.perChannelTol;
      let bodyHits = 0;
      let lipHits = 0;
      for (let i = 0; i < data.length; i += 4) {
        const px = [data[i]!, data[i + 1]!, data[i + 2]!];
        if (distSq(px, bodyRgb) < threshSq) bodyHits++;
        else if (distSq(px, lipRgb) < threshSq) lipHits++;
      }
      const total = w * h;
      const minHits = Math.floor(total * args.minRatio);
      return {
        bodyHits,
        lipHits,
        total,
        minHits,
        bodyOk: bodyHits > minHits,
        lipOk: lipHits > minHits,
      };
    },
    { bodyHex, lipHex, perChannelTol, minRatio }
  );
}
