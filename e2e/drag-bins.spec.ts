import {
  test,
  expect,
  waitForAppReady,
  getGridBounds,
  drawBinOnGrid,
  selectBinAt,
  getInspector,
  waitForBinCount,
  waitForNoSelection,
  waitForUndoEnabled,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Drag Bins Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);

    // Create a bin first by drawing
    await drawBinOnGrid(page, 50, 150, 100, 100);
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

  test('can drag a bin to a new position', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Select the bin we created
    await selectBinAt(page, 70, 130);

    // Drag the bin to a new position
    await page.mouse.move(bounds.x + 70, bounds.y + 130);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 50, { steps: 10 });
    await page.mouse.up();

    // Verify the operation created an undoable action
    await waitForUndoEnabled(page);
  });

  test('can use arrow keys to nudge selected bin', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Use arrow keys to nudge
    await page.keyboard.press('ArrowRight');
    await waitForUndoEnabled(page);

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowUp');

    // Bin should have moved (we can verify by checking it's still selected)
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible();
  });

  test('can duplicate selected bin with Ctrl+D', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Verify we have 1 bin
    await waitForBinCount(page, 1);

    // Duplicate with Ctrl+D
    await page.keyboard.press('Control+d');

    // Should now have 2 bins
    await waitForBinCount(page, 2);
  });

  test('can delete selected bin with Delete key', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Verify we have 1 bin
    await waitForBinCount(page, 1);

    // Delete with Delete key
    await page.keyboard.press('Delete');

    // Should have 0 bins now
    await waitForBinCount(page, 0);

    // Inspector should show "No bin selected"
    const inspector = getInspector(page);
    await expect(inspector.getByText(/no bin selected/i)).toBeVisible({ timeout: 3000 });
  });

  test('can delete selected bin with Backspace key', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Delete with Backspace key
    await page.keyboard.press('Backspace');

    // Should have 0 bins now
    await waitForBinCount(page, 0);
  });

  test('Escape key clears selection', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Verify bin is selected
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Wait for selection to be cleared
    await waitForNoSelection(page);

    // Inspector should show "No bin selected"
    await expect(inspector.getByText(/no bin selected/i)).toBeVisible({ timeout: 3000 });
  });
});
