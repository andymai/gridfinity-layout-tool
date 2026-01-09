import { test, expect, waitForAppReady, drawBinOnGrid, selectBinAt, getSidebar, selectBinSize } from './fixtures';

test.describe('Undo/Redo Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
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
    await expect(page.getByText(/added.*bins/i)).toBeVisible({ timeout: 5000 });

    // Verify bins were added
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBeGreaterThan(0);

    // Undo button should now be enabled
    const undoButton = page.getByRole('button', { name: /undo/i });
    await expect(undoButton).toBeEnabled();

    // Click undo
    await undoButton.click();
    await page.waitForTimeout(200);

    // Bins should be removed
    const binCountAfter = await page.locator('[data-bin-id]').count();
    expect(binCountAfter).toBe(0);
  });

  test('can redo after undoing', async ({ page }) => {
    // Fill with bins
    await selectBinSize(page, 2, 2);
    const sidebar = getSidebar(page);
    const fillButton = sidebar.getByRole('button', { name: /fill.*2.*2/i });
    await fillButton.click();
    await expect(page.getByText(/added.*bins/i)).toBeVisible({ timeout: 5000 });

    // Undo
    const undoButton = page.getByRole('button', { name: /undo/i });
    await undoButton.click();
    await page.waitForTimeout(200);

    // Redo should be enabled now
    const redoButton = page.getByRole('button', { name: /redo/i });
    await expect(redoButton).toBeEnabled();

    // Click redo
    await redoButton.click();
    await page.waitForTimeout(200);

    // Bins should be back
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBeGreaterThan(0);
  });

  test('can undo with Ctrl+Z keyboard shortcut', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Verify bin was created
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBe(1);

    // Press Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Bin should be removed
    const binCountAfter = await page.locator('[data-bin-id]').count();
    expect(binCountAfter).toBe(0);
  });

  test('can redo with Ctrl+Y keyboard shortcut', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Verify bin was created
    expect(await page.locator('[data-bin-id]').count()).toBe(1);

    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    expect(await page.locator('[data-bin-id]').count()).toBe(0);

    // Redo with Ctrl+Y
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    // Bin should be back
    expect(await page.locator('[data-bin-id]').count()).toBe(1);
  });

  test('undo works for bin deletion', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    expect(await page.locator('[data-bin-id]').count()).toBe(1);

    // Select and delete the bin
    await selectBinAt(page, 70, 70);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // Bin should be deleted
    expect(await page.locator('[data-bin-id]').count()).toBe(0);

    // Undo the deletion
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Bin should be back
    expect(await page.locator('[data-bin-id]').count()).toBe(1);
  });

  test('undo works for bin movement', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Select and move the bin using arrow keys
    await selectBinAt(page, 70, 70);

    // Move right
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);

    // Undo the movement
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Verify undo worked by checking redo is enabled
    const redoButton = page.getByRole('button', { name: /redo/i });
    await expect(redoButton).toBeEnabled();
  });

  test('redo is disabled after new action', async ({ page }) => {
    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Redo should be enabled
    const redoButton = page.getByRole('button', { name: /redo/i });
    await expect(redoButton).toBeEnabled();

    // Draw another bin (new action)
    await drawBinOnGrid(page, 150, 50, 200, 100);

    // Redo should now be disabled (new action clears redo stack)
    await expect(redoButton).toBeDisabled();
  });
});
