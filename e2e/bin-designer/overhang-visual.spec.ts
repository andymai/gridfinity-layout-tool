/**
 * One-shot visual verification for per-side bin overhang (#1641).
 *
 * Confirms the Overhang panel renders its four per-side controls and that
 * driving one side actually changes the 3D preview — closing the
 * panel → store → worker → canvas loop, not just the unit/store tests.
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
  test('overhang panel renders and drives the 3D preview', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // The Overhang section + its four per-side controls render.
    await expect(page.getByText('Overhang', { exact: true })).toBeVisible({ timeout: 15_000 });
    for (const side of ['Left', 'Right', 'Front', 'Back']) {
      await expect(page.getByText(side, { exact: true }).first()).toBeVisible();
    }

    const beforeBuf = await canvas.screenshot();

    // Drive the "Right" overhang badge → type an outward expansion.
    // Default badges read "0 mm"; the overhang sliders are the only zero-mm
    // sliders on the designer panel.
    const zeroBadges = page.getByRole('button', { name: '0 mm' });
    await expect(zeroBadges.nth(1)).toBeVisible({ timeout: 10_000 });
    await zeroBadges.nth(1).click();
    const rightInput = page.getByRole('textbox', { name: 'Right' });
    await rightInput.fill('18');
    await page.keyboard.press('Enter');

    await waitForGenerationComplete(page);
    const afterBuf = await canvas.screenshot();

    // Load-bearing: if the panel didn't drive generation the buffers match.
    expect(beforeBuf.equals(afterBuf)).toBe(false);

    await test.info().attach('overhang-before.png', { body: beforeBuf, contentType: 'image/png' });
    await test.info().attach('overhang-after.png', { body: afterBuf, contentType: 'image/png' });
  });
});
