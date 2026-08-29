/**
 * The lid cutout editor shows what the worker will clip around.
 *
 * A hole drawn across a magnetic lid's retention boss is clipped by the worker,
 * correctly, so the boss survives and the lid keeps holding. Nothing in the
 * editor used to say so: the shape drew as if it would cut cleanly and the
 * printed part came out with an unexplained disc-shaped island in the slot.
 *
 * Covered here rather than in a unit test because what can break is the WIRING.
 * `lidWindowFit` is unit-tested against windows built by hand; whether the real
 * window reaches the canvas at all, and whether the flag reaches the banner, is
 * only answerable with the app running.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/lid-cutout-keepouts.spec.ts`
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

test.describe('Lid cutout keep-outs', () => {
  test('a shape over a magnet boss is flagged and can be moved clear', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    const lidToggle = page.getByRole('switch', { name: 'Lid' });
    await lidToggle.scrollIntoViewIfNeeded();
    await lidToggle.click();
    await expect(lidToggle).toBeChecked();
    await waitForGenerationComplete(page);

    // Magnetic is the attachment that grows retention bosses; the other modes
    // have no keep-outs at all, so this is the only one that exercises them.
    const attachment = page.getByRole('radiogroup', { name: 'Attachment' });
    await attachment.getByRole('radio', { name: 'Magnetic' }).click();
    await waitForGenerationComplete(page);

    await page.getByRole('button', { name: /Cut holes in the lid/i }).click();
    const gotIt = page.getByRole('button', { name: /Got it/i });
    if (await gotIt.isVisible().catch(() => false)) await gotIt.click();

    const banner = page.getByText(/will be clipped/i);
    await expect(banner).toHaveCount(0);

    // Click-to-place a rectangle onto the board's front-left corner, which is
    // where a 2x2 lid puts its first boss.
    await page.mouse.click(100, 527);
    await expect(banner).toBeVisible();

    // Growing the bin is not the mechanism here — a shape lying on a boss is
    // not short of room — so that explanation must not appear.
    await expect(page.getByText(/can't grow far enough/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Bring back in/i }).click();
    await expect(banner).toHaveCount(0);
  });
});
