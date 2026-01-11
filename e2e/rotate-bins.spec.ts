import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getInspector,
  waitForPaintModeExited,
  waitForBinSelected,
  waitForToast,
  waitForUndoEnabled,
} from './fixtures';

test.describe('Rotate Bins', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('can rotate a bin using R key', async ({ page }) => {
    // Draw a 2x4 rectangular bin (non-square so rotation is visible)
    const bin = await drawBinOnGrid(page, 50, 50, 130, 210);
    await waitForBinSelected(bin);

    // Get the inspector to verify dimensions before rotation
    const inspector = getInspector(page);

    // Verify initial dimensions - header shows "WxD Bin"
    await expect(inspector.getByText(/2×4 Bin/i)).toBeVisible();

    // Press R to rotate
    await page.keyboard.press('r');

    // Verify dimensions swapped - should now be 4x2
    await expect(inspector.getByText(/4×2 Bin/i)).toBeVisible();
  });

  test('can rotate using the rotate button in inspector', async ({ page }) => {
    // Draw a rectangular bin
    const bin = await drawBinOnGrid(page, 50, 50, 130, 210);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await expect(inspector.getByText(/2×4 Bin/i)).toBeVisible();

    // Click the rotate button
    const rotateButton = inspector.getByRole('button', { name: /rotate/i });
    await rotateButton.click();

    // Verify dimensions swapped
    await expect(inspector.getByText(/4×2 Bin/i)).toBeVisible();
  });

  test('rotation can be undone', async ({ page }) => {
    // Draw a bin and select it
    const bin = await drawBinOnGrid(page, 50, 50, 130, 210);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await expect(inspector.getByText(/2×4 Bin/i)).toBeVisible();

    // Rotate
    await page.keyboard.press('r');
    await expect(inspector.getByText(/4×2 Bin/i)).toBeVisible();

    // Wait for undo to be available
    await waitForUndoEnabled(page);

    // Undo
    await page.keyboard.press('Control+z');

    // Should be back to original dimensions
    await expect(inspector.getByText(/2×4 Bin/i)).toBeVisible();
  });

  test('shows error toast when rotation would exceed bounds', async ({ page }) => {
    // Draw a tall narrow bin near the right edge
    // At position (8,0), a 2x5 bin when rotated would be 5x2, exceeding drawer width of 10
    const bin = await drawBinOnGrid(page, 300, 50, 360, 200);
    await waitForBinSelected(bin);

    // Try to rotate
    await page.keyboard.press('r');

    // Should show error toast about bounds
    await waitForToast(page, /cannot rotate.*bounds/i);
  });

  test('shows error toast when rotation would cause collision', async ({ page }) => {
    // Draw first bin: 2x4 at origin
    const bin1 = await drawBinOnGrid(page, 50, 50, 130, 210);

    // Exit any selection
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw second bin: adjacent at (3,0) - 2x2 bin
    await drawBinOnGrid(page, 150, 50, 210, 110);

    // Exit selection
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Select first bin by clicking on it
    await bin1.click();
    await waitForBinSelected(bin1);

    // Try to rotate first bin - this would make it 4x2 and collide with bin2
    await page.keyboard.press('r');

    // Should show error toast about collision
    await waitForToast(page, /cannot rotate.*collide/i);
  });

  test('square bin rotation is a no-op', async ({ page }) => {
    // Draw a 2x2 square bin
    const bin = await drawBinOnGrid(page, 50, 50, 130, 130);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await expect(inspector.getByText(/2×2 Bin/i)).toBeVisible();

    // Rotate
    await page.keyboard.press('r');

    // Should still be 2x2 (no visible change, but no error either)
    await expect(inspector.getByText(/2×2 Bin/i)).toBeVisible();
  });
});
