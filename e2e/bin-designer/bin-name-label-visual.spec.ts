/**
 * Visual verification for the floor name label's fit-to-band sizing (#1390).
 *
 * The unit tests assert the ladder against synthetic troika measurements. This
 * one covers what a mocked renderer cannot: that troika actually calls back
 * with real glyph metrics, so the label leaves its invisible measuring pass and
 * appears at a fitted size. If the measurement never settles the label stays at
 * `fillOpacity: 0` in every run and the two canvases come out identical —
 * which is what this test fails on.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/bin-name-label-visual.spec.ts`
 */

import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

const SHORT_NAME = 'BITS';
/** Long enough to wrap inside a 1x1 bin's 120mm band, within the 50-char input cap. */
const LONG_NAME = 'Hex driver bits set metric and imperial';

async function waitForGenerationComplete(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: /generating mesh/i })).toHaveCount(0, {
    timeout: 30_000,
  });
}

async function rename(page: Page, name: string): Promise<void> {
  // The rename affordance is a button whose accessible name is the current
  // design name, so it is addressed by its tooltip rather than by role name.
  await page.getByTitle('Click to rename design').click();
  const input = page.getByRole('textbox', { name: 'Design name' });
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(name);
  await page.keyboard.press('Enter');
  await expect(page.getByTitle('Click to rename design')).toContainText(name);
}

/** Waits for the canvas to repaint into something different from `before`. */
async function expectRepaint(canvas: Locator, before: Buffer): Promise<Buffer> {
  await expect
    .poll(async () => (await canvas.screenshot()).equals(before), { timeout: 20_000 })
    .toBe(false);
  return canvas.screenshot();
}

test.describe('Bin name label — visual', () => {
  test('a long name on a 1x1 bin renders at a fitted size', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Shrink to 1x1 — the smallest band, where a long name previously wrapped
    // into a left-ragged block. The steppers clamp at their minimum.
    for (const axis of ['Width', 'Depth']) {
      const decrease = page.getByRole('button', { name: `Decrease ${axis}` });
      // The stepper disables its own button at the minimum, so stop there
      // rather than waiting out a click that can never land.
      for (let i = 0; i < 8 && (await decrease.isEnabled()); i++) await decrease.click();
    }
    await waitForGenerationComplete(page);

    await rename(page, SHORT_NAME);
    await page.waitForTimeout(500);
    const shortLabel = await canvas.screenshot();

    // The name is the only thing that changes, so any repaint is the label
    // itself measuring and re-laying-out.
    await rename(page, LONG_NAME);
    const longLabel = await expectRepaint(canvas, shortLabel);

    // Back to the short name: the label must settle somewhere different again,
    // proving the second measurement was not a one-off.
    await rename(page, SHORT_NAME);
    await expectRepaint(canvas, longLabel);

    await test.info().attach('name-label-short.png', {
      body: shortLabel,
      contentType: 'image/png',
    });
    await test.info().attach('name-label-long.png', { body: longLabel, contentType: 'image/png' });
  });
});
