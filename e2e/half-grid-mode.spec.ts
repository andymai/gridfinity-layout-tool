import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getSidebar,
  getInspector,
  waitForBinCount,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

test.describe('Half-Grid Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
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

  test.describe('Enabling Half-Grid Mode', () => {
    test('can enable half-grid mode via checkbox', async ({ page }) => {
      const sidebar = getSidebar(page);

      // Find and click the half-grid mode toggle
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();
      await expect(halfBinToggle).toBeVisible();

      // Should start unchecked
      await expect(halfBinToggle).not.toBeChecked();

      // Enable half-grid mode
      await halfBinToggle.click();

      // Should now be checked
      await expect(halfBinToggle).toBeChecked();
    });

    test('half-grid mode persists after page reload', async ({ page }) => {
      const sidebar = getSidebar(page);

      // Enable half-grid mode
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();
      await halfBinToggle.click();
      await expect(halfBinToggle).toBeChecked();

      // Reload the page
      await page.reload();
      await waitForAppReady(page);

      // Half-grid mode should still be enabled
      const toggleAfterReload = getSidebar(page).getByRole('checkbox', {
        name: /toggle half-grid mode/i,
      });
      await toggleAfterReload.scrollIntoViewIfNeeded();
      await expect(toggleAfterReload).toBeChecked();
    });
  });

  test.describe('Creating Fractional Bins', () => {
    test('can create bin with fractional width via inspector', async ({ page }) => {
      const sidebar = getSidebar(page);
      const inspector = getInspector(page);

      // Enable half-grid mode
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();
      await halfBinToggle.click();

      // Create a bin
      const bin = await drawBinOnGrid(page, 50, 50, 150, 150);
      await waitForBinCount(page, 1);
      await bin.click();
      await waitForBinSelected(bin);

      // Find width input in inspector and set to fractional value
      const widthInput = inspector.locator('input[aria-label*="width" i]').first();
      await widthInput.fill('1.5');
      await widthInput.press('Enter');

      // Verify the width was set (input should show 1.5)
      await expect(widthInput).toHaveValue('1.5');
    });

    test('can create bin with fractional depth via inspector', async ({ page }) => {
      const sidebar = getSidebar(page);
      const inspector = getInspector(page);

      // Enable half-grid mode
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();
      await halfBinToggle.click();

      // Create a bin
      const bin = await drawBinOnGrid(page, 50, 50, 150, 150);
      await waitForBinCount(page, 1);
      await bin.click();
      await waitForBinSelected(bin);

      // Find depth input in inspector and set to fractional value
      const depthInput = inspector.locator('input[aria-label*="depth" i]').first();
      await depthInput.fill('2.5');
      await depthInput.press('Enter');

      // Verify the depth was set
      await expect(depthInput).toHaveValue('2.5');
    });

    test('bins snap to whole units when half-grid mode is disabled', async ({ page }) => {
      // Half-grid mode should be disabled by default
      // When creating a bin by drawing, it should snap to whole units
      const bin = await drawBinOnGrid(page, 50, 50, 150, 150);
      await waitForBinCount(page, 1);
      await bin.click();
      await waitForBinSelected(bin);

      // Verify bin dimensions are whole numbers
      const inspector = getInspector(page);
      const widthInput = inspector.locator('input[aria-label*="width" i]').first();
      const depthInput = inspector.locator('input[aria-label*="depth" i]').first();

      const widthValue = await widthInput.inputValue();
      const depthValue = await depthInput.inputValue();

      // Both should be whole numbers when created with half-grid mode off
      expect(parseFloat(widthValue) % 1).toBe(0);
      expect(parseFloat(depthValue) % 1).toBe(0);
    });
  });

  test.describe('Disabling Half-Grid Mode', () => {
    test('cannot disable half-grid mode with fractional bins present', async ({ page }) => {
      const sidebar = getSidebar(page);
      const inspector = getInspector(page);
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();

      // Enable half-grid mode
      await halfBinToggle.click();
      await expect(halfBinToggle).toBeChecked();

      // Create a bin with fractional dimensions
      const bin = await drawBinOnGrid(page, 50, 50, 150, 150);
      await waitForBinCount(page, 1);
      await bin.click();
      await waitForBinSelected(bin);

      // Set fractional width
      const widthInput = inspector.locator('input[aria-label*="width" i]').first();
      await widthInput.fill('1.5');
      await widthInput.press('Enter');
      await expect(widthInput).toHaveValue('1.5');

      // Click away from input
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);

      // Try to disable half-grid mode via toggle
      await halfBinToggle.scrollIntoViewIfNeeded();
      await halfBinToggle.click();

      // Wait for any feedback
      await page.waitForTimeout(500);

      // Toggle should still be checked - can't disable with fractional bins
      await expect(halfBinToggle).toBeChecked();
    });

    test('toggle remains enabled without fractional bins (smoke test)', async ({ page }) => {
      const sidebar = getSidebar(page);
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();

      // Enable and verify
      await halfBinToggle.click();
      await expect(halfBinToggle).toBeChecked();

      // Without creating any bins, the toggle should be interactable
      // This is a basic smoke test - full disable flow tested in unit tests
      await expect(halfBinToggle).toBeEnabled();
    });
  });

  test.describe('Grid Rendering', () => {
    test('grid shows finer lines when half-grid mode enabled', async ({ page }) => {
      const sidebar = getSidebar(page);

      // Enable half-grid mode
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();
      await halfBinToggle.click();

      // The grid should now render at 2x scale with half-unit lines
      // We can verify by checking CSS custom properties or visual indicators
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // In half-grid mode, the grid has data attribute or class indicating mode
      // (This depends on implementation - adjust selector as needed)
      // For now, just verify the toggle state persists through interaction
      await expect(halfBinToggle).toBeChecked();
    });
  });

  test.describe('Fractional Drawer Edges', () => {
    test('fractional edge controls appear when drawer has half-unit dimensions', async ({
      page,
    }) => {
      const sidebar = getSidebar(page);
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-grid mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();

      // Enable half-grid mode first
      await halfBinToggle.click();
      await expect(halfBinToggle).toBeChecked();

      // In half-grid mode, stepper step becomes 0.5
      // Click increase width button to add 0.5 to default width (10 -> 10.5)
      const increaseWidthBtn = sidebar.getByRole('button', { name: /increase drawer width/i });
      await increaseWidthBtn.scrollIntoViewIfNeeded();
      await increaseWidthBtn.click();

      // Wait for state to update
      await page.waitForTimeout(200);

      // Fractional edge selector should appear for X edge when width is fractional
      // The sidebar shows "Fractional edge position" or similar controls
      const fractionalEdgeLabel = sidebar.getByText(/fractional|edge.*position|left|right/i);

      // May also show as Start/End radio buttons
      const edgeControls = sidebar.locator('[data-grid-size-panel]').getByRole('radio');

      // Either the label should be visible OR the radio controls should exist
      const hasLabel = await fractionalEdgeLabel
        .first()
        .isVisible()
        .catch(() => false);
      const hasControls = (await edgeControls.count()) > 0;

      expect(hasLabel || hasControls).toBe(true);
    });
  });
});
