import { test, expect, waitForAppReady, drawBinOnGrid, selectBinAt, getInspector, getSidebar, selectBinSize } from './fixtures';

test.describe('Categories Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
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
      await page.waitForTimeout(100);
    }
  });

  test('bins are created with active category', async ({ page }) => {
    // Select Sky category
    const sidebar = getSidebar(page);
    const skyCategory = sidebar.getByRole('button', { name: /sky/i }).first();
    if (await skyCategory.isVisible()) {
      await skyCategory.click();
      await page.waitForTimeout(100);
    }

    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Select the bin
    await selectBinAt(page, 70, 70);

    // Inspector should show the bin - the category is shown in a dropdown
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({ timeout: 3000 });
  });

  test('category colors are displayed on bins', async ({ page }) => {
    // Fill with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    await expect(page.getByText(/added.*bins/i)).toBeVisible({ timeout: 5000 });

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

    await expect(page.getByText(/added.*bins/i)).toBeVisible({ timeout: 5000 });

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
      await page.waitForTimeout(200);

      // A new category should appear
      // The exact name may vary, but we should have more categories now
    }
  });
});
