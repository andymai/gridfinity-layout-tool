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
  seedBins,
  readBins,
} from './fixtures';

test.describe('Rotate Bins', () => {
  // Phones rotate from the bin sheet; these drive the desktop inspector and keys.
  const isDesktop = (viewport: { width: number } | null): boolean => (viewport?.width ?? 0) >= 900;
  test.skip(({ viewport }) => !isDesktop(viewport), 'desktop pointer and keyboard flow');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  // Hooks run for a skipped test too, on a page that never left about:blank.
  test.afterEach(async ({ page, viewport }) => {
    if (!isDesktop(viewport)) return;
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

  // These seed their bins at exact cells (`seedBins`), because a drawn bin's
  // cells depend on the zoom.
  test('smart rotation moves a bin back inside when turning it would cross the edge', async ({
    page,
  }) => {
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);
    const [id] = await seedBins(page, [{ x: 9, y: 0, width: 1, depth: 3, label: 'Edge' }]);
    const bin = page.locator(`[data-bin-id="${id}"]`);
    await bin.click();
    await waitForBinSelected(bin);

    await page.keyboard.press('r');

    await expect(page.getByText('Bin rotated and moved 2 cells to fit')).toBeVisible();
    expect(await readBins(page, [id])).toEqual([{ x: 7, y: 0, width: 3, depth: 1 }]);
  });

  test('smart rotation finds room when turning in place would hit a bin', async ({ page }) => {
    await page.keyboard.press('Escape');
    await waitForPaintModeExited(page);
    const [id, blocker] = await seedBins(page, [
      { x: 4, y: 0, width: 1, depth: 3, label: 'Turner' },
      { x: 5, y: 0, width: 1, depth: 1, label: 'Blocker' },
    ]);
    const bin = page.locator(`[data-bin-id="${id}"]`);
    await bin.click();
    await waitForBinSelected(bin);

    await page.keyboard.press('r');

    await expect(page.getByText(/^Bin rotated and moved \d+ cells? to fit$/)).toBeVisible();
    const [turned, other] = await readBins(page, [id, blocker]);
    expect({ width: turned.width, depth: turned.depth }).toEqual({ width: 3, depth: 1 });
    const overlaps =
      turned.x < other.x + other.width &&
      other.x < turned.x + turned.width &&
      turned.y < other.y + other.depth &&
      other.y < turned.y + turned.depth;
    expect(overlaps).toBe(false);
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
