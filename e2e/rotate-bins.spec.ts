import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getInspector,
  waitForPaintModeExited,
  waitForBinSelected,
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
    // Exit any paint mode first
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw a 2x3 rectangular bin (non-square so rotation is visible)
    // Grid cell size is 32px, so 2x3 = 64x96 pixels
    const bin = await drawBinOnGrid(page, 20, 20, 84, 116);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);

    // Verify initial dimensions before rotation - header shows "WxD Bin"
    // This assertion confirms the bin was created with expected dimensions
    await expect(inspector.getByText(/2×3 Bin/i)).toBeVisible();

    // Press R to rotate (standalone key, not Ctrl+R)
    await page.keyboard.press('r');

    // Verify dimensions swapped - should now be 3x2
    await expect(inspector.getByText(/3×2 Bin/i)).toBeVisible();
  });

  test('can rotate using the rotate button in inspector', async ({ page }) => {
    // Exit any paint mode first
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw a 2x3 rectangular bin (32px per cell, so 64x96 pixels)
    const bin = await drawBinOnGrid(page, 20, 20, 84, 116);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await expect(inspector.getByText(/2×3 Bin/i)).toBeVisible();

    // Click the rotate button
    const rotateButton = inspector.getByRole('button', { name: /rotate/i });
    await rotateButton.click();

    // Verify dimensions swapped
    await expect(inspector.getByText(/3×2 Bin/i)).toBeVisible();
  });

  test('rotation can be undone', async ({ page }) => {
    // Exit any paint mode first
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw a 2x3 bin and select it
    const bin = await drawBinOnGrid(page, 20, 20, 84, 116);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await expect(inspector.getByText(/2×3 Bin/i)).toBeVisible();

    // Rotate
    await page.keyboard.press('r');
    await expect(inspector.getByText(/3×2 Bin/i)).toBeVisible();

    // Wait for undo to be available
    await waitForUndoEnabled(page);

    // Undo
    await page.keyboard.press('Control+z');

    // Should be back to original dimensions
    await expect(inspector.getByText(/2×3 Bin/i)).toBeVisible();
  });

  // TODO: These edge-case tests are skipped due to grid auto-zoom making
  // coordinate calculations unreliable. The rotation validation logic is
  // thoroughly tested in unit tests (src/test/rotation.test.ts).
  // See: https://github.com/andymai/gridfinity-layout-tool/issues/42
  test.skip('shows error toast when rotation would exceed bounds', async ({ page }) => {
    // Test requires placing a bin at exact grid position (column 8)
    // which is difficult with auto-zoom. The underlying validation
    // logic is tested in validateRotation unit tests.
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Would need to:
    // 1. Create a 1x3 bin at column 8 (near right edge)
    // 2. Try to rotate - should fail with bounds error
    // 3. Verify toast message
  });

  test.skip('shows error toast when rotation would cause collision', async ({ page }) => {
    // Test requires placing two adjacent bins at exact positions
    // which is difficult with auto-zoom. The underlying validation
    // logic is tested in validateRotation unit tests.
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Would need to:
    // 1. Create a 2x3 bin at position (0,0)
    // 2. Create a 1x1 bin at position (2,0)
    // 3. Try to rotate first bin - should fail with collision error
    // 4. Verify toast message
  });

  test('square bin rotation is a no-op', async ({ page }) => {
    // Exit any paint mode first
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw a 2x2 square bin at position (0,0)
    // Grid cell size is 32px, so 2x2 = 64x64 pixels
    const bin = await drawBinOnGrid(page, 20, 20, 84, 84);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await expect(inspector.getByText(/2×2 Bin/i)).toBeVisible();

    // Rotate
    await page.keyboard.press('r');

    // Should still be 2x2 (no visible change, but no error either)
    await expect(inspector.getByText(/2×2 Bin/i)).toBeVisible();
  });
});
