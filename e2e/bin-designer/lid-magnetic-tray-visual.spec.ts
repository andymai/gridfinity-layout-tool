/**
 * Visual verification for magnetic-retention lids and tray tops (#2694).
 *
 * Drives the redesigned lid group end to end:
 *   1. Enable the lid — its controls render directly (no Customize step).
 *   2. Switch the attachment mode to Magnetic — the bin grows corner posts and
 *      the lid grows mating bosses, so the canvas must change, and the magnet
 *      press-fit/polarity hint must surface.
 *   3. Switch to Friction and pick the Tray top surface — the lid's face
 *      recesses, so the canvas must change again.
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

    // Enable the lid (default stacking lip is on). Controls appear directly.
    const lidToggle = page.getByRole('switch', { name: 'Lid' });
    await lidToggle.scrollIntoViewIfNeeded();
    await lidToggle.click();
    await expect(lidToggle).toBeChecked();
    await waitForGenerationComplete(page);

    // Baseline: default click-rails attachment.
    const clickBaseline = await canvas.screenshot();

    // Switch to Magnetic — corner posts (bin) + bosses (lid) appear.
    const attachment = page.getByRole('radiogroup', { name: 'Attachment' });
    await attachment.getByRole('radio', { name: 'Magnetic' }).click();
    await expect(attachment.getByRole('radio', { name: 'Magnetic' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await waitForGenerationComplete(page);
    const magnetic = await canvas.screenshot();
    expect(clickBaseline.equals(magnetic)).toBe(false);

    // Magnet press-fit/polarity print hint surfaces.
    await expect(page.getByText(/Press a .* magnet into each corner/i)).toBeVisible();

    await test.info().attach('lid-magnetic.png', { body: magnetic, contentType: 'image/png' });

    // Back to Friction, then pick the Tray top surface (available because the
    // stackable top is off by default).
    await attachment.getByRole('radio', { name: 'Friction' }).click();
    await waitForGenerationComplete(page);
    const friction = await canvas.screenshot();

    const topSurface = page.getByRole('radiogroup', { name: 'Top surface' });
    await topSurface.getByRole('radio', { name: 'Tray' }).click();
    await expect(topSurface.getByRole('radio', { name: 'Tray' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await waitForGenerationComplete(page);
    const tray = await canvas.screenshot();

    // Recessing the top face must change the preview.
    expect(friction.equals(tray)).toBe(false);

    await test.info().attach('lid-tray.png', { body: tray, contentType: 'image/png' });
  });
});
