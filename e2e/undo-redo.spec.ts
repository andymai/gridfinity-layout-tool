import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  selectBinAt,
  getSidebar,
  selectBinSize,
  waitForBinCount,
  waitForToast,
  waitForUndoEnabled,
  waitForRedoEnabled,
  waitForRedoDisabled,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Undo/Redo Flow', () => {
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
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('undo button is disabled initially', async ({ page }) => {
    const undoButton = page.getByRole('button', { name: /undo/i });
    await expect(undoButton).toBeDisabled();
  });

  test('redo button is disabled initially', async ({ page }) => {
    const redoButton = page.getByRole('button', { name: /redo/i });
    await expect(redoButton).toBeDisabled();
  });

  test('can undo after adding a bin', async ({ page }) => {
    // Fill with 2x2 bins to create an action
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();

    // Wait for bins to be added
    await waitForToast(page, /added.*bins/i);

    // Verify bins were added
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBeGreaterThan(0);

    // Undo button should now be enabled
    await waitForUndoEnabled(page);

    // Click undo
    const undoButton = page.getByRole('button', { name: /undo/i });
    await undoButton.click();

    // Bins should be removed
    await waitForBinCount(page, 0);
  });

  test('can redo after undoing', async ({ page }) => {
    // Fill with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();
    await waitForToast(page, /added.*bins/i);

    // Undo
    const undoButton = page.getByRole('button', { name: /undo/i });
    await undoButton.click();
    await waitForBinCount(page, 0);

    // Redo should be enabled now
    await waitForRedoEnabled(page);

    // Click redo
    const redoButton = page.getByRole('button', { name: /redo/i });
    await redoButton.click();

    // Bins should be back
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBeGreaterThan(0);
  });

  test('can undo with Ctrl+Z keyboard shortcut', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Verify bin was created
    await waitForBinCount(page, 1);

    // Press Ctrl+Z
    await page.keyboard.press('Control+z');

    // Bin should be removed
    await waitForBinCount(page, 0);
  });

  test('can redo with Ctrl+Y keyboard shortcut', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Verify bin was created
    await waitForBinCount(page, 1);

    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await waitForBinCount(page, 0);

    // Redo with Ctrl+Y
    await page.keyboard.press('Control+y');

    // Bin should be back
    await waitForBinCount(page, 1);
  });

  test('undo works for bin deletion', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await waitForBinCount(page, 1);

    // Select and delete the bin
    await selectBinAt(page, 70, 70);
    await page.keyboard.press('Delete');

    // Bin should be deleted
    await waitForBinCount(page, 0);

    // Undo the deletion
    await page.keyboard.press('Control+z');

    // Bin should be back
    await waitForBinCount(page, 1);
  });

  test('undo works for bin movement', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Select and move the bin using arrow keys
    await selectBinAt(page, 70, 70);

    // Move right
    await page.keyboard.press('ArrowRight');
    await waitForUndoEnabled(page);

    // Undo the movement
    await page.keyboard.press('Control+z');

    // Verify undo worked by checking redo is enabled
    await waitForRedoEnabled(page);
  });

  test('redo is disabled after new action', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Undo
    await page.keyboard.press('Control+z');
    await waitForBinCount(page, 0);

    // Redo should be enabled
    await waitForRedoEnabled(page);

    // Draw another bin (new action)
    await drawBinOnGrid(page, 150, 50, 200, 100);

    // Redo should now be disabled (new action clears redo stack)
    await waitForRedoDisabled(page);
  });
});
