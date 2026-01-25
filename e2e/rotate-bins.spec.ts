import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getInspector,
  waitForPaintModeExited,
  waitForBinSelected,
  waitForUndoEnabled,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

test.describe('Rotate Bins', () => {
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
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
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

    // Click the rotate/swap button (aria-label is "Swap width and depth")
    const rotateButton = inspector.getByRole('button', { name: /swap width/i });
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

  // NOTE: Smart rotation E2E tests are challenging due to precise positioning requirements.
  // The smart rotation logic is thoroughly tested in unit tests (src/test/rotation.test.ts
  // and src/test/binLocation.test.ts). These E2E tests verify basic rotation still works.

  // Skip: Requires precise bin placement at exact grid edge
  // which is unreliable with auto-zoom. See unit tests for validation.
  test.skip('smart rotation repositions bin when rotation would exceed bounds', async ({
    page: _page,
  }) => {
    // This test would verify:
    // 1. Place a 1x3 bin near right edge
    // 2. Rotate - should reposition left to fit as 3x1
    // 3. Verify toast shows repositioning message
    //
    // Skipped because precise edge placement is unreliable in E2E.
    // Smart rotation validation is covered in src/test/rotation.test.ts
  });

  // Skip: Same coordinate precision issue
  test.skip('smart rotation finds position when collision would occur', async ({ page: _page }) => {
    // This test would verify rotation finds alternate position when blocked
  });

  test('rotation undo works correctly', async ({ page }) => {
    // Verify that rotation (with or without repositioning) is undoable
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);

    // Draw a rectangular bin (2x3) using same coords as other tests
    // This matches the working 'can rotate a bin using R key' test
    const bin = await drawBinOnGrid(page, 20, 20, 84, 116);
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    // Verify initial dimensions
    await expect(inspector.getByText(/2×3 Bin/i)).toBeVisible();

    // Rotate
    await page.keyboard.press('r');
    await waitForUndoEnabled(page);

    // Verify dimensions changed (should now be 3x2)
    await expect(inspector.getByText(/3×2 Bin/i)).toBeVisible();

    // Undo should restore original dimensions
    await page.keyboard.press('Control+z');

    // Wait for undo to apply and verify restored
    await expect(inspector.getByText(/2×3 Bin/i)).toBeVisible({ timeout: 3000 });
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
