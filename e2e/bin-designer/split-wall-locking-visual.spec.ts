/**
 * One-shot visual verification for #1869 (wall connectors).
 *
 * Drives the designer to an oversized (splitting) bin, then toggles the
 * "Wall connectors" option and captures before/after screenshots of the
 * 3D split preview. A pixel diff confirms the wall keys are actually
 * generated and rendered — closing the loop from store → worker → canvas.
 *
 * Run with: `pnpm test:e2e e2e/bin-designer/split-wall-locking-visual.spec.ts`
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

test.describe('Split wall connectors — visual', () => {
  test('enabling wall connectors visibly changes the split preview', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/designer');

    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 120_000 });
    await waitForGenerationComplete(page);

    // Oversize the bin so it must split into pieces (default print bed ≈ 256mm).
    await page.getByRole('spinbutton', { name: 'Width' }).fill('8');
    await page.getByRole('spinbutton', { name: 'Width' }).blur();

    // The split options panel only renders once the bin needs splitting.
    const wallLockSwitch = page.getByRole('switch', { name: /wall connectors/i });
    await expect(wallLockSwitch).toBeVisible({ timeout: 15_000 });
    await wallLockSwitch.scrollIntoViewIfNeeded();
    await waitForGenerationComplete(page);

    const before = await canvas.screenshot({ path: '/tmp/wall-locking-before.png' });

    await wallLockSwitch.click();
    await waitForGenerationComplete(page);
    const after = await canvas.screenshot({ path: '/tmp/wall-locking-after.png' });

    expect(Buffer.compare(before, after)).not.toBe(0);
  });
});
