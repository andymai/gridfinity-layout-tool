/**
 * Full-flow visual/UX check for "Extend into drawer margin" (#2462, Labs
 * `layout_overhang`): baseplate padding → draw an edge bin → create+link a
 * design → toggle extend → verify the bin extends into the margin in 2D and 3D.
 *
 * Not part of CI — a manual verification spec (WebGL). Run with:
 *   pnpm exec playwright test e2e/bin-designer/extend-to-margin.spec.ts --project=chromium
 */

import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

test.use({
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

async function goToTab(page: Page, name: 'Layout' | 'Bins' | 'Baseplate') {
  await page.locator('button', { hasText: name }).first().click();
}

test('extend into drawer margin renders in 2D and 3D', async ({ page }) => {
  test.setTimeout(240_000);

  // Enable the Labs flag before boot.
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem(
        'gridfinity-labs-v1',
        JSON.stringify({ enabledFeatures: { layout_overhang: true } })
      );
    } catch {
      // Ignore — the app falls back to the flag being off, which fails the test loudly.
    }
  });

  await page.goto('/');
  const grid = page.getByRole('application', { name: /drawer grid/i });
  await expect(grid).toBeVisible({ timeout: 30_000 });

  // 1. Draw a 1×1 bin in the bottom-left corner.
  const box = await grid.boundingBox();
  if (!box) throw new Error('no grid box');
  const cx = box.x + 22;
  const cy = box.y + box.height - 22;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 6, cy - 6);
  await page.mouse.up();

  // 2. Create + link a design from the bin (navigates to the designer).
  await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByRole('button', { name: /Create & Open Designer/i }).click();
  await expect(page).toHaveURL(/designer/, { timeout: 15_000 });
  // Let the designer create the design + link the bin.
  await page.waitForTimeout(2500);

  // 3. Add generous baseplate padding (typed mm) AFTER the designer round-trip
  //    so it isn't lost — big enough that the extension reads clearly.
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
  await page.mouse.click(cx + 3, cy - 3);
  const toggle = page.getByRole('checkbox', { name: /extend into drawer margin/i });
  await expect(toggle).toBeVisible({ timeout: 10_000 });
  await expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(800);

  // 5. Deselect so the extension shows without the selection ring, then screenshot 2D.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'e2e/.artifacts/extend-2d.png', fullPage: false });

  // 6. Open the 3D preview and screenshot.
  await page.locator('button', { hasText: '3D View' }).first().click();
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'e2e/.artifacts/extend-3d.png', fullPage: false });
});
