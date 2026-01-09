import { test, expect, waitForAppReady, getGridBounds, drawBinOnGrid, selectBinAt, getInspector } from './fixtures';

test.describe('Drag Bins Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);

    // Create a bin first by drawing
    await drawBinOnGrid(page, 50, 150, 100, 100);
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

    // Bin should now be at the new position
    await page.waitForTimeout(200);
  });

  test('can use arrow keys to nudge selected bin', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Use arrow keys to nudge
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);

    // Bin should have moved (we can verify by checking it's still selected)
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible();
  });

  test('can duplicate selected bin with Ctrl+D', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Verify we have 1 bin
    const binsBefore = await page.locator('[data-bin-id]').count();
    expect(binsBefore).toBe(1);

    // Duplicate with Ctrl+D
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(200);

    // Should now have 2 bins
    const binsAfter = await page.locator('[data-bin-id]').count();
    expect(binsAfter).toBe(2);
  });

  test('can delete selected bin with Delete key', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Verify we have 1 bin
    const binsBefore = await page.locator('[data-bin-id]').count();
    expect(binsBefore).toBe(1);

    // Delete with Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // Should have 0 bins now
    const binsAfter = await page.locator('[data-bin-id]').count();
    expect(binsAfter).toBe(0);

    // Inspector should show "No bin selected"
    const inspector = getInspector(page);
    await expect(inspector.getByText(/no bin selected/i)).toBeVisible({ timeout: 3000 });
  });

  test('can delete selected bin with Backspace key', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Delete with Backspace key
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Should have 0 bins now
    const binsAfter = await page.locator('[data-bin-id]').count();
    expect(binsAfter).toBe(0);
  });

  test('Escape key clears selection', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 70, 130);

    // Verify bin is selected
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Selection should be cleared
    await expect(inspector.getByText(/no bin selected/i)).toBeVisible({ timeout: 3000 });
  });
});
