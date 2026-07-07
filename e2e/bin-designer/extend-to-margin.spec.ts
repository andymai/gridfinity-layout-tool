/**
 * Full-flow visual/UX check for "Extend into drawer margin" (#2462): draw an
 * edge bin → create + link a design → add baseplate padding → toggle extend →
 * verify the bin extends into the margin in 2D and 3D.
 *
 * Not part of CI — a manual verification spec (WebGL). Run with:
 *   pnpm exec playwright test e2e/bin-designer/extend-to-margin.spec.ts --project=chromium
 */

import type { Page } from '@playwright/test';
import { test, expect, drawBinOnGrid } from '../fixtures';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

async function goToTab(page: Page, name: 'Layout' | 'Bins' | 'Baseplate') {
  await page.locator('button', { hasText: name }).first().click();
}

test('extend into drawer margin renders in 2D and 3D', async ({ page }, testInfo) => {
  test.setTimeout(240_000);

  // The feature is graduated (always on) — no flag setup needed.
  await page.goto('/');
  const grid = page.getByRole('application', { name: /drawer grid/i });
  await expect(grid).toBeVisible({ timeout: 30_000 });

  // 1. Draw a 1×1 bin in the bottom-left corner (grid-relative coords).
  const box = await grid.boundingBox();
  if (!box) throw new Error('no grid box');
  const bin = await drawBinOnGrid(page, 22, box.height - 22, 30, box.height - 30);

  // 2. Create + link a design from the bin (navigates to the designer). Wait for
  //    the success toast so the bin is actually linked before continuing.
  await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: /Create & Open Designer/i }).click();
  await expect(page).toHaveURL(/designer/, { timeout: 15_000 });
  await expect(page.getByText(/created and linked/i)).toBeVisible({ timeout: 20_000 });

  // 3. Add generous baseplate padding (typed mm) so the extension reads clearly.
  await goToTab(page, 'Baseplate');
  const leftInput = page.getByRole('spinbutton', { name: 'Left' }).first();
  const frontInput = page.getByRole('spinbutton', { name: 'Front' }).first();
  await expect(leftInput).toBeVisible({ timeout: 15_000 });
  await leftInput.fill('32');
  await leftInput.press('Enter');
  await frontInput.fill('32');
  await frontInput.press('Enter');

  // 4. Back to the layout — the bin is now linked, so the toggle is enabled.
  await goToTab(page, 'Layout');
  await expect(grid).toBeVisible();

  // The drawer-margin band renders once padding reached layout.baseplateParams.
  await expect(page.locator('[aria-label*="Drawer-fit margin"]')).toHaveCount(1);

  // Select the corner bin and enable "Extend into drawer margin".
  await bin.click();
  const toggle = page.getByRole('checkbox', { name: /extend into drawer margin/i });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  // 5. Deselect (band + extension stay) and screenshot 2D.
  await page.keyboard.press('Escape');
  await expect(toggle).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('extend-2d.png'), fullPage: false });

  // 6. Open the 3D preview and screenshot (brief settle for the first WebGL frame).
  await page.locator('button', { hasText: '3D View' }).first().click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('extend-3d.png'), fullPage: false });
});
