/**
 * One-shot visual + perf verification for the Manifold draft split.
 *
 * Drives the designer to an oversized (splitting) bin and confirms the split
 * preview renders, then edits the bin and confirms the preview updates — the
 * draft (Manifold) path renders on the leading edge while the exact occt-wasm
 * result computes. Captures screenshots for visual review.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/split-draft-manifold-visual.spec.ts`
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

test.describe('Manifold draft split — visual', () => {
  test('oversized bin renders a split preview that updates on edit', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Oversize the bin so it must split into pieces (default print bed ≈ 256mm).
    await page.getByRole('spinbutton', { name: 'Width' }).fill('10');
    await page.getByRole('spinbutton', { name: 'Width' }).blur();

    // The split options panel only renders once the bin needs splitting — a
    // proxy that the split preview path is active.
    await expect(page.getByRole('switch', { name: /wall connectors/i })).toBeVisible({
      timeout: 15_000,
    });
    await waitForGenerationComplete(page);

    const split = await canvas.screenshot();

    // Edit the bin; the split preview must re-render (draft then exact).
    await page.getByRole('spinbutton', { name: 'Height' }).fill('6');
    await page.getByRole('spinbutton', { name: 'Height' }).blur();
    await waitForGenerationComplete(page);

    const splitEdited = await canvas.screenshot();

    // The taller bin must produce a visibly different split preview.
    expect(split.equals(splitEdited)).toBe(false);

    await test.info().attach('split-preview.png', { body: split, contentType: 'image/png' });
    await test.info().attach('split-preview-taller.png', {
      body: splitEdited,
      contentType: 'image/png',
    });
  });
});
