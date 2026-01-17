import type { Page } from '@playwright/test';
import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getGridBounds,
  waitForBinCount,
  waitForStashVisible,
  waitForStashHidden,
  waitForStagingBinCount,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
  getInspector,
  getStash,
  getActiveDialog,
} from './fixtures';

/**
 * Helper to check stash bin count badge
 */
function getStashBinCount(page: Page) {
  // The bin count badge is a span with "N bins" text inside the stash header area
  return getStash(page).locator('span.text-xs').filter({ hasText: /^\d+ bins?$/ });
}

test.describe('Staging Area (Stash)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs (excluding Labs drawer)
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('stash is hidden when empty', async ({ page }) => {
    // Stash should not be visible when no bins are stashed
    // Look for the stash container specifically
    const stashContainer = getStash(page);
    await expect(stashContainer).not.toBeVisible();
  });

  test('can move bin to stash via inspector', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Select the bin
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    // Inspector should show with "To Stash" button
    const inspector = getInspector(page);
    const toStashButton = inspector.getByRole('button', { name: /to stash/i });
    await expect(toStashButton).toBeVisible();

    // Click to move to stash
    await toStashButton.click();

    // Stash should now be visible with the bin
    await waitForStashVisible(page);
    await expect(getStashBinCount(page)).toHaveText('1 bin');
  });

  test('stash shows bin count', async ({ page }) => {
    // Create multiple bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    // Move first bin to stash
    const bins = page.locator('[data-bin-id]');
    await bins.first().click();
    await waitForBinSelected(bins.first());

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStagingBinCount(page, 1);

    // Verify count shows 1 bin
    await expect(getStashBinCount(page)).toHaveText('1 bin');

    // Move second bin to stash
    await bins.first().click();
    await waitForBinSelected(bins.first());
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStagingBinCount(page, 2);

    // Verify count shows 2 bins
    await expect(getStashBinCount(page)).toHaveText('2 bins');
  });

  test('stashed bins display with correct dimensions', async ({ page }) => {
    // Create a 2x3 bin
    await drawBinOnGrid(page, 50, 50, 114, 146);

    // Move to stash
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStashVisible(page);

    // Stash bin should show dimensions
    const stagingBin = page.locator('[data-staging-bin-id]').first();
    await expect(stagingBin).toBeVisible();
    // The bin shows its dimensions as text inside
    await expect(stagingBin.getByText(/\d×\d/)).toBeVisible();
  });

  test('can clear all stashed bins', async ({ page }) => {
    // Create and stash a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStashVisible(page);

    // Click Clear All button in the stash container
    const stashContainer = getStash(page);
    const clearButton = stashContainer.getByRole('button', { name: /clear all/i });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Confirm dialog should appear
    const dialog = getActiveDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/delete all.*stashed bins/i)).toBeVisible();

    // Confirm deletion
    await dialog.getByRole('button', { name: /clear all/i }).click();

    // Stash should be hidden again
    await waitForStashHidden(page);
  });

  test('can cancel clear all confirmation', async ({ page }) => {
    // Create and stash a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStashVisible(page);

    // Click Clear All button in the stash container
    const stashContainer = getStash(page);
    await stashContainer.getByRole('button', { name: /clear all/i }).click();

    // Cancel the dialog
    const dialog = getActiveDialog(page);
    await dialog.getByRole('button', { name: /cancel/i }).click();

    // Stash should still be visible with the bin
    await expect(stashContainer).toBeVisible();
    await expect(getStashBinCount(page)).toHaveText('1 bin');
  });

  test('dragging from stash starts stagingDrag interaction', async ({ page }) => {
    // Create and stash a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStashVisible(page);

    // Start dragging the stashed bin
    const stagingBin = page.locator('[data-staging-bin-id]').first();
    const bounds = await stagingBin.boundingBox();
    if (!bounds) throw new Error('Staging bin not found');

    // Pointer down on staging bin
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();

    // The staging bin should show as being dragged (dashed outline)
    await expect(stagingBin).toHaveClass(/border-dashed/);

    // Release
    await page.mouse.up();
  });

  test('can drag bin from stash back to grid', async ({ page }) => {
    // Create and stash a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const gridBin = page.locator('[data-bin-id]').first();
    await gridBin.click();
    await waitForBinSelected(gridBin);

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStashVisible(page);

    // Should have 0 bins on grid, 1 in stash
    await waitForBinCount(page, 0);
    await waitForStagingBinCount(page, 1);

    // Drag from stash to grid
    const stagingBin = page.locator('[data-staging-bin-id]').first();
    const stagingBounds = await stagingBin.boundingBox();
    if (!stagingBounds) throw new Error('Staging bin not found');
    const gridBounds = await getGridBounds(page);

    await page.mouse.move(stagingBounds.x + stagingBounds.width / 2, stagingBounds.y + stagingBounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(gridBounds.x + 100, gridBounds.y + 100, { steps: 10 });
    await page.mouse.up();

    // Should have 1 bin on grid, 0 in stash
    await waitForBinCount(page, 1);
    // Stash should be hidden when empty
    await waitForStashHidden(page);
  });

  test('stash appears as drop target when dragging bin from grid', async ({ page }) => {
    // Create a bin on the grid
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Start dragging the bin
    const bin = page.locator('[data-bin-id]').first();
    const bounds = await bin.boundingBox();
    if (!bounds) throw new Error('Bin not found');

    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();

    // Move slightly to trigger movement detection
    await page.mouse.move(bounds.x + bounds.width / 2 + 50, bounds.y + bounds.height / 2, { steps: 5 });

    // Drop zone should appear (shows "Drop here to stash" or similar)
    await expect(page.getByText(/drop.*stash/i)).toBeVisible();

    // Release
    await page.mouse.up();
  });

  test('undo restores bin from stash to grid', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Move to stash
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await waitForBinSelected(bin);

    const inspector = getInspector(page);
    await inspector.getByRole('button', { name: /to stash/i }).click();
    await waitForStashVisible(page);

    // Verify bin is in stash
    await waitForStagingBinCount(page, 1);
    await waitForBinCount(page, 0);

    // Undo
    await page.keyboard.press('Control+z');

    // Bin should be back on grid
    await waitForBinCount(page, 1);
    await waitForStashHidden(page);
  });
});
