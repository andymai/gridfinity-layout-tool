/**
 * One-shot visual verification for the two-variable finger scoop (#2458).
 *
 * Confirms the Finger scoop panel drives the 3D preview end to end: enabling
 * the scoop, expanding Customize, switching from auto to independent
 * height/run steppers, pushing a steep profile, and flipping the curved →
 * straight style each change the canvas — closing the panel → store → worker →
 * canvas loop. Also asserts the steep-overhang warning surfaces.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/scoop-two-variable-visual.spec.ts`
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

test.describe('Finger scoop — two-variable + style (visual)', () => {
  test('custom height/run and straight style drive the 3D preview', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Enable the finger scoop.
    const toggle = page.getByRole('switch', { name: 'Finger scoop' });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await waitForGenerationComplete(page);
    const afterEnable = await canvas.screenshot();

    // Expand the scoop's own Customize disclosure (scoped so we don't hit
    // another feature's Customize link).
    const scoopRoot = toggle.locator('xpath=../..');
    await scoopRoot.getByRole('button', { name: /customize/i }).click();

    // Auto mode: style control + raisable max-height stepper are present.
    await expect(page.getByRole('radiogroup', { name: 'Style' })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Scoop maximum height' })).toBeVisible();

    // Switch to custom sizing → two independent steppers appear.
    await scoopRoot.getByRole('button', { name: /Auto/i }).click();
    const heightInput = page.getByRole('spinbutton', { name: 'Scoop height' });
    const runInput = page.getByRole('spinbutton', { name: 'Scoop run' });
    await expect(heightInput).toBeVisible();
    await expect(runInput).toBeVisible();

    // Push a steep profile: tall rise, short run.
    await heightInput.fill('24');
    await heightInput.press('Enter');
    await runInput.fill('6');
    await runInput.press('Enter');
    await waitForGenerationComplete(page);
    const afterSteep = await canvas.screenshot();
    expect(afterEnable.equals(afterSteep)).toBe(false);

    // Steep-overhang warning surfaces.
    await expect(page.getByText(/steep scoop/i)).toBeVisible();

    // Flip to the straight (chamfer) style → the preview changes again.
    await page.getByRole('radio', { name: 'Straight' }).click();
    await waitForGenerationComplete(page);
    const afterStraight = await canvas.screenshot();
    expect(afterSteep.equals(afterStraight)).toBe(false);

    await test.info().attach('scoop-steep-curved.png', {
      body: afterSteep,
      contentType: 'image/png',
    });
    await test.info().attach('scoop-steep-straight.png', {
      body: afterStraight,
      contentType: 'image/png',
    });
  });
});
