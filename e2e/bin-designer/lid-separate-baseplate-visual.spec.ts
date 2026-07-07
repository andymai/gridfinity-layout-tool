/**
 * Visual verification for the separate stack-grid baseplate (glue-on).
 *
 * Drives the lid panel end to end: enable the lid, expand Customize, turn on
 * the stackable top (grid fused on the lid), then split it into a separate
 * glue-on baseplate. Splitting must change the canvas — the lid loses its grid
 * and the baseplate renders as its own piece floating above the lid — and the
 * print-guidance hint must surface.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/lid-separate-baseplate-visual.spec.ts`
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

test.describe('Lid separate baseplate (visual)', () => {
  test('splitting the stack grid into a glue-on baseplate changes the preview', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Enable the lid (requires the default stacking lip, which is on).
    const lidToggle = page.getByRole('switch', { name: 'Lid' });
    await lidToggle.scrollIntoViewIfNeeded();
    await lidToggle.click();
    await expect(lidToggle).toHaveAttribute('aria-checked', 'true');
    await waitForGenerationComplete(page);

    // Expand the lid's own Customize disclosure (scoped so we don't hit
    // another feature's Customize link).
    const lidRoot = lidToggle.locator('xpath=../..');
    await lidRoot.getByRole('button', { name: /customize/i }).click();

    // Turn on the stackable top → grid fuses onto the lid. The design-system
    // Switch is an sr-only input wrapped in a <label>, so click the visible
    // label text (scoped to the lid region) to toggle it.
    const stackable = page.getByRole('switch', { name: 'Stackable top grid' });
    await lidRoot.getByText('Stackable top grid', { exact: true }).click();
    await expect(stackable).toBeChecked();
    await waitForGenerationComplete(page);
    const fused = await canvas.screenshot();

    // The separate-baseplate switch becomes enabled once the stackable top is on.
    const separate = page.getByRole('switch', { name: 'Separate baseplate (glue-on)' });
    await expect(separate).toBeEnabled();
    await lidRoot.getByText('Separate baseplate (glue-on)', { exact: true }).click();
    await expect(separate).toBeChecked();
    await waitForGenerationComplete(page);
    const split = await canvas.screenshot();

    // Splitting removes the grid from the lid and floats the baseplate above it
    // → the canvas must change.
    expect(fused.equals(split)).toBe(false);

    // Print-guidance hint surfaces.
    await expect(page.getByText(/Glue it onto the lid/i)).toBeVisible();

    // Attach the exploded preview to the Playwright report for eyeballing.
    await test.info().attach('lid-separate-baseplate.png', {
      body: split,
      contentType: 'image/png',
    });
  });
});
