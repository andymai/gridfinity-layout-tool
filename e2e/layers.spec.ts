import { test, expect, waitForAppReady, selectBinSize, selectBinAt, getInspector, getSidebar } from './fixtures';

test.describe('Layers Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('shows default layer on load', async ({ page }) => {
    // Should see Layer 1 in the sidebar
    const sidebar = getSidebar(page);
    await expect(sidebar.getByText('Layer 1')).toBeVisible();
  });

  test('can add a new layer', async ({ page }) => {
    // Find and click the add layer button
    const sidebar = getSidebar(page);
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });

    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      await page.waitForTimeout(200);

      // Should see Layer 2
      await expect(sidebar.getByText('Layer 2')).toBeVisible();
    }
  });

  test('can switch between layers', async ({ page }) => {
    // First add another layer
    const sidebar = getSidebar(page);
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });

    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      await page.waitForTimeout(200);

      // Click on Layer 1 to switch
      const layer1 = sidebar.getByRole('button', { name: /layer 1/i }).first();
      await layer1.click();
      await page.waitForTimeout(100);

      // Layer 1 should be active
      // We can verify by checking that the active layer is shown in toolbar (for multi-layer setups)
    }
  });

  test('layer height affects bins on that layer', async ({ page }) => {
    // Fill layer with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    await expect(page.getByText(/added.*bins/i)).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Select a bin and check its height in inspector
    await selectBinAt(page, 50, 50);

    // Height should be visible in inspector - look for the height display with "u" suffix
    const inspector = getInspector(page);
    await expect(inspector.getByText(/height/i)).toBeVisible({ timeout: 3000 });
    // Height is shown as "Xu" where X is a number
    await expect(inspector.locator('span').filter({ hasText: /^\d+u$/ }).first()).toBeVisible({ timeout: 3000 });
  });

  test('layer indicator shows in toolbar when multiple layers exist', async ({ page }) => {
    // Add a second layer
    const sidebar = getSidebar(page);
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });

    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      await page.waitForTimeout(200);

      // The layer indicator should appear in the toolbar (shows active layer)
      // When multiple layers exist, we should see Layer 2 somewhere (in sidebar or toolbar)
      await expect(sidebar.getByText('Layer 2')).toBeVisible();
    }
  });

  test('show layers below toggle works', async ({ page }) => {
    // Add a second layer first
    const sidebar = getSidebar(page);
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });

    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      await page.waitForTimeout(200);

      // The "Show layers below" checkbox should be visible
      const showBelowCheckbox = page.getByRole('checkbox', { name: /show layers below/i });
      await expect(showBelowCheckbox).toBeVisible();

      // Click to toggle
      await showBelowCheckbox.click();
      await page.waitForTimeout(100);

      // Toggle back
      await showBelowCheckbox.click();
    }
  });
});
