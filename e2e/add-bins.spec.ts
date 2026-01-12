import {
  test,
  expect,
  waitForAppReady,
  getGridBounds,
  drawBinOnGrid,
  selectBinAt,
  getInspector,
  selectBinSize,
  getSidebar,
  waitForBinCount,
  waitForToast,
  waitForPaintModeExited,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Add Bins Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('can add a bin by clicking on the grid', async ({ page }) => {
    // The grid should be visible
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();

    // Click on the grid to add a bin
    const bounds = await getGridBounds(page);
    await page.mouse.click(bounds.x + 50, bounds.y + 50);

    // Wait for bin to appear
    await waitForBinCount(page, 1);
  });

  test('can select a bin size from palette', async ({ page }) => {
    // Find the bin palette section
    await expect(page.getByRole('heading', { name: 'Bin Palette' })).toBeVisible();

    // Click on a 2x2 square size button
    await selectBinSize(page, 2, 2);

    // The paint mode indicator should be visible in toolbar
    await expect(page.getByText(/paint.*2×2/i)).toBeVisible();
  });

  test('can fill layer with uniform bins', async ({ page }) => {
    // Select a size first
    await selectBinSize(page, 2, 2);

    // Now click the "Fill with X×Y" button - look in the sidebar
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await expect(fillButton).toBeVisible();
    await fillButton.click();

    // Should see a toast notification about bins added
    await waitForToast(page, /added.*bins/i);
  });

  test('shows bin inspector when bin is selected', async ({ page }) => {
    // Fill the layer with 2x2 bins to have something to select
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    // Wait for bins to be added
    await waitForToast(page, /added.*bins/i);

    // Exit paint mode with Escape
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Click on the grid where a bin should be
    await selectBinAt(page, 50, 50);

    // The inspector should show bin details
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({ timeout: 3000 });
  });

  test('can draw a bin by dragging on grid', async ({ page }) => {
    // Make sure we're not in paint mode
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw a bin
    const bin = await drawBinOnGrid(page, 20, 20, 100, 100);

    // Should see a bin created - the inspector should show selection
    const inspector = getInspector(page);
    // Look for size notation like "3×3 Bin" in the inspector header
    await expect(inspector.getByRole('heading', { name: /\d×\d Bin/i })).toBeVisible({ timeout: 3000 });

    // Verify the bin is selected
    await waitForBinSelected(bin);
  });

  test('bin list shows placed bins', async ({ page }) => {
    // Fill layer with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    // Wait for bins to be added
    await waitForToast(page, /added.*bins/i);

    // Check the bin list section in the right panel
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: 'Bin List' })).toBeVisible();

    // Should show the bin size in the list
    await expect(inspector.getByText('2×2')).toBeVisible();
  });

  test('paint mode shows indicator in toolbar', async ({ page }) => {
    // Select a bin size
    await selectBinSize(page, 3, 3);

    // Paint mode indicator should be visible
    await expect(page.getByText(/paint.*3×3/i)).toBeVisible();

    // Press Escape to exit paint mode
    await page.keyboard.press('Escape');

    // Paint mode indicator should be hidden
    await waitForPaintModeExited(page);
  });
});
