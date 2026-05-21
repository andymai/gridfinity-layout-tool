/**
 * One-shot visual verification for #1822 (angled dividers cut path).
 *
 * Drives the designer through the full UI flow (set compartments → open
 * the diagonal-dividers panel → apply an offset) and captures before /
 * after screenshots of the 3D preview canvas. Pixel diff between the
 * two confirms the divider geometry actually changes when an override
 * is applied — closing the loop on the bug from #1822 where the panel
 * wrote to the store but generation silently ignored it.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/angled-dividers-visual.spec.ts`
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

// Force WebGL via swiftshader so the 3D preview canvas mounts under headless
// Chromium (which by default reports no GPU, preventing Three.js from
// initialising and the canvas from ever being inserted).
test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

/**
 * Wait for the worker round-trip to finish. PreviewSkeleton renders
 * `role="status"` with the "Generating mesh…" label while generationStatus
 * is 'generating'; when complete the skeleton is unmounted. Polling for
 * its absence is a deterministic alternative to wall-clock sleeps.
 */
async function waitForGenerationComplete(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: /generating mesh/i })).toHaveCount(0, {
    timeout: 30_000,
  });
}

test.describe('Angled dividers — visual', () => {
  test('tilt offsets visibly change the 3D preview', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Default is 1×1 (no divider) — bump rows to make the panel eligible.
    await page.getByRole('button', { name: /increase rows/i }).click();
    await expect(page.getByRole('spinbutton', { name: /^rows$/i })).toHaveValue('2', {
      timeout: 5000,
    });

    // FeatureToggle uses role="switch" (not button). i18n label "Diagonal dividers".
    const angledSwitch = page.getByRole('switch', { name: /diagonal dividers/i });
    await expect(angledSwitch).toBeVisible({ timeout: 15_000 });
    await angledSwitch.scrollIntoViewIfNeeded();

    await waitForGenerationComplete(page);
    const beforeBuf = await canvas.screenshot();

    await angledSwitch.click();
    // FeatureToggle has a separate "Customize" button that expands the body.
    const customizeBtn = page.getByRole('button', { name: /^customize$/i }).first();
    await expect(customizeBtn).toBeVisible({ timeout: 5000 });
    await customizeBtn.click();

    await page
      .getByRole('spinbutton', { name: /start \(mm\)/i })
      .first()
      .fill('15');
    await page.keyboard.press('Tab');
    await page
      .getByRole('spinbutton', { name: /end \(mm\)/i })
      .first()
      .fill('-15');
    await page.keyboard.press('Tab');

    await waitForGenerationComplete(page);
    const afterBuf = await canvas.screenshot();

    // Load-bearing: if generation silently ignores the override (the
    // original #1822 bug) the buffers match exactly.
    expect(beforeBuf.equals(afterBuf)).toBe(false);

    await test.info().attach('before-override.png', { body: beforeBuf, contentType: 'image/png' });
    await test.info().attach('after-override.png', { body: afterBuf, contentType: 'image/png' });
  });
});
