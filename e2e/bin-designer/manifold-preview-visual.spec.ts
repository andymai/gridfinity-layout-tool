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
    // Capture every kernel WASM response (occt-wasm main engine + manifold
    // preview). A stale/missing asset makes the SPA serve index.html (200
    // text/html) for the .wasm URL; the kernel then aborts compiling HTML with
    // "module doesn't start with '\0asm'". Asserting these are real binaries
    // guards that exact failure mode (#engine-init-stale-asset).
    const kernelWasmResponses: { url: string; status: number; contentType: string }[] = [];
    page.on('request', (req) => {
      if (/manifold.*\.wasm/i.test(req.url())) manifoldWasmRequested = true;
    });
    page.on('response', (resp) => {
      const url = resp.url();
      if (/(manifold|occt-wasm).*\.wasm/i.test(url)) {
        kernelWasmResponses.push({
          url,
          status: resp.status(),
          contentType: resp.headers()['content-type'] ?? '',
        });
      }
    });
    // Catch the worker's CompileError even if it's swallowed into a soft error
    // state rather than thrown to the page.
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await enableManifoldPreview(page);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });

    // The main engine must initialize: the preview never enters the
    // "Engine failed to load" error state (shown when the kernel WASM fails to
    // compile — e.g. an HTML response for the .wasm asset).
    await expect(page.getByText('Engine failed to load')).toHaveCount(0);

    await waitForGenerationComplete(page);

    // The engine-failed state must not have flashed up at any point during init.
    await expect(page.getByText('Engine failed to load')).toHaveCount(0);

    // Every kernel WASM the page fetched must be a real WebAssembly binary, not
    // an HTML fallback. (No request → the assertion below on the draft path and
    // a rendered canvas still gate the test.)
    for (const r of kernelWasmResponses) {
      expect(r.status, `WASM ${r.url} status`).toBeLessThan(400);
      expect(r.contentType, `WASM ${r.url} content-type`).not.toContain('html');
    }
    expect(
      consoleErrors.filter((e) => /doesn't start with '\\0asm'|kernel init failed/i.test(e)),
      'kernel WASM compile errors in console'
    ).toEqual([]);

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
