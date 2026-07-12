/**
 * Full-flow verification for Custom Drawer Shapes (issue #2528): author a
 * non-rectangular drawer from either surface (paint a notch, or trace the bin
 * layout) → the layout renders the shape → the baseplate follows it exactly.
 *
 * Not part of CI — a manual verification spec (WebGL). Run with:
 *   pnpm exec playwright test e2e/drawer-shape.spec.ts --project=chromium
 */

import {
  test,
  expect,
  drawBinOnGrid,
  getActiveDialog,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.use({
  viewport: { width: 1440, height: 900 },
  launchOptions: {
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  },
});

test.describe('Custom Drawer Shapes (#2528)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('application', { name: /drawer grid/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test.afterEach(async ({ page }) => {
    // The applied outline autosaves — clear it so it can't bleed into the next test.
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('paint a corner notch → baseplate follows the shape', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    // Open the shape editor from the sidebar (FeatureToggle renders role="switch").
    const toggle = page.getByRole('switch', { name: /custom drawer shape/i });
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    await toggle.click();

    const dialog = getActiveDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('grid', { name: /drawer shape cells/i })).toBeVisible();

    // The editor seeds as the full rectangle — every cell filled. Cell index 0 is
    // the front-left corner (index = row * cols + col). Removing one corner leaves
    // a connected, non-rectangular shape (a notch), so Apply stays valid.
    const corner = dialog.locator('[data-cell-index="0"]');
    await expect(corner).toHaveAttribute('aria-selected', 'true');
    await corner.click();
    await expect(corner).toHaveAttribute('aria-selected', 'false');

    await dialog.getByRole('button', { name: /apply shape/i }).click();
    await expect(dialog).toBeHidden();

    // The layout now strokes the shape boundary — this overlay renders only when
    // an outline exists, so its presence proves the outline reached the store.
    await expect(page.getByRole('img', { name: /drawer shape boundary/i })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('drawer-shape-notch-2d.png') });

    // Switch to the Baseplate tool via the ToolSwitcher — client-side nav
    // (history.pushState), so the in-memory outline survives. A full page reload
    // would not: useAutoSave persists a layout only once it is registered in the
    // library (has an activeLayoutId), which this test's pristine default layout
    // never triggers, so a reload would start from a blank rectangular drawer.
    // The baseplate consumes the same outline: its padding controls give way to
    // the shaped-drawer notice (plain React — a non-WebGL signal the baseplate is
    // driven by the shape, not the bounding box).
    await page.getByRole('tab', { name: 'Baseplate', exact: true }).click();
    await expect(page.getByText(/this drawer has a custom shape/i)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('spinbutton', { name: 'Left', exact: true })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('drawer-shape-baseplate.png') });
  });

  test('trace bin layout derives the drawer shape', async ({ page }, testInfo) => {
    test.setTimeout(120_000);

    // Draw a bin near the front-left corner so "Trace bin layout" has a footprint
    // to derive the shape from — the exact flow requested in #2528.
    const grid = page.getByRole('application', { name: /drawer grid/i });
    const box = await grid.boundingBox();
    if (!box) throw new Error('no grid box');
    await drawBinOnGrid(page, 24, box.height - 24, 70, box.height - 70);

    const toggle = page.getByRole('switch', { name: /custom drawer shape/i });
    await toggle.click();

    const dialog = getActiveDialog(page);
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /trace bin layout/i }).click();

    // Tracing seeds a valid, connected shape from the bin footprint, so Apply is
    // enabled (it disables only on an empty or disconnected shape).
    const apply = dialog.getByRole('button', { name: /apply shape/i });
    await expect(apply).toBeEnabled();
    await apply.click();
    await expect(dialog).toBeHidden();

    await expect(page.getByRole('img', { name: /drawer shape boundary/i })).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('drawer-shape-traced-2d.png') });
  });
});
