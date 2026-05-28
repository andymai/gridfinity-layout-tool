/**
 * Visual verification for #1898 — label-tab tuck-under ledges.
 *
 * One-shot spec that drives the label-tabs UI through:
 *   1. Default state (back, 100% width — alignment control hidden)
 *   2. Reducing width — alignment control re-appears with InfoIcon
 *   3. Switching edges to 'both' — two ledges in the 3D preview
 *   4. Bumping inset — tabs slide inward
 *   5. Pushing depth to collision threshold — inline warning + only back tab
 *
 * Captures screenshots between states so a reviewer can replay what the
 * UI actually looks like. Not part of CI — intended as a manual `pnpm
 * test:e2e` invocation for review-time verification.
 *
 * Run with:
 *   pnpm test:e2e e2e/bin-designer/label-tabs-tuck-under-visual.spec.ts --project=chromium
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

test.describe('Label tabs — tuck-under ledges (#1898)', () => {
  test('drives the panel through back/front/both + inset + collision', async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // -- Enable Label Tabs + expand the Customize panel --
    const labelTabsSwitch = page.getByRole('switch', { name: /label tabs/i });
    await expect(labelTabsSwitch).toBeVisible({ timeout: 15_000 });
    await labelTabsSwitch.scrollIntoViewIfNeeded();
    await labelTabsSwitch.click();
    await waitForGenerationComplete(page);

    // FeatureToggle keeps detail controls behind a Customize button.
    // Scope to the Label-tabs FeatureToggle wrapper by going up from the
    // switch (switch → flex row → FeatureToggle outer div) so we don't
    // accidentally hit another section's Customize button.
    const labelTabsWrapper = labelTabsSwitch.locator('xpath=ancestor::div[2]');
    const customizeBtn = labelTabsWrapper.getByRole('button', { name: 'Customize', exact: true });
    await customizeBtn.scrollIntoViewIfNeeded();
    await customizeBtn.click();
    const labelTabsRegion = page.getByRole('region', { name: /label tabs settings/i });
    await expect(labelTabsRegion).toHaveAttribute('aria-hidden', 'false', { timeout: 5000 });

    // -- Default state: back edge selected, alignment HIDDEN at width=100% --
    const edgesGroup = page.getByRole('group', { name: /tab edges/i });
    await expect(edgesGroup).toBeVisible();
    await expect(edgesGroup.getByRole('button', { name: 'Back' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    // Alignment control should NOT be present at 100% width (default)
    await expect(page.getByRole('group', { name: /tab alignment/i })).toHaveCount(0);

    await page.screenshot({
      path: '/tmp/label-tabs-1-default-back-only.png',
      fullPage: false,
    });

    // -- Reduce Tab width to expose the alignment control --
    // Tab width stepper has aria-label "Tab width"; press its "-" decrement button.
    const widthDec = page.getByRole('button', { name: /decrease tab width/i }).first();
    await widthDec.click();
    await widthDec.click();
    await widthDec.click();
    // Alignment control should now appear (width < 100%)
    await expect(page.getByRole('group', { name: /tab alignment/i })).toBeVisible({
      timeout: 5000,
    });
    await waitForGenerationComplete(page);
    await page.screenshot({
      path: '/tmp/label-tabs-2-width-85-alignment-visible.png',
      fullPage: false,
    });

    // Restore width to 100% so alignment hides again, then bump back to test 'both'
    const widthInc = page.getByRole('button', { name: /increase tab width/i }).first();
    await widthInc.click();
    await widthInc.click();
    await widthInc.click();
    await expect(page.getByRole('group', { name: /tab alignment/i })).toHaveCount(0);

    // -- Switch to 'both' edges --
    const bothBtn = page.getByRole('button', { name: 'Both', exact: true });
    await bothBtn.click();
    await expect(bothBtn).toHaveAttribute('aria-pressed', 'true');
    await waitForGenerationComplete(page);
    await page.screenshot({
      path: '/tmp/label-tabs-3-edges-both.png',
      fullPage: false,
    });
    const bothCanvasBuf = await canvas.screenshot();

    // -- Bump Inset to slide both tabs inward --
    const insetInc = page.getByRole('button', { name: /increase tab inset/i }).first();
    for (let i = 0; i < 5; i++) await insetInc.click();
    await waitForGenerationComplete(page);
    await page.screenshot({
      path: '/tmp/label-tabs-4-both-with-inset.png',
      fullPage: false,
    });
    const insetCanvasBuf = await canvas.screenshot();

    // Visual sanity: 'both' geometry should differ once inset is non-zero.
    expect(Buffer.compare(bothCanvasBuf, insetCanvasBuf)).not.toBe(0);

    // Reset inset to 0
    const insetDec = page.getByRole('button', { name: /decrease tab inset/i }).first();
    for (let i = 0; i < 5; i++) await insetDec.click();
    await waitForGenerationComplete(page);

    // -- Force a silent-drop condition by setting depth + inset via the
    //    spinbutton inputs directly (faster than a click-loop). With
    //    edges='both' on the default 2u×2u 1-row bin (cellD ≈ 81mm),
    //    2·40 + 2·15 = 110 > 81 fires the collision guard.
    const depthInput = labelTabsRegion.getByRole('spinbutton', { name: /tab depth/i });
    await depthInput.fill('40');
    await depthInput.press('Enter');
    const insetInput = labelTabsRegion.getByRole('spinbutton', { name: /tab inset/i });
    await insetInput.fill('15');
    await insetInput.press('Enter');
    await waitForGenerationComplete(page);

    // -- Auto-fix button should now be visible alongside the warning --
    const autoFixBtn = page.getByRole('button', { name: /auto-fix/i });
    await expect(autoFixBtn).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: '/tmp/label-tabs-5-warning-with-autofix.png',
      fullPage: false,
    });

    // -- Click Auto-fix and verify the warning disappears + geometry generates --
    await autoFixBtn.click();
    await waitForGenerationComplete(page);
    await expect(autoFixBtn).toHaveCount(0, { timeout: 5000 });
    await page.screenshot({
      path: '/tmp/label-tabs-6-after-autofix.png',
      fullPage: false,
    });

    console.log('screenshots saved to /tmp/label-tabs-*.png');
  });
});
