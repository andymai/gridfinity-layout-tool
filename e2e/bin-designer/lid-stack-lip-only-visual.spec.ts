/**
 * Visual verification for the stacking-lip-only stack top (#2930).
 *
 * Drives the lid group end to end on a multi-unit bin: enable the lid, pick the
 * Stackable top surface (full grid of sockets), then switch to lip-only. The
 * interior grid ridges must disappear from the canvas while the lid keeps its
 * perimeter lip, and the hint must swap to describe the lip.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/lid-stack-lip-only-visual.spec.ts`
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

test.describe('Lid stacking-lip-only top (visual)', () => {
  test('dropping the interior grid changes the preview', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Widen to 3 units so the grid actually has interior ridges to remove.
    const width = page.getByRole('spinbutton', { name: 'Width' });
    await width.scrollIntoViewIfNeeded();
    await width.fill('3');
    await width.blur();
    await waitForGenerationComplete(page);

    const lidToggle = page.getByRole('switch', { name: 'Lid' });
    await lidToggle.scrollIntoViewIfNeeded();
    await lidToggle.click();
    await expect(lidToggle).toBeChecked();
    await waitForGenerationComplete(page);

    const topSurface = page.getByRole('radiogroup', { name: 'Top surface' });
    await topSurface.getByRole('radio', { name: 'Stackable' }).click();
    await expect(topSurface.getByRole('radio', { name: 'Stackable' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await waitForGenerationComplete(page);
    await expect(page.getByText(/full grid of sockets/i)).toBeVisible();
    const grid = await canvas.screenshot();

    // The design-system Switch is an sr-only input wrapped in a <label>, so
    // click the visible label text to toggle it.
    const lipOnly = page.getByRole('switch', { name: 'Stacking lip only' });
    await expect(lipOnly).toBeVisible();
    await page.getByText('Stacking lip only', { exact: true }).click();
    await expect(lipOnly).toBeChecked();
    await waitForGenerationComplete(page);
    const lip = await canvas.screenshot();

    expect(grid.equals(lip)).toBe(false);
    await expect(page.getByText(/One lip around the edge/i)).toBeVisible();

    await test.info().attach('lid-stack-lip-only.png', { body: lip, contentType: 'image/png' });
  });
});
