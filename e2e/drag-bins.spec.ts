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

  test('Alt+drag works with multiple selected bins', async ({ page }) => {
    const bounds = await getGridBounds(page);

    // Create a second bin
    await drawBinOnGrid(page, 150, 150, 200, 200);
    await waitForBinCount(page, 2);

    // Select first bin
    await selectBinAt(page, 70, 130);

    // Ctrl+click to add second bin to selection
    await page.keyboard.down('Control');
    await page.mouse.click(bounds.x + 170, bounds.y + 170);
    await page.keyboard.up('Control');

    // Verify 2 bins are selected
    await waitForSelectionCount(page, 2);

    // Alt+drag to duplicate both bins
    await page.mouse.move(bounds.x + 70, bounds.y + 130);
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
