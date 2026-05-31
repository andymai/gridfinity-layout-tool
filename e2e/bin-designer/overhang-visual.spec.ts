/**
 * One-shot visual verification for per-side bin overhang (#1641).
 *
 * Confirms the Overhang panel (a collapsed-by-default disclosure near the
 * dimension controls) drives the 3D preview: expanding it, setting a side, and
 * toggling feet-under-overhang each change the canvas — closing the
 * panel → store → worker → canvas loop.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/overhang-visual.spec.ts`
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

async function waitForGenerationComplete(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: /generating mesh/i })).toHaveCount(0, {
    timeout: 30_000,
  });
}

test.describe('Bin overhang — visual', () => {
  test('overhang panel drives the 3D preview, including the feet toggle', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Collapsed by default: the header reports aria-expanded=false.
    const header = page.getByRole('button', { name: /^Overhang/i });
    await expect(header).toBeVisible({ timeout: 15_000 });
    await expect(header).toHaveAttribute('aria-expanded', 'false');

    // Expand the disclosure → the four per-side controls + feet toggle appear.
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    for (const side of ['Left', 'Right', 'Front', 'Back']) {
      await expect(page.getByText(side, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByText(/Feet under overhang/i)).toBeVisible();

    const beforeBuf = await canvas.screenshot();

    // Drive the "Right" overhang badge → type an outward expansion.
    const zeroBadges = page.getByRole('button', { name: '0 mm' });
    await expect(zeroBadges.nth(1)).toBeVisible({ timeout: 10_000 });
    await zeroBadges.nth(1).click();
    const rightInput = page.getByRole('textbox', { name: 'Right' });
    await rightInput.fill('18');
    await page.keyboard.press('Enter');

    await waitForGenerationComplete(page);
    const afterOverhang = await canvas.screenshot();
    expect(beforeBuf.equals(afterOverhang)).toBe(false);

    // Toggle feet-under-overhang → the base geometry changes again.
    await page.getByText(/Feet under overhang/i).click();
    await waitForGenerationComplete(page);
    const afterFeet = await canvas.screenshot();
    expect(afterOverhang.equals(afterFeet)).toBe(false);

    await test.info().attach('overhang-before.png', { body: beforeBuf, contentType: 'image/png' });
    await test.info().attach('overhang-expanded.png', {
      body: afterOverhang,
      contentType: 'image/png',
    });
    await test.info().attach('overhang-feet.png', { body: afterFeet, contentType: 'image/png' });
  });

  test('hovering an overhang control highlights the matching wall', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    const header = page.getByRole('button', { name: /^Overhang/i });
    await expect(header).toBeVisible({ timeout: 15_000 });
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Left', { exact: true }).first()).toBeVisible();

    // Baseline with the pointer off the panel controls.
    await header.hover();
    await page.waitForTimeout(250);
    const baseline = await canvas.screenshot();

    // Hovering a side control lights up its wall (translucent overlay) even at 0mm.
    await page.getByText('Left', { exact: true }).first().hover();
    await page.waitForTimeout(250);
    const hovered = await canvas.screenshot();
    expect(baseline.equals(hovered)).toBe(false);

    // Moving the pointer away clears the highlight, returning to the baseline.
    await header.hover();
    await page.waitForTimeout(250);
    const cleared = await canvas.screenshot();
    expect(cleared.equals(hovered)).toBe(false);
    expect(cleared.equals(baseline)).toBe(true);

    await test.info().attach('highlight-baseline.png', {
      body: baseline,
      contentType: 'image/png',
    });
    await test.info().attach('highlight-hovered.png', { body: hovered, contentType: 'image/png' });
  });
});
