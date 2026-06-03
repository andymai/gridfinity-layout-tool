/**
 * Visual verification: engraved cutout labels render in the 2D cutout editor.
 *
 * Drives: switch interior to Custom Cutouts → open the cutout editor → place a
 * rectangle → enable "Engrave label" + type text → confirm the label appears
 * on the editor canvas (it previously only showed in the 3D preview).
 *
 * Opt-in only — heavy WebGL interaction with a loose pixel-diff assertion, so
 * it's gated behind RUN_VISUAL_E2E to stay out of the default `pnpm test:e2e`
 * run.
 *
 * Run with:
 *   RUN_VISUAL_E2E=1 pnpm test:e2e e2e/bin-designer/cutout-engraved-label-visual.spec.ts --project=chromium
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

test.skip(!process.env.RUN_VISUAL_E2E, 'manual visual spec — set RUN_VISUAL_E2E=1 to run');

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

test.describe('Cutout editor — engraved labels', () => {
  test('shows the engraved label on the 2D editor canvas', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const previewCanvas = page.locator('canvas').first();
    await expect(previewCanvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // -- Switch interior to Custom Cutouts (solid mode) --
    await page.getByRole('button', { name: /custom cutouts/i }).click();

    // -- Open the full-screen cutout editor ("Cut Editor" CTA) --
    await page.getByRole('button', { name: /cut editor/i }).click();

    // Dismiss the first-run quickstart overlay so it doesn't eat canvas clicks.
    const gotIt = page.getByRole('button', { name: /got it/i });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();

    // The editor canvas starts in click-to-place rectangle mode. The workspace
    // lays out the editor (left) beside the 3D preview (right); pick the
    // leftmost canvas so we drive the editor, not the preview.
    await expect(page.locator('canvas').nth(1)).toBeVisible({ timeout: 15_000 });
    const canvases = await page.locator('canvas').all();
    const boxes = await Promise.all(canvases.map((c) => c.boundingBox()));
    // Editor canvas = leftmost among the real, large canvases (ignore hidden /
    // zero-size thumbnail canvases). 3D preview sits to the right.
    let editorCanvas = null;
    let box = null;
    for (let i = 0; i < canvases.length; i++) {
      const b = boxes[i];
      if (!b || b.width < 200 || b.height < 200) continue;
      if (!box || b.x < box.x) {
        editorCanvas = canvases[i];
        box = b;
      }
    }
    if (!box || !editorCanvas) throw new Error('no editor canvas box');

    // The editor opens with the rectangle tool already active (placing mode),
    // so drag directly to draw a rectangle near the bin center. Clicking the
    // toolbar's Rectangle button would TOGGLE the active tool off — don't.
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx - 40, cy - 30);
    await page.mouse.down();
    await page.mouse.move(cx, cy, { steps: 10 });
    await page.mouse.move(cx + 40, cy + 30, { steps: 10 });
    await page.mouse.up();

    const beforeLabel = await editorCanvas.screenshot();

    // -- Expand the collapsed "Label" section in the inspector --
    await page.getByRole('button', { name: 'Label', exact: true }).click();

    // -- Enable engrave + type a short label. The Checkbox input is sr-only,
    //    so click the visible label text (its wrapping <label> toggles it). --
    const engraveLabelText = page.getByText('Engrave label', { exact: true });
    await expect(engraveLabelText).toBeVisible({ timeout: 10_000 });
    await engraveLabelText.click();

    const labelInput = page.getByRole('textbox', { name: /engrave label/i });
    await labelInput.fill('M4');
    await labelInput.press('Enter');
    await waitForGenerationComplete(page);

    const afterLabel = await editorCanvas.screenshot();
    await page.screenshot({ path: '/tmp/cutout-engraved-label.png', fullPage: false });

    // The canvas must change once the label is engraved on the editor surface.
    expect(Buffer.compare(beforeLabel, afterLabel)).not.toBe(0);

    console.log('screenshot saved to /tmp/cutout-engraved-label.png');
  });
});
