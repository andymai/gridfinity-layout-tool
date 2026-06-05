/**
 * Visual verification for the Manifold draft preview (manifold_preview Labs flag).
 *
 * Confirms the feature works end-to-end in the browser:
 *   1. With the flag on, the Manifold preview worker actually loads (its WASM is
 *      fetched) — i.e. the draft path runs rather than silently falling back to
 *      exact-only.
 *   2. The bin designer renders a non-blank bin and an edit drives the full
 *      draft → exact loop (canvas changes, generation settles, no crash).
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/manifold-preview-visual.spec.ts`
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

// Enable the manifold_preview Labs flag before the app boots (it's read from
// this localStorage key at store init; requiresRefresh is satisfied because we
// set it before first load).
async function enableManifoldPreview(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'gridfinity-labs-v1',
      JSON.stringify({
        enabledFeatures: { manifold_preview: true },
        lastModified: '2026-06-05T00:00:00.000Z',
        version: 1,
      })
    );
  });
}

async function waitForGenerationComplete(page: Page): Promise<void> {
  await expect(page.getByRole('status', { name: /generating mesh/i })).toHaveCount(0, {
    timeout: 30_000,
  });
}

test.describe('Manifold draft preview — visual', () => {
  test('loads the Manifold preview kernel and drives the draft → exact loop', async ({ page }) => {
    test.setTimeout(180_000);

    // Record whether the Manifold preview worker fetched its WASM — proof the
    // draft path is exercised, not silently bypassed.
    let manifoldWasmRequested = false;
    page.on('request', (req) => {
      if (/manifold.*\.wasm/i.test(req.url())) manifoldWasmRequested = true;
    });

    await enableManifoldPreview(page);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    const settledWithFlag = await canvas.screenshot();
    // Non-blank: a rendered bin produces a non-trivial PNG.
    expect(settledWithFlag.byteLength).toBeGreaterThan(2_000);

    // An edit drives the full preview loop (draft on edit → exact on settle).
    const widthInput = page.getByLabel('Width', { exact: true }).first();
    await expect(widthInput).toBeVisible({ timeout: 15_000 });
    await widthInput.fill('3');
    await page.keyboard.press('Enter');

    // The edit must visibly change the preview (draft or exact — either proves
    // the loop ran). Poll rather than rely on a status selector.
    await expect
      .poll(async () => (await canvas.screenshot()).equals(settledWithFlag), { timeout: 30_000 })
      .toBe(false);
    await waitForGenerationComplete(page);
    const afterEdit = await canvas.screenshot();

    // The Manifold preview kernel must have loaded for the draft path to run.
    expect(manifoldWasmRequested).toBe(true);

    await test.info().attach('manifold-preview-settled.png', {
      body: settledWithFlag,
      contentType: 'image/png',
    });
    await test.info().attach('manifold-preview-after-edit.png', {
      body: afterEdit,
      contentType: 'image/png',
    });
  });
});
