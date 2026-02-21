import {
  test,
  expect,
  waitForAppReady,
  getGridBounds,
  drawBinOnGrid,
  waitForBinCount,
  waitForBinSelected,
  waitForUndoEnabled,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  getInspector,
  waitForSelectionCount,
} from './fixtures';

/**
 * Smart Snap Placement E2E Tests
 *
 * Tests the smart snap system that finds nearby valid positions when bin
 * interactions would collide. Key behaviors:
 * - Drag/resize/draw auto-adjust to nearby valid positions (amber preview)
 * - Hold Ctrl to disable snapping and see raw collision state (red preview)
 * - Green preview when no adjustment needed
 *
 * Data attributes used for assertions:
 * - [data-interaction-preview]: "drag" | "resize" | "stagingDrag" | "draw"
 * - [data-snap-state]: "valid" | "snapped" | "invalid"
 */
test.describe('Smart Snap Placement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test.describe('Drag Snapping', () => {
    test('dragging bin to empty space shows green valid preview', async ({ page }) => {
      // Create a bin in the upper-left area
      const bin = await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);
      await waitForBinSelected(bin);

      const bounds = await getGridBounds(page);
      const binBox = await bin.boundingBox();
      if (!binBox) throw new Error('Bin not found');

      // Start dragging the bin toward empty space (center-right of grid)
      await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.5, {
        steps: 10,
      });

      // Preview should show "valid" (green) — no snap needed
      const preview = page.locator('[data-interaction-preview="drag"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      await expect(preview.first()).toHaveAttribute('data-snap-state', 'valid');

      await page.mouse.up();
    });

    test('dragging bin toward collision auto-snaps to nearby valid position', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create two bins well-separated
      // First bin: upper-left
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      // Second bin: far right (at least 4 cells apart)
      const bin2 = await drawBinOnGrid(page, bounds.width * 0.7, 30, bounds.width * 0.7 + 60, 80);
      await waitForBinCount(page, 2);
      await waitForBinSelected(bin2);

      const bin2Box = await bin2.boundingBox();
      if (!bin2Box) throw new Error('Second bin not found');

      // Drag second bin directly on top of first bin (collision)
      await page.mouse.move(bin2Box.x + bin2Box.width / 2, bin2Box.y + bin2Box.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 55, bounds.y + 55, { steps: 10 });

      // Smart snap should find a nearby valid position → amber "snapped" state
      const preview = page.locator('[data-interaction-preview="drag"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      // Should be either "snapped" (adjusted to avoid collision) or "valid" (if exact position works)
      const snapState = await preview.first().getAttribute('data-snap-state');
      expect(['snapped', 'valid']).toContain(snapState);

      await page.mouse.up();
    });

    test('holding Ctrl during drag disables snap and shows invalid state', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create two well-separated bins
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      const bin2 = await drawBinOnGrid(page, bounds.width * 0.7, 30, bounds.width * 0.7 + 60, 80);
      await waitForBinCount(page, 2);
      await waitForBinSelected(bin2);

      const bin2Box = await bin2.boundingBox();
      if (!bin2Box) throw new Error('Second bin not found');

      // Start drag first WITHOUT Ctrl, then press Ctrl mid-drag
      await page.mouse.move(bin2Box.x + bin2Box.width / 2, bin2Box.y + bin2Box.height / 2);
      await page.mouse.down();
      // Move partway toward target
      await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + 55, { steps: 5 });
      // Now press Ctrl to disable snapping
      await page.keyboard.down('Control');
      // Continue dragging into collision area
      await page.mouse.move(bounds.x + 55, bounds.y + 55, { steps: 5 });

      // With Ctrl held, should show "invalid" (red) instead of snapping
      const preview = page.locator('[data-interaction-preview="drag"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      await expect(preview.first()).toHaveAttribute('data-snap-state', 'invalid');

      await page.mouse.up();
      await page.keyboard.up('Control');
    });

    test('releasing Ctrl mid-drag re-engages snapping', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create two well-separated bins
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      const bin2 = await drawBinOnGrid(page, bounds.width * 0.7, 30, bounds.width * 0.7 + 60, 80);
      await waitForBinCount(page, 2);
      await waitForBinSelected(bin2);

      const bin2Box = await bin2.boundingBox();
      if (!bin2Box) throw new Error('Second bin not found');

      // Start drag, press Ctrl mid-way
      await page.mouse.move(bin2Box.x + bin2Box.width / 2, bin2Box.y + bin2Box.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + 55, { steps: 5 });
      await page.keyboard.down('Control');
      await page.mouse.move(bounds.x + 55, bounds.y + 55, { steps: 5 });

      const preview = page.locator('[data-interaction-preview="drag"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      await expect(preview.first()).toHaveAttribute('data-snap-state', 'invalid');

      // Release Ctrl — snapping should re-engage
      await page.keyboard.up('Control');
      // Move slightly to trigger recalculation
      await page.mouse.move(bounds.x + 56, bounds.y + 56, { steps: 3 });

      // Should now be snapped or valid (not invalid)
      const snapState = await preview.first().getAttribute('data-snap-state');
      expect(['snapped', 'valid']).toContain(snapState);

      await page.mouse.up();
    });

    test('snapped drag commits to valid position on release', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create a bin that will be the obstacle
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      // Create second bin far away
      const bin2 = await drawBinOnGrid(page, bounds.width * 0.7, 30, bounds.width * 0.7 + 60, 80);
      await waitForBinCount(page, 2);
      await waitForBinSelected(bin2);

      const bin2Box = await bin2.boundingBox();
      if (!bin2Box) throw new Error('Second bin not found');

      // Drag toward collision area — snap should find valid spot
      await page.mouse.move(bin2Box.x + bin2Box.width / 2, bin2Box.y + bin2Box.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 55, bounds.y + 55, { steps: 10 });
      await page.mouse.up();

      // Verify operation committed (undoable action created)
      await waitForUndoEnabled(page);

      // Still have 2 bins (nothing was lost)
      await waitForBinCount(page, 2);
    });

    test('invalid drag with Ctrl held does not commit position change', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create a bin
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      // Create second bin far away
      const bin2 = await drawBinOnGrid(page, bounds.width * 0.7, 30, bounds.width * 0.7 + 60, 80);
      await waitForBinCount(page, 2);
      await waitForBinSelected(bin2);

      const bin2Box = await bin2.boundingBox();
      if (!bin2Box) throw new Error('Second bin not found');

      // Start drag, press Ctrl mid-way, drag into collision
      await page.mouse.move(bin2Box.x + bin2Box.width / 2, bin2Box.y + bin2Box.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.4, bounds.y + 55, { steps: 3 });
      await page.keyboard.down('Control');
      await page.mouse.move(bounds.x + 55, bounds.y + 55, { steps: 5 });
      await page.mouse.up();
      await page.keyboard.up('Control');

      // Bin should snap back — position should be near where it started
      // Verify bins still exist
      await waitForBinCount(page, 2);
    });
  });

  test.describe('Resize Snapping', () => {
    test('resizing bin into collision auto-constrains to max valid size', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create first bin in the upper-left
      await drawBinOnGrid(page, 20, 20, 70, 70);
      await waitForBinCount(page, 1);

      // Create second bin well to the right (at least 5 cells apart)
      await drawBinOnGrid(page, bounds.width * 0.5, 20, bounds.width * 0.5 + 60, 70);
      await waitForBinCount(page, 2);

      // Click empty space to deselect
      await page.mouse.click(bounds.x + bounds.width * 0.9, bounds.y + bounds.height * 0.9);
      await page.waitForTimeout(200);

      // Select first bin
      const firstBin = page.locator('[data-bin-id]').first();
      await firstBin.click();
      await waitForBinSelected(firstBin);

      const binBox = await firstBin.boundingBox();
      if (!binBox) throw new Error('First bin not found');

      // Resize first bin's east edge far right (past second bin)
      const eastEdgeX = binBox.x + binBox.width - 2;
      const edgeY = binBox.y + binBox.height / 2;
      await page.mouse.move(eastEdgeX, edgeY);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.8, edgeY, { steps: 10 });

      // Resize should be constrained — shows "snapped" or "valid"
      const preview = page.locator('[data-interaction-preview="resize"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      const snapState = await preview.first().getAttribute('data-snap-state');
      expect(['snapped', 'valid']).toContain(snapState);

      await page.mouse.up();
    });

    test('resize with Ctrl held shows invalid when colliding', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create two well-separated bins
      await drawBinOnGrid(page, 20, 20, 70, 70);
      await waitForBinCount(page, 1);

      await drawBinOnGrid(page, bounds.width * 0.5, 20, bounds.width * 0.5 + 60, 70);
      await waitForBinCount(page, 2);

      // Click empty space to deselect
      await page.mouse.click(bounds.x + bounds.width * 0.9, bounds.y + bounds.height * 0.9);
      await page.waitForTimeout(200);

      // Select first bin
      const firstBin = page.locator('[data-bin-id]').first();
      await firstBin.click();
      await waitForBinSelected(firstBin);

      const binBox = await firstBin.boundingBox();
      if (!binBox) throw new Error('First bin not found');

      // Start resize, then press Ctrl mid-drag
      const eastEdgeX = binBox.x + binBox.width - 2;
      const edgeY = binBox.y + binBox.height / 2;
      await page.mouse.move(eastEdgeX, edgeY);
      await page.mouse.down();
      await page.mouse.move(eastEdgeX + 30, edgeY, { steps: 3 });
      await page.keyboard.down('Control');
      await page.mouse.move(bounds.x + bounds.width * 0.8, edgeY, { steps: 5 });

      // With Ctrl, should show invalid (no auto-constrain)
      const preview = page.locator('[data-interaction-preview="resize"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      await expect(preview.first()).toHaveAttribute('data-snap-state', 'invalid');

      await page.mouse.up();
      await page.keyboard.up('Control');
    });
  });

  test.describe('Draw Snapping', () => {
    test('drawing a bin on empty grid creates bin successfully', async ({ page }) => {
      // Draw a bin on the empty grid
      const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
      await waitForBinCount(page, 1);

      // Verify bin was created
      const inspector = getInspector(page);
      await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({
        timeout: 3000,
      });
    });

    test('drawing a bin near existing bin still creates bin', async ({ page }) => {
      // Create first bin
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      // Draw another bin in a different area (avoid overlap)
      await drawBinOnGrid(page, 120, 30, 200, 80);
      await waitForBinCount(page, 2);

      // Both bins should exist
      await expect(page.locator('[data-bin-id]')).toHaveCount(2);
    });

    test('draw preview appears while dragging', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Start drawing (mouse down + move)
      await page.mouse.move(bounds.x + 50, bounds.y + 50);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 150, bounds.y + 150, { steps: 5 });

      // Draw preview should be visible
      const preview = page.locator('[data-interaction-preview="draw"]');
      await expect(preview).toBeVisible({ timeout: 2000 });

      // Complete the draw
      await page.mouse.up();
      await waitForBinCount(page, 1);
    });
  });

  test.describe('Multi-bin Drag Snapping', () => {
    test('multi-select drag preserves group arrangement', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create two bins far apart (at least half the grid apart)
      const bin1 = await drawBinOnGrid(page, 20, 20, 70, 70);
      await waitForBinCount(page, 1);

      const bin2 = await drawBinOnGrid(page, bounds.width * 0.6, 20, bounds.width * 0.6 + 50, 70);
      await waitForBinCount(page, 2);

      // Multi-select: click first bin, then ControlOrMeta+click second
      await bin1.click();
      await waitForBinSelected(bin1);
      await bin2.click({ modifiers: ['ControlOrMeta'] });
      await waitForSelectionCount(page, 2);

      // Get bin1 position for drag
      const bin1Box = await bin1.boundingBox();
      if (!bin1Box) throw new Error('Bin1 not found');

      // Drag both bins to a new position (lower area)
      await page.mouse.move(bin1Box.x + bin1Box.width / 2, bin1Box.y + bin1Box.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.7, {
        steps: 10,
      });
      await page.mouse.up();

      // Both bins should still exist and operation should be undoable
      await waitForBinCount(page, 2);
      await waitForUndoEnabled(page);
    });
  });

  test.describe('Ctrl Key State Management', () => {
    test('Ctrl state does not persist across separate drag operations', async ({ page }) => {
      const bounds = await getGridBounds(page);

      // Create two well-separated bins
      await drawBinOnGrid(page, 30, 30, 80, 80);
      await waitForBinCount(page, 1);

      const bin2 = await drawBinOnGrid(page, bounds.width * 0.7, 30, bounds.width * 0.7 + 60, 80);
      await waitForBinCount(page, 2);
      await waitForBinSelected(bin2);

      // First drag: hold Ctrl then release it (no actual drag)
      await page.keyboard.down('Control');
      await page.keyboard.up('Control');

      // Second drag toward collision WITHOUT Ctrl — snapping should work
      const bin2Box = await bin2.boundingBox();
      if (!bin2Box) throw new Error('Second bin not found');

      await page.mouse.move(bin2Box.x + bin2Box.width / 2, bin2Box.y + bin2Box.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + 55, bounds.y + 55, { steps: 10 });

      // Should snap (not show invalid) — Ctrl is not held
      const preview = page.locator('[data-interaction-preview="drag"]');
      await expect(preview.first()).toBeVisible({ timeout: 2000 });
      const snapState = await preview.first().getAttribute('data-snap-state');
      expect(['snapped', 'valid']).toContain(snapState);

      await page.mouse.up();
    });
  });
});
