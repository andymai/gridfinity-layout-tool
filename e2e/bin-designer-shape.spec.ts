import { test, expect, clearAllStorage, getActiveDialog } from './fixtures';

test.describe('Bin Designer — Shape Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/designer');
    // Shape panel lives inside the bin designer parameter panel. The
    // Shape group is defaultExpanded so the section renders on mount.
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    await expect(grid).toBeVisible({ timeout: 10000 });
    // ParameterPanel is scrollable; ensure the grid is fully in the
    // viewport so mouse events hit actual cells at their boundingBox.
    await grid.scrollIntoViewIfNeeded();
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('starts in the rectangle fast-path (every cell filled)', async ({ page }) => {
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    const cells = grid.getByRole('gridcell');
    const count = await cells.count();
    expect(count).toBeGreaterThan(0);
    // Every cell should advertise itself as filled at load.
    const emptyCells = grid.getByRole('gridcell', { selected: false });
    await expect(emptyCells).toHaveCount(0);
  });

  test('L preset clears the bottom-right quadrant of the grid', async ({ page }) => {
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    await page.getByRole('button', { name: /^L$/ }).click();
    // L clears a chunk — settle on a non-zero count of empty cells.
    const emptyCells = grid.getByRole('gridcell', { selected: false });
    await expect.poll(async () => emptyCells.count(), { timeout: 5000 }).toBeGreaterThan(0);
  });

  test('Rectangle preset returns a custom shape to fully filled', async ({ page }) => {
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    await page.getByRole('button', { name: /^L$/ }).click();
    const emptyAfterL = await grid.getByRole('gridcell', { selected: false }).count();
    expect(emptyAfterL).toBeGreaterThan(0);
    await page.getByRole('button', { name: /^Rectangle$/ }).click();
    await expect(grid.getByRole('gridcell', { selected: false })).toHaveCount(0);
  });

  test('Enter key toggles a focused cell (keyboard activation)', async ({ page }) => {
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    // Bottom-right corner is always safe to clear without creating a hole.
    const cell = grid.getByRole('gridcell').last();
    await cell.focus();
    await expect(cell).toBeFocused();
    await expect(cell).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(cell).toHaveAttribute('aria-selected', 'false');
    // Toggle back — the test shouldn't leave the grid in a "custom" state
    // that the post-test storage reset can't recover from on a reload.
    await page.keyboard.press('Enter');
    await expect(cell).toHaveAttribute('aria-selected', 'true');
  });

  test('Space key also toggles a focused cell', async ({ page }) => {
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    const cell = grid.getByRole('gridcell').last();
    await cell.focus();
    await page.keyboard.press('Space');
    await expect(cell).toHaveAttribute('aria-selected', 'false');
  });

  test('drag release outside the grid clears drag state (no sticky paint)', async ({ page }) => {
    const grid = page.getByRole('grid', { name: /bin shape editor/i });
    const cells = grid.getByRole('gridcell');
    const cell = cells.last();
    const box = await cell.boundingBox();
    if (!box) throw new Error('cell bounding box not found');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // Move the pointer well outside the grid and release there. Without
    // the window-level pointerup listener, drag state could remain stuck
    // and subsequent hover-over-cell events would continue painting.
    await page.mouse.move(0, 0);
    await page.mouse.up();
    // Hover a different cell — it should NOT flip state, because drag
    // state was cleared by the window listener on release.
    const other = cells.first();
    const otherBox = await other.boundingBox();
    if (!otherBox) throw new Error('other cell bounding box not found');
    await page.mouse.move(otherBox.x + otherBox.width / 2, otherBox.y + otherBox.height / 2);
    await expect(other).toHaveAttribute('aria-selected', 'true');
  });
});
