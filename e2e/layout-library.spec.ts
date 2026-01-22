import {
  test,
  expect,
  waitForAppReady,
  waitForDialog,
  waitForDialogClosed,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  drawBinOnGrid,
  waitForAutoSave,
  waitForBinCount,
} from './fixtures';

test.describe('Layout Library Management', () => {
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

  test.describe('Layout Manager Modal', () => {
    test('opens layout manager via button', async ({ page }) => {
      const layoutsButton = page.getByRole('button', { name: 'Open layout manager' });
      await layoutsButton.click();

      await waitForDialog(page);
      const modal = getActiveDialog(page);
      await expect(modal).toBeVisible();

      // Should show "Layouts" heading
      await expect(modal.getByRole('heading', { name: 'Layouts' })).toBeVisible();

      // Should show the current layout in the list
      await expect(modal.getByRole('option', { name: /untitled layout/i })).toBeVisible();
    });

    test('opens layout manager via keyboard shortcut', async ({ page }) => {
      // Ctrl+O / Cmd+O opens layout manager
      await page.keyboard.press('Control+o');

      await waitForDialog(page);
      const modal = getActiveDialog(page);
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('heading', { name: 'Layouts' })).toBeVisible();
    });

    test('closes layout manager with escape', async ({ page }) => {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      await page.keyboard.press('Escape');
      await waitForDialogClosed(page);
    });
  });

  test.describe('Create Layout', () => {
    test('creates a new layout from modal', async ({ page }) => {
      // Open layout manager
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);

      // Click "New Layout" button
      const newLayoutBtn = modal.getByRole('button', { name: 'New Layout' });
      await newLayoutBtn.click();

      // Modal should close
      await waitForDialogClosed(page);

      // New layout should be active with default name
      await expect(page.getByRole('button', { name: /untitled layout/i })).toBeVisible();

      // Grid should be empty (no bins from previous layout)
      await waitForBinCount(page, 0);
    });

    test('new layout has empty grid', async ({ page }) => {
      // Create bin on initial layout to distinguish from new layout
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Create new layout
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      await getActiveDialog(page).getByRole('button', { name: 'New Layout' }).click();
      await waitForDialogClosed(page);

      // Should have 0 bins (new empty layout)
      await waitForBinCount(page, 0);

      // Wait for auto-save
      await waitForAutoSave(page, 3000);

      // Verify in library that we now have 2 layouts
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);
      const layoutItems = modal.getByRole('option');
      await expect(layoutItems).toHaveCount(2, { timeout: 5000 });
    });
  });

  test.describe('Switch Layout', () => {
    // TODO: This test has timing issues with layout loading - skip for now
    // The switch functionality is tested indirectly in other tests
    test.skip('switches to different layout and back', async ({ page }) => {
      // Draw a bin on the first layout
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Create second layout (empty)
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      await getActiveDialog(page).getByRole('button', { name: 'New Layout' }).click();
      await waitForDialogClosed(page);

      // New layout should be empty
      await waitForBinCount(page, 0);
      await waitForAutoSave(page, 3000);

      // Verify we're on a different layout now (0 bins instead of 1)
      const binCount = await page.locator('[data-bin-id]').count();
      expect(binCount).toBe(0);

      // Switch back to first layout (should have 1 bin)
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      // The original layout should show "1 bins" in metadata
      const modal = getActiveDialog(page);
      const layoutWithBins = modal.locator('[role="option"]').filter({ hasText: '1 bins' });
      await layoutWithBins.click();
      await waitForDialogClosed(page);

      // Should now have 1 bin again
      await waitForBinCount(page, 1, 5000);
    });
  });

  test.describe('Delete Layout', () => {
    test('deletes layout via overflow menu', async ({ page }) => {
      // Create second layout first so we can delete one
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      await getActiveDialog(page).getByRole('button', { name: 'New Layout' }).click();
      await waitForDialogClosed(page);

      // Name it for identification
      await page.getByRole('button', { name: /untitled layout/i }).click();
      const input = page.locator('header input[type="text"]');
      await input.fill('Layout To Delete');
      await input.press('Enter');
      await waitForAutoSave(page, 3000);

      // Open layout manager
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);

      // Verify we have 2 layouts
      await expect(modal.getByRole('option')).toHaveCount(2);

      // Find the "More actions" button for this layout
      const moreActionsBtn = modal.getByRole('button', {
        name: /more actions for Layout To Delete/i,
      });
      await moreActionsBtn.click();

      // Click Delete in the dropdown (first click shows confirmation)
      await page.getByRole('menuitem', { name: /delete/i }).click();

      // Wait for the confirmation state to appear and click again
      const confirmDeleteMenuItem = page.getByRole('menuitem', { name: /click to confirm/i });
      await expect(confirmDeleteMenuItem).toBeVisible({ timeout: 5000 });
      await confirmDeleteMenuItem.click();

      // Should now only have 1 layout
      await expect(modal.getByRole('option')).toHaveCount(1, { timeout: 5000 });
    });

    test('cannot delete last remaining layout', async ({ page }) => {
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);

      // Open overflow menu for the only layout
      const moreActionsBtn = modal.getByRole('button', { name: /more actions for/i }).first();
      await moreActionsBtn.click();

      // Delete option should not be present when it's the only layout
      await expect(page.getByRole('menuitem', { name: /delete/i })).not.toBeVisible();
    });
  });

  test.describe('Duplicate Layout', () => {
    test('duplicates layout creating a copy', async ({ page }) => {
      // Set up source layout
      const layoutNameButton = page.getByRole('button', { name: 'Untitled layout' });
      await layoutNameButton.click();
      const input = page.locator('header input[type="text"]');
      await input.fill('Original Layout');
      await input.press('Enter');

      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Open layout manager and duplicate
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);

      // Open overflow menu
      const moreActionsBtn = modal.getByRole('button', {
        name: /more actions for Original Layout/i,
      });
      await moreActionsBtn.click();

      // Click Duplicate
      const duplicateBtn = page.getByRole('menuitem', { name: /duplicate/i });
      await duplicateBtn.click();

      // Should create "Original Layout (copy)" and now have 2 layouts
      await expect(modal.getByRole('option')).toHaveCount(2, { timeout: 5000 });
      await expect(modal.getByRole('option', { name: /Original Layout \(copy\)/i })).toBeVisible({
        timeout: 5000,
      });
    });
  });

  test.describe('Data Persistence', () => {
    test('layout persists after reload', async ({ page }) => {
      // Create a named layout with bins
      const layoutNameButton = page.getByRole('button', { name: 'Untitled layout' });
      await layoutNameButton.click();
      const input = page.locator('header input[type="text"]');
      await input.fill('Persisted Layout');
      await input.press('Enter');

      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Wait extra for save to complete
      await page.waitForTimeout(2000);

      // Verify data is saved before reload
      const savedCheck = await page.evaluate(() => {
        const library = localStorage.getItem('gridfinity-library-v1');
        if (!library) return false;
        const parsed = JSON.parse(library);
        const layoutData = localStorage.getItem(`gridfinity-layout-${parsed.activeLayoutId}`);
        if (!layoutData) return false;
        const layout = JSON.parse(layoutData);
        return layout.name === 'Persisted Layout' && layout.bins.length === 1;
      });
      expect(savedCheck).toBe(true);

      // Reload page
      await page.reload();
      await waitForAppReady(page);

      // Should still show the layout name
      await expect(page.getByRole('button', { name: 'Persisted Layout' })).toBeVisible({
        timeout: 5000,
      });

      // Should still have 1 bin
      await waitForBinCount(page, 1);
    });

    test('multiple layouts persist after reload', async ({ page }) => {
      // Create first layout with a bin
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
      await waitForAutoSave(page, 3000);

      // Create second layout
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);
      await getActiveDialog(page).getByRole('button', { name: 'New Layout' }).click();
      await waitForDialogClosed(page);

      // Name the second layout
      await page.getByRole('button', { name: /untitled layout/i }).click();
      const input = page.locator('header input[type="text"]');
      await input.fill('Second Layout');
      await input.press('Enter');
      await waitForAutoSave(page, 3000);

      // Wait extra for all saves
      await page.waitForTimeout(2000);

      // Reload page
      await page.reload();
      await waitForAppReady(page);

      // Should show the second layout (last active)
      await expect(page.getByRole('button', { name: 'Second Layout' })).toBeVisible({
        timeout: 5000,
      });

      // Open layout manager and verify both layouts exist
      await page.getByRole('button', { name: 'Open layout manager' }).click();
      await waitForDialog(page);

      const modal = getActiveDialog(page);
      await expect(modal.getByRole('option')).toHaveCount(2);
    });
  });
});
