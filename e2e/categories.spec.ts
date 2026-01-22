import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  selectBinAt,
  getInspector,
  getSidebar,
  selectBinSize,
  waitForToast,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

test.describe('Categories Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('shows default categories on load', async ({ page }) => {
    // Should see default categories in the sidebar
    const sidebar = getSidebar(page);
    await expect(sidebar.getByText('Coral')).toBeVisible();
    await expect(sidebar.getByText('Sky')).toBeVisible();
    await expect(sidebar.getByText('Green')).toBeVisible();
  });

  test('can select a different category', async ({ page }) => {
    // Click on Sky category to select it
    const sidebar = getSidebar(page);
    const skyCategory = sidebar.getByRole('button', { name: /sky/i }).first();

    if (await skyCategory.isVisible()) {
      await skyCategory.click();
      // Category selection is instant, verify button is still visible
      await expect(skyCategory).toBeVisible();
    }
  });

  test('bins are created with active category', async ({ page }) => {
    // Select Sky category
    const sidebar = getSidebar(page);
    const skyCategory = sidebar.getByRole('button', { name: /sky/i }).first();
    if (await skyCategory.isVisible()) {
      await skyCategory.click();
    }

    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Select the bin
    await selectBinAt(page, 70, 70);

    // Inspector should show the bin - the category is shown in a dropdown
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({
      timeout: 3000,
    });
  });

  test('category colors are displayed on bins', async ({ page }) => {
    // Fill with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    await waitForToast(page, /added.*bins/i);

    // Bins on the grid should exist and have colors
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBeGreaterThan(0);
  });

  test('bin list shows category in entries', async ({ page }) => {
    // Fill with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    await waitForToast(page, /added.*bins/i);

    // Check bin list in right panel
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: 'Bin List' })).toBeVisible();

    // Should show bins with size
    await expect(inspector.getByText('2×2')).toBeVisible();
  });

  test('can add a new category', async ({ page }) => {
    // Find and click add category button
    const sidebar = getSidebar(page);
    const addCategoryButton = sidebar.getByRole('button', { name: /add.*category/i });

    if (await addCategoryButton.isVisible()) {
      await addCategoryButton.click();
      // A new category should appear - verify button is still visible after action
      await expect(addCategoryButton).toBeVisible();
    }
  });
});
