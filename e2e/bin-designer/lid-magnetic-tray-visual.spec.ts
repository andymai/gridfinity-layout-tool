/**
 * Visual verification for magnetic-retention lids and tray tops (#2694).
 *
 * Drives the lid panel end to end:
 *   1. Enable the lid, expand Customize.
 *   2. Switch the attachment mode to Magnetic — the bin grows corner posts and
 *      the lid grows mating bosses, so the canvas must change, and the magnet
 *      controls + press-fit/polarity hint must surface.
 *   3. Switch to Friction and enable the Tray top — the lid's face recesses, so
 *      the canvas must change again.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/lid-magnetic-tray-visual.spec.ts`
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

test.describe('Lid magnetic retention + tray top (visual)', () => {
  test('magnetic attachment and tray top each change the preview', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Enable the lid (default stacking lip is on) and open its Customize panel.
    const lidToggle = page.getByRole('switch', { name: 'Lid' });
    await lidToggle.scrollIntoViewIfNeeded();
    await lidToggle.click();
    await expect(lidToggle).toHaveAttribute('aria-checked', 'true');
    await waitForGenerationComplete(page);

    const lidRoot = lidToggle.locator('xpath=../..');
    await lidRoot.getByRole('button', { name: /customize/i }).click();

    // Baseline: default click-rails attachment.
    const clickBaseline = await canvas.screenshot();

    // Switch to Magnetic — corner posts (bin) + bosses (lid) appear.
    await lidRoot.getByRole('radio', { name: 'Magnetic' }).click();
    await expect(lidRoot.getByRole('radio', { name: 'Magnetic' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await waitForGenerationComplete(page);
    const magnetic = await canvas.screenshot();
    expect(clickBaseline.equals(magnetic)).toBe(false);

    // Magnet controls + press-fit/polarity print hint surface.
    await expect(page.getByText(/Press a .* magnet into each corner/i)).toBeVisible();

    await test.info().attach('lid-magnetic.png', { body: magnetic, contentType: 'image/png' });

    // Back to Friction, then enable the Tray top (available because the
    // stackable top is off by default).
    await lidRoot.getByRole('radio', { name: 'Friction' }).click();
    await waitForGenerationComplete(page);
    const friction = await canvas.screenshot();

    const trayToggle = page.getByRole('switch', { name: 'Tray top' });
    await expect(trayToggle).toBeEnabled();
    await lidRoot.getByText('Tray top', { exact: true }).click();
    await expect(trayToggle).toBeChecked();
    await waitForGenerationComplete(page);
    const tray = await canvas.screenshot();

    // Recessing the top face must change the preview.
    expect(friction.equals(tray)).toBe(false);

    await test.info().attach('lid-tray.png', { body: tray, contentType: 'image/png' });
  });
});
