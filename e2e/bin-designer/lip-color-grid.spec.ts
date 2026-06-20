/**
 * Functional check for the quadrant × band lip color grid (discussion #1654).
 *
 * Two confirmations:
 *  1. Preview pixels — with a 1×2 (single corner, two Z bands) grid and two
 *     distinct band colors, the rendered canvas must contain pixels matching
 *     BOTH lip colors plus the body color. Both bands are stacked rings that
 *     face the default iso camera, so this proves the seam splitter produces
 *     real, distinctly-colored multi-material geometry (preview == export by
 *     construction, so this also validates the export path).
 *  2. Grid UI — selecting 4 corners × 2 bands expands the editor to 8
 *     distinctly-labeled cell rows.
 */

import { test, expect } from '../fixtures';

const LABS_KEY = 'gridfinity-labs-v1';
const LAB_FLAG = 'multi_color_export';
const BODY_HEX = '#00aaff';
const BAND1_HEX = '#ff0066';
const BAND2_HEX = '#22cc44';
// Three.js lighting darkens the pure hex, so a hit needs a non-trivial per-
// channel tolerance. 80 matches the lit body/upper-rim while keeping the three
// well-separated targets from colliding (measured: tol 48 misses everything,
// 120 floods the frame with the green band).
const PER_CHANNEL_TOLERANCE = 80;
// Minimum exact-color pixels per zone. The lip's lower band sits in shadow and
// is largely occluded from the default iso camera, so it renders far fewer
// pixels than the lit upper rim — but #ff0066 appears nowhere else in the
// scene, so a small floor still proves band 0 is colored. Floors are ~3× below
// measured counts (body≈20k, upper≈7k, lower≈270).
const MIN_BODY_PX = 5000;
const MIN_UPPER_PX = 2000;
const MIN_LOWER_PX = 90;

test.describe('Bin Designer — lip color grid', () => {
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
          /* visibility assertions below fail loudly if labs init breaks */
        }
      },
      { key: LABS_KEY, flag: LAB_FLAG }
    );
  });

  async function setZoneColor(
    page: import('@playwright/test').Page,
    namePattern: RegExp,
    hex: string
  ): Promise<void> {
    const trigger = page.getByRole('button', { name: namePattern });
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

  test('renders two distinct lip band colors in the preview', async ({ page }) => {
    await page.goto('/designer');
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 60000 });

    // The per-zone editors only render once the per-design multi-color toggle
    // is on (the lab flag merely reveals the section).
    await page.getByRole('switch', { name: 'Multi-Color' }).click();

    // Distinct body color as a baseline / control.
    await setZoneColor(page, /^Body: /i, BODY_HEX);

    // Split the lip into two Z bands.
    await page.getByRole('radiogroup', { name: 'Bands' }).getByRole('radio', { name: '2' }).click();

    // Color each band distinctly.
    await setZoneColor(page, /^Stacking Lip · Band 1: /i, BAND1_HEX);
    await setZoneColor(page, /^Stacking Lip · Band 2: /i, BAND2_HEX);

    // Poll the framebuffer until all three colors are present (each paint is a
    // worker round-trip). Per-zone floors because the shadowed lower band
    // renders far fewer pixels than the lit body and upper rim.
    await expect
      .poll(
        async () => {
          const [body, lower, upper] = await sampleCanvas(
            page,
            [BODY_HEX, BAND1_HEX, BAND2_HEX],
            PER_CHANNEL_TOLERANCE
          );
          return body >= MIN_BODY_PX && lower >= MIN_LOWER_PX && upper >= MIN_UPPER_PX;
        },
        {
          timeout: 15000,
          intervals: [200, 500, 1000],
          message: 'lip band grid never produced body + both distinct band colors',
        }
      )
      .toBe(true);
  });

  test('4 corners × 2 bands expands to eight labeled cells', async ({ page }) => {
    await page.goto('/designer');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 });
    await page.getByRole('switch', { name: 'Multi-Color' }).click();

    await page
      .getByRole('radiogroup', { name: 'Corners' })
      .getByRole('radio', { name: '4' })
      .click();
    await page.getByRole('radiogroup', { name: 'Bands' }).getByRole('radio', { name: '2' }).click();

    for (const corner of ['Front-left', 'Front-right', 'Back-right', 'Back-left']) {
      for (const band of ['Band 1', 'Band 2']) {
        await expect(
          page.getByRole('button', { name: new RegExp(`^${corner} · ${band}: `, 'i') })
        ).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

/**
 * Read pixels from the WebGL canvas via an offscreen 2D context and return,
 * for each target hex, the count of pixels whose nearest target (within the
 * per-channel tolerance) is that color.
 */
async function sampleCanvas(
  page: import('@playwright/test').Page,
  hexes: string[],
  perChannelTol: number
): Promise<number[]> {
  return page.evaluate(
    (args: { hexes: string[]; perChannelTol: number }) => {
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

      const targets = args.hexes.map(hexToRgb);
      const threshSq = 3 * args.perChannelTol * args.perChannelTol;
      const hits = new Array(targets.length).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        const px = [data[i]!, data[i + 1]!, data[i + 2]!];
        // Nearest target within threshold counts as a hit for that color.
        let best = -1;
        let bestD = threshSq;
        for (let t = 0; t < targets.length; t++) {
          const d = distSq(px, targets[t]!);
          if (d < bestD) {
            bestD = d;
            best = t;
          }
        }
        if (best >= 0) hits[best]++;
      }
      return hits;
    },
    { hexes, perChannelTol }
  );
}
