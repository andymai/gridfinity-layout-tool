import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function startBuild(page: Page): Promise<void> {
  await page.goto('/designer');
  await page.getByRole('button', { name: 'Open design list' }).first().click();
  await page.getByRole('button', { name: /New Workshop build/ }).click();
  await expect(page.getByRole('button', { name: 'Post', exact: true })).toBeVisible({
    timeout: 60_000,
  });
}

async function clickBaseCentre(page: Page): Promise<void> {
  const box = await page.locator('canvas').first().boundingBox();
  if (box === null) throw new Error('Workshop canvas has no bounding box');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
}

test.describe('Workshop', () => {
  test('places a part on the base and exports an STL', async ({ page }) => {
    test.setTimeout(180_000);
    await startBuild(page);
    await expect(page.getByText(/No parts yet/)).toBeVisible();

    await page.getByRole('button', { name: 'Post', exact: true }).click();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    await clickBaseCentre(page);
    await expect(page.getByText(/No parts yet/)).toHaveCount(0, { timeout: 15_000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 120_000 });
    await page.getByRole('button', { name: 'STL', exact: true }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(fs.statSync(path).size).toBeGreaterThan(1000);
  });
});
