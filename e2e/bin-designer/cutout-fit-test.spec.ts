/**
 * E2E coverage for the cutout fit-test card.
 *
 * Drives the real path a maker takes: switch the interior to Custom Cutouts,
 * draw a cutout, then export the fit test from the editor's inspector — the
 * same panel that carries the Clearance field the card exists to calibrate.
 * The worker actually runs, so this exercises the whole chain (bridge message,
 * export-quality generation, the Z-band intersect, the underside stamp and the
 * download) rather than any part of it in isolation.
 */

import type { Page } from '@playwright/test';
import { test, expect, clearAllStorage } from '../fixtures';

async function waitForGenerationComplete(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: /generating mesh/i })).toHaveCount(0, {
    timeout: 60_000,
  });
}

/** Switch to Custom Cutouts and open the full-screen cutout editor. */
async function openCutoutEditor(page: Page): Promise<void> {
  await page.getByRole('button', { name: /custom cutouts/i }).click();
  await page.getByRole('button', { name: /cut editor/i }).click();

  const gotIt = page.getByRole('button', { name: /got it/i });
  if (await gotIt.isVisible().catch(() => false)) await gotIt.click();

  await expect(page.locator('canvas').nth(1)).toBeVisible({ timeout: 15_000 });
}

/** Draw one rectangle on the editor canvas. */
async function drawOneCutout(page: Page): Promise<void> {
  // Editor canvas is the leftmost large canvas; the 3D preview sits right of it.
  const canvases = await page.locator('canvas').all();
  const boxes = await Promise.all(canvases.map((c) => c.boundingBox()));
  let box: { x: number; y: number; width: number; height: number } | null = null;
  for (const candidate of boxes) {
    if (!candidate || candidate.width < 200 || candidate.height < 200) continue;
    if (!box || candidate.x < box.x) box = candidate;
  }
  if (!box) throw new Error('no editor canvas box');

  // The rectangle tool is already active on open — clicking its toolbar button
  // would toggle it OFF, so drag directly.
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 40, cy - 30);
  await page.mouse.down();
  await page.mouse.move(cx, cy, { steps: 10 });
  await page.mouse.move(cx + 40, cy + 30, { steps: 10 });
  await page.mouse.up();
}

test.describe('Bin Designer — cutout fit test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/designer');
    // The preview canvas is the designer's readiness signal; the shape grid
    // only exists once Custom shape is on.
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
  });

  test('is offered only once the design has a cutout, and downloads a card', async ({ page }) => {
    test.setTimeout(240_000);

    await openCutoutEditor(page);

    // An empty board has nothing to fit-test, so the control stays away.
    await expect(page.getByRole('button', { name: /print fit test/i })).toHaveCount(0);

    await drawOneCutout(page);

    const fitTest = page.getByRole('button', { name: /print fit test/i });
    await expect(fitTest).toBeVisible({ timeout: 30_000 });
    await fitTest.click();

    // The dialog answers the two questions that decide whether to print: how
    // thick the card is, and what it costs against the whole bin.
    await expect(page.getByText(/cutout fit test/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/card thickness/i)).toBeVisible();
    await expect(page.getByText(/whole bin/i)).toBeVisible();

    const download = page.waitForEvent('download', { timeout: 180_000 });
    await page
      .getByRole('button', { name: /download/i })
      .first()
      .click();

    const file = await download;
    expect(file.suggestedFilename()).toMatch(/fit-test\.stl$/);

    // A card that generated but came out empty would still "download". Assert
    // the STL actually carries triangles: a binary STL is an 80-byte header
    // plus a 4-byte count, so anything real is well past that.
    const path = await file.path();
    expect(path).toBeTruthy();
    const { statSync } = await import('node:fs');
    expect(statSync(path).size).toBeGreaterThan(1000);
  });
});
