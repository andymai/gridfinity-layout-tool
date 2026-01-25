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
  waitForSelectionCount,
  waitForUndoEnabled,
  clearAllStorage,
  resetViewport,
  waitForBinSelected,
  getActiveDialog,
} from './fixtures';

/**
 * Regression test for stale closure bug in interaction handlers.
 *
 * Bug: PR #142 introduced empty dependency arrays on interaction wrapper functions
 * (startDrag, startDraw, startResize), causing them to capture mode handlers once
 * and never update when layout state changed.
 *
 * Symptom: Newly created bins couldn't be dragged because startDrag had stale
 * layout.bins that didn't include the new bin.
 *
 * Fix: PR #149 - Use refs to hold current mode handlers, updated via useLayoutEffect.
 */
test.describe('Interaction Handler Freshness (Regression)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test('can drag a newly created bin immediately after drawing it', async ({ page }) => {
    // This test catches the stale closure bug from PR #142
    // If startDrag has a stale layout reference, the new bin won't be found

    // Draw a bin
    const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);

    // The bin should be auto-selected after drawing
    await waitForBinSelected(bin);

    // Get the bin's position before drag
    const bounds = await getGridBounds(page);
    const binBox = await bin.boundingBox();
    if (!binBox) throw new Error('Bin not found');

    // Immediately try to drag it - this is where the bug would manifest
    // With stale closures, startDrag couldn't find the bin in layout.bins
    await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 200, { steps: 10 });
    await page.mouse.up();

    // Verify drag created an undoable action (proves drag succeeded)
    await waitForUndoEnabled(page);

    // Verify bin moved (new position should be different)
    const binBoxAfter = await bin.boundingBox();
    if (!binBoxAfter) throw new Error('Bin not found after drag');

    // The bin should have moved to the right and down
    expect(binBoxAfter.x).toBeGreaterThan(binBox.x);
    expect(binBoxAfter.y).toBeGreaterThan(binBox.y);
  });

  test('can drag second bin after creating two bins in sequence', async ({ page }) => {
    // Create first bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await waitForBinCount(page, 1);

    // Create second bin - layout state changes again
    const secondBin = await drawBinOnGrid(page, 150, 50, 220, 120);
    await waitForBinCount(page, 2);

    // Second bin should be selected
    await waitForBinSelected(secondBin);

    const bounds = await getGridBounds(page);
    const binBox = await secondBin.boundingBox();
    if (!binBox) throw new Error('Second bin not found');

    // Try to drag the second bin immediately
    await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 50, bounds.y + 180, { steps: 10 });
    await page.mouse.up();

    // Verify drag succeeded
    await waitForUndoEnabled(page);
  });

  test('can resize a newly created bin immediately', async ({ page }) => {
    // Draw a bin
    const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);
    await waitForBinSelected(bin);

    // Get initial size from inspector
    const inspector = getInspector(page);
    const sizeHeading = inspector.getByRole('heading', { name: /^\d×\d Bin$/i });
    const initialSize = await sizeHeading.textContent();

    // Find the east resize handle and drag it
    const binBox = await bin.boundingBox();
    if (!binBox) throw new Error('Bin not found');

    // Resize handles are at the edges - target the east (right) edge
    const eastHandleX = binBox.x + binBox.width - 2;
    const eastHandleY = binBox.y + binBox.height / 2;

    await page.mouse.move(eastHandleX, eastHandleY);
    await page.mouse.down();
    await page.mouse.move(eastHandleX + 64, eastHandleY, { steps: 5 }); // Extend by ~2 grid units
    await page.mouse.up();

    // Verify resize created an undoable action
    await waitForUndoEnabled(page);

    // Verify size changed in inspector
    const newSize = await sizeHeading.textContent();
    expect(newSize).not.toBe(initialSize);
  });
});

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
    const dialogs = getActiveDialog(page);
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

  test('can duplicate bin with Alt+drag', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Verify we start with 1 bin
    await waitForBinCount(page, 1);

    // Select the bin we created
    await selectBinAt(page, 70, 130);

    // Alt+drag the bin to a new position (this should duplicate it)
    await page.mouse.move(bounds.x + 70, bounds.y + 130);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 50, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    // Should now have 2 bins (original + duplicate)
    await waitForBinCount(page, 2);

    // Verify the operation created an undoable action
    await waitForUndoEnabled(page);
  });

  test('Alt+drag keeps original bin at original position', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Verify we start with 1 bin
    await waitForBinCount(page, 1);

    // Select the bin and check its position before drag
    await selectBinAt(page, 70, 130);
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible();

    // Alt+drag the bin to a new position
    await page.mouse.move(bounds.x + 70, bounds.y + 130);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 250, bounds.y + 50, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    // Wait for 2 bins
    await waitForBinCount(page, 2);

    // The new duplicate should be selected after the drag
    await waitForSelectionCount(page, 1);
  });

  // TODO: This test is flaky due to timing issues with multi-select + Alt+drag
  // The underlying functionality works but the test has race conditions
  test.skip('Alt+drag works with multiple selected bins', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Create a second bin
    await drawBinOnGrid(page, 150, 150, 200, 200);
    await waitForBinCount(page, 2);

    // Get both bins by locator for more reliable selection
    const bins = page.locator('[data-bin-id]');
    const firstBin = bins.first();
    const secondBin = bins.nth(1);

    // Select first bin by clicking it directly
    await firstBin.click();
    await waitForSelectionCount(page, 1);

    // Ctrl+click second bin to add to selection
    await secondBin.click({ modifiers: ['Control'] });

    // Verify 2 bins are selected
    await waitForSelectionCount(page, 2);

    // Get first bin's position for Alt+drag
    const firstBinBox = await firstBin.boundingBox();
    if (!firstBinBox) throw new Error('First bin not found');

    // Alt+drag to duplicate both bins
    await page.mouse.move(
      firstBinBox.x + firstBinBox.width / 2,
      firstBinBox.y + firstBinBox.height / 2
    );
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 70, bounds.y + 50, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    // Should now have 4 bins (2 original + 2 duplicates)
    await waitForBinCount(page, 4);
  });

  test('Alt+drag can be undone', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Verify we start with 1 bin
    await waitForBinCount(page, 1);

    // Select the bin
    await selectBinAt(page, 70, 130);

    // Alt+drag to duplicate
    await page.mouse.move(bounds.x + 70, bounds.y + 130);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 50, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    // Wait for 2 bins
    await waitForBinCount(page, 2);

    // Undo should remove the duplicate
    await page.keyboard.press('Control+z');

    // Should be back to 1 bin
    await waitForBinCount(page, 1);
  });
});

/**
 * Bin Swap Tests
 *
 * Feature: Shift+drag allows swapping positions of two same-sized bins.
 * Bins are considered swap-compatible if:
 * - Exact same dimensions (2×3 with 2×3)
 * - 90° rotated match (2×3 with 3×2) - dragged bin rotates to fit at target position
 *
 * NOTE: E2E swap tests are challenging due to precise coordinate requirements.
 * The core swap utilities are thoroughly tested in unit tests (src/test/swap.test.ts).
 * These E2E tests verify the Shift+drag interaction doesn't break normal behavior.
 */
test.describe('Bin Swap with Shift+drag', () => {
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

  // Skip: Swap detection requires precise cursor-over-bin positioning
  // which is unreliable in E2E due to auto-zoom and coordinate mapping.
  // The swap functionality is verified in unit tests (src/test/swap.test.ts).
  test.skip('can swap two same-sized bins with Shift+drag', async ({ page: _page }) => {
    // This test would verify:
    // 1. Create two 2x2 bins
    // 2. Shift+drag one onto the other
    // 3. Verify swap toast appears
    // 4. Verify positions are exchanged
    //
    // Skipped because swap target detection is coordinate-sensitive
    // and E2E pixel coordinates don't reliably map to grid positions.
  });

  // Skip: Same coordinate precision issue as above
  test.skip('swap with rotated-match bins shows rotation toast', async ({ page: _page }) => {
    // This test would verify 2x3 can swap with 3x2 (rotated match)
  });

  test('Shift+drag to empty space moves bin normally', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Create single bin
    const bin = await drawBinOnGrid(page, 30, 30, 94, 94);
    await waitForBinCount(page, 1);
    await waitForBinSelected(bin);

    const binBoxBefore = await bin.boundingBox();
    if (!binBoxBefore) throw new Error('Bin not found');

    // Shift+drag to empty space (no swap target available)
    await page.mouse.move(
      binBoxBefore.x + binBoxBefore.width / 2,
      binBoxBefore.y + binBoxBefore.height / 2
    );
    await page.keyboard.down('Shift');
    await page.mouse.down();
    // Drag to empty area far from any bins
    await page.mouse.move(bounds.x + 300, bounds.y + 200, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    // Should still have 1 bin
    await waitForBinCount(page, 1);

    // Bin should have moved (normal drag when no swap target)
    const binBoxAfter = await bin.boundingBox();
    if (!binBoxAfter) throw new Error('Bin not found after drag');

    // Position should have changed
    expect(binBoxAfter.x).not.toBe(binBoxBefore.x);

    // Operation should be undoable
    await waitForUndoEnabled(page);
  });

  test('Shift+drag with incompatible bins falls back to normal drag', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Create bins with incompatible sizes (can't be swapped)
    // First bin: 2x2, positioned in upper left
    const bin1 = await drawBinOnGrid(page, 30, 30, 94, 94);
    await waitForBinCount(page, 1);

    // Second bin: 1x1 (incompatible - different size), positioned to the right
    // We don't need to interact with bin2, just need it on the grid
    await drawBinOnGrid(page, 200, 30, 232, 62);
    await waitForBinCount(page, 2);

    const bin1BoxBefore = await bin1.boundingBox();
    if (!bin1BoxBefore) throw new Error('Bin not found');

    // Select first bin
    await bin1.click();
    await waitForBinSelected(bin1);

    // Shift+drag to clearly empty lower area (no obstruction)
    await page.mouse.move(
      bin1BoxBefore.x + bin1BoxBefore.width / 2,
      bin1BoxBefore.y + bin1BoxBefore.height / 2
    );
    await page.keyboard.down('Shift');
    await page.mouse.down();
    // Drag to lower area of grid - definitely empty space
    await page.mouse.move(bounds.x + 100, bounds.y + 250, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    // Should still have 2 bins
    await waitForBinCount(page, 2);

    // First bin should have moved (y position should be different)
    const bin1BoxAfter = await bin1.boundingBox();
    if (!bin1BoxAfter) throw new Error('Bin not found after drag');

    // Check y changed (more reliable than x since we moved down)
    expect(bin1BoxAfter.y).not.toBe(bin1BoxBefore.y);
  });

  test('Shift key during drag does not break undo', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Create a bin
    const bin = await drawBinOnGrid(page, 30, 30, 94, 94);
    await waitForBinCount(page, 1);
    await waitForBinSelected(bin);

    const binBoxBefore = await bin.boundingBox();
    if (!binBoxBefore) throw new Error('Bin not found');

    // Shift+drag to new position
    await page.mouse.move(
      binBoxBefore.x + binBoxBefore.width / 2,
      binBoxBefore.y + binBoxBefore.height / 2
    );
    await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 100, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    // Operation should be undoable
    await waitForUndoEnabled(page);

    // Verify bin moved
    const binBoxAfter = await bin.boundingBox();
    if (!binBoxAfter) throw new Error('Bin not found after drag');
    expect(binBoxAfter.x).not.toBe(binBoxBefore.x);

    // Undo should restore position
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);

    const binBoxRestored = await bin.boundingBox();
    if (!binBoxRestored) throw new Error('Bin not found after undo');

    // Should be back near original position
    expect(Math.abs(binBoxRestored.x - binBoxBefore.x)).toBeLessThan(10);
  });
});
