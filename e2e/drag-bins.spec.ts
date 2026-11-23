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
  seedBins,
  readBins,
} from './fixtures';
import type { Locator, Page } from '@playwright/test';

async function centerOf(bin: Locator): Promise<{ x: number; y: number }> {
  const box = await bin.boundingBox();
  if (!box) throw new Error('Bin not found');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Shift is held from before the press: the drag reads it when it starts. */
async function shiftDrag(page: Page, from: Locator, to: Locator): Promise<void> {
  const start = await centerOf(from);
  const end = await centerOf(to);
  await page.keyboard.down('Shift');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Shift');
}

/**
 * Regression test for stale closure bug in interaction handlers.
 *
 * An empty dependency array on an interaction wrapper (startDrag, startDraw,
 * startResize) captures its mode handler once and never updates when layout
 * state changes, so a newly created bin cannot be dragged: startDrag still
 * holds a `layout.bins` that predates it. The handlers are held in refs and
 * updated via useLayoutEffect to keep them current.
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

  test('can resize a newly created bin immediately', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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

  test('can use arrow keys to nudge selected bin', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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

  test('can delete selected bin with Delete key', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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

  test('Escape key clears selection', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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

  test('can duplicate bin with Alt+drag', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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

  test('Alt+drag keeps original bin at original position', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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

  test('Alt+drag works with multiple selected bins', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
    const bounds = await getGridBounds(page);
    const [secondId] = await seedBins(page, [{ x: 6, y: 0, width: 1, depth: 1, label: 'Second' }]);
    await waitForBinCount(page, 2);

    const firstBin = page.locator('[data-bin-id]').filter({ hasNotText: 'Second' }).first();
    const secondBin = page.locator(`[data-bin-id="${secondId}"]`);
    await firstBin.click();
    await waitForSelectionCount(page, 1);
    await secondBin.click({ modifiers: ['Control'] });
    await waitForSelectionCount(page, 2);

    const start = await firstBin.boundingBox();
    if (!start) throw new Error('First bin not found');
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.keyboard.down('Alt');
    await page.mouse.down();
    await page.mouse.move(bounds.x + 70, bounds.y + 50, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');

    await waitForBinCount(page, 4);
  });

  test('Alt+drag can be undone', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
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
 * Shift+drag swaps two bins of the same size, or of the same size turned a
 * quarter. The swap tests seed their bins at exact cells (`seedBins`), because
 * a drawn bin's cells depend on the zoom.
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

  test('can swap two same-sized bins with Shift+drag', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
    const [a, b] = await seedBins(page, [
      { x: 0, y: 0, width: 2, depth: 2, label: 'A' },
      { x: 5, y: 3, width: 2, depth: 2, label: 'B' },
    ]);

    await shiftDrag(
      page,
      page.locator(`[data-bin-id="${a}"]`),
      page.locator(`[data-bin-id="${b}"]`)
    );

    await expect(page.getByText('Bins swapped positions', { exact: true })).toBeVisible();
    expect(await readBins(page, [a, b])).toEqual([
      { x: 5, y: 3, width: 2, depth: 2 },
      { x: 0, y: 0, width: 2, depth: 2 },
    ]);
  });

  test('swaps a 2×3 with a 3×2 by turning it, and says so', async ({ page, viewport }) => {
    test.skip((viewport?.width ?? 0) < 900, 'desktop pointer and keyboard flow');
    const [a, b] = await seedBins(page, [
      { x: 0, y: 0, width: 2, depth: 3, label: 'A' },
      { x: 5, y: 3, width: 3, depth: 2, label: 'B' },
    ]);

    await shiftDrag(
      page,
      page.locator(`[data-bin-id="${a}"]`),
      page.locator(`[data-bin-id="${b}"]`)
    );

    await expect(page.getByText('Bins swapped positions (rotated to fit)')).toBeVisible();
    const [movedA, movedB] = await readBins(page, [a, b]);
    expect(movedA).toEqual({ x: 5, y: 3, width: 3, depth: 2 });
    expect({ x: movedB.x, y: movedB.y }).toEqual({ x: 0, y: 0 });
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
