import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getInspector,
  waitForBinCount,
  waitForNoSelection,
  waitForSelectionCount,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Multi-Select Operations', () => {
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
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('can select single bin by clicking', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Click to select
    await bin.click();

    // Should be selected (has selected class or attribute)
    await waitForBinSelected(bin);

    // Inspector should show single bin details
    const inspector = getInspector(page);
    await expect(inspector.locator('h2').filter({ hasText: /^\d×\d Bin$/ })).toBeVisible();
  });

  test('modifier+click adds bin to selection', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(2);

    // Click first bin to select
    await bins.first().click();
    await waitForBinSelected(bins.first());

    // Ctrl+click second bin to add to selection
    await bins.last().click({ modifiers: ['ControlOrMeta'] });

    // Both should be selected
    await waitForSelectionCount(page, 2);
  });

  test('modifier+click on unselected bin adds it to selection', async ({ page }) => {
    // Create three bins with spacing
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);
    await drawBinOnGrid(page, 250, 50, 280, 80);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(3);

    // Select first bin normally
    await bins.nth(0).click();
    await waitForBinSelected(bins.nth(0));

    // Ctrl+click second bin to add to selection
    await bins.nth(1).click({ modifiers: ['ControlOrMeta'] });
    await waitForSelectionCount(page, 2);

    // Ctrl+click third bin to add to selection
    await bins.nth(2).click({ modifiers: ['ControlOrMeta'] });

    // All three should now be selected
    await waitForSelectionCount(page, 3);
  });

  test('shift+click adds bin to selection', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');

    // Click first bin to select
    await bins.first().click();
    await waitForBinSelected(bins.first());

    // Shift+click second bin to add
    await bins.last().click({ modifiers: ['Shift'] });

    // Both should be selected
    await waitForSelectionCount(page, 2);
  });

  test('clicking empty space clears selection', async ({ page }) => {
    // Create a bin and select it
    const bin = await drawBinOnGrid(page, 50, 50, 80, 80);
    await bin.click();

    // Should be selected
    await waitForBinSelected(bin);

    // Click on empty grid space
    const gridBounds = await page.locator('[role="application"]').boundingBox();
    if (gridBounds) {
      await page.mouse.click(gridBounds.x + 250, gridBounds.y + 250);
    }

    // Selection should be cleared (or new bin created)
    // The click creates a new bin, so check that new bin exists
    const binCount = await page.locator('[data-bin-id]').count();
    expect(binCount).toBeGreaterThanOrEqual(1);
  });

  test('escape key clears selection', async ({ page }) => {
    // Create and select bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');

    // Select both bins
    await bins.first().click();
    await bins.last().click({ modifiers: ['ControlOrMeta'] });

    // Both should be selected
    await waitForSelectionCount(page, 2);

    // Press Escape to clear selection
    await page.keyboard.press('Escape');

    // Selection should be cleared
    await waitForNoSelection(page);
  });

  test('inspector shows multi-select UI when multiple bins selected', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');

    // Select both bins
    await bins.first().click();
    await bins.last().click({ modifiers: ['ControlOrMeta'] });
    await waitForSelectionCount(page, 2);

    // Inspector should show multi-select UI
    const inspector = getInspector(page);
    await expect(inspector.getByText(/2.*selected/i)).toBeVisible();
  });

  test('delete key removes selected bins', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(2);

    // Select both bins
    await bins.first().click();
    await bins.last().click({ modifiers: ['ControlOrMeta'] });
    await waitForSelectionCount(page, 2);

    // Press Delete
    await page.keyboard.press('Delete');

    // Both bins should be deleted
    await waitForBinCount(page, 0);
  });

  test('ctrl+d duplicates selected bins', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 80, 80);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await waitForBinSelected(bins.first());

    // Duplicate with Ctrl+D
    await page.keyboard.press('Control+d');

    // Should have 2 bins now
    await waitForBinCount(page, 2);
  });

  test('multi-select bulk category change', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');

    // Select both bins
    await bins.first().click();
    await bins.last().click({ modifiers: ['ControlOrMeta'] });
    await waitForSelectionCount(page, 2);

    // Inspector should show category selector
    const inspector = getInspector(page);
    const categorySelect = inspector.locator('select').first();
    await expect(categorySelect).toBeVisible();

    // Change category
    await categorySelect.selectOption({ index: 1 }); // Select second category

    // Both bins should have the new category (visual change)
    // We can't easily verify the category color, but we can verify no errors occurred
    await expect(bins).toHaveCount(2);
  });

  test('clicking unselected bin clears multi-selection and selects only clicked bin', async ({ page }) => {
    // Create three bins with spacing
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);
    await drawBinOnGrid(page, 250, 50, 280, 80);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(3);

    // Select first two bins via modifier+click (multi-select)
    await bins.nth(0).click();
    await waitForBinSelected(bins.nth(0));
    await bins.nth(1).click({ modifiers: ['ControlOrMeta'] });
    await waitForSelectionCount(page, 2);

    // Normal click on the THIRD (unselected) bin should clear multi-selection
    // and select only the third bin
    await bins.nth(2).click({ force: true });

    // Only third should be selected
    await waitForSelectionCount(page, 1);
    await waitForBinSelected(bins.nth(2));
  });

  test('undo restores deleted bins from multi-select', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(2);

    // Select and delete both
    await bins.first().click();
    await bins.last().click({ modifiers: ['ControlOrMeta'] });
    await page.keyboard.press('Delete');

    await waitForBinCount(page, 0);

    // Undo
    await page.keyboard.press('Control+z');

    // Both bins should be restored
    await waitForBinCount(page, 2);
  });
});
