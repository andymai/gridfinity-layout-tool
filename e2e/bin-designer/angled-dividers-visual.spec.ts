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

import { test, expect } from '../fixtures';

// Force WebGL via swiftshader so the 3D preview canvas mounts under headless
// Chromium (which by default reports no GPU, preventing Three.js from
// initialising and the canvas from ever being inserted).
test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

test.describe('Angled dividers — visual', () => {
  test('tilt offsets visibly change the 3D preview', async ({ page }) => {
    test.setTimeout(180_000);
    page.on('console', (msg) => console.log(`[browser:${msg.type()}]`, msg.text()));
    page.on('pageerror', (err) => console.log(`[browser:error]`, err.message));
    await page.goto('/designer');

    // Wait for the 3D preview canvas to mount (WASM kernel + Three.js).
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });

    // Default compartments are 1×1 (no divider). Bump rows to 2 so we get
    // a horizontal divider between compartments 1 and 2, making the
    // angled-dividers panel eligible.
    await page.getByRole('button', { name: /increase rows/i }).click();
    await expect(page.getByRole('spinbutton', { name: /^rows$/i })).toHaveValue('2', {
      timeout: 5000,
    });

    // FeatureToggle uses role="switch", not button. The angled-dividers
    // panel uses the i18n label "Diagonal dividers".
    const angledSwitch = page.getByRole('switch', { name: /diagonal dividers/i });
    await expect(angledSwitch).toBeVisible({ timeout: 15_000 });
    await angledSwitch.scrollIntoViewIfNeeded();

    // Worker round-trip after rows change — settle, then snapshot.
    await page.waitForTimeout(2500);
    const beforeBuf = await canvas.screenshot();

    // Toggle the panel open to reveal the offset steppers.
    await angledSwitch.click();

    // FeatureToggle has a separate "Customize" button that expands the
    // body where the per-divider offset controls live.
    const customizeBtn = page.getByRole('button', { name: /^customize$/i }).first();
    if (await customizeBtn.count()) {
      await customizeBtn.click();
    }

    // Apply a tilt via the Start/End spinbuttons for "Comp 1 ↔ Comp 2".
    const startSpin = page.getByRole('spinbutton', { name: /start \(mm\)/i }).first();
    await expect(startSpin).toBeVisible({ timeout: 5000 });
    await startSpin.fill('15');
    await startSpin.press('Tab');

    const endSpin = page.getByRole('spinbutton', { name: /end \(mm\)/i }).first();
    await endSpin.fill('-15');
    await endSpin.press('Tab');

    // Worker round-trip for the tilt to propagate to the mesh.
    await page.waitForTimeout(3000);
    const afterBuf = await canvas.screenshot();

    // The two screenshots MUST differ — if generation silently ignores
    // the override (the original #1822 bug) the buffers match exactly.
    expect(beforeBuf.equals(afterBuf)).toBe(false);

    // Save the screenshots as test artifacts so a human can sanity-check
    // them. test-results lands under playwright-report on CI.
    await test.info().attach('before-override.png', { body: beforeBuf, contentType: 'image/png' });
    await test.info().attach('after-override.png', { body: afterBuf, contentType: 'image/png' });
  });
});
