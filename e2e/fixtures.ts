import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

// Re-export test and expect from Playwright
export { test, expect } from '@playwright/test';

// Re-export test utilities for convenience
export {
  clearAllStorage,
  waitForAutoSave,
  resetViewport,
  getNewestBin,
  getBinByIndex,
  getBinCount,
} from './test-utils';

// Default timeout for wait operations (ms)
const DEFAULT_TIMEOUT = 5000;

/**
 * Helper to get the grid canvas element.
 * The grid has role="application" and contains the drawer grid.
 */
export async function getGrid(page: Page): Promise<Locator> {
  return page.locator('[role="application"]');
}

/**
 * Helper to wait for the app to be fully loaded.
 */
export async function waitForAppReady(page: Page) {
  await page.waitForSelector('header', { timeout: 10000 });
  // Wait for grid to be rendered
  await page.waitForSelector('[role="application"]', { timeout: 10000 });
}

/**
 * Helper to get the grid bounds for mouse interactions.
 */
export async function getGridBounds(page: Page) {
  const grid = page.locator('[role="application"]');
  await grid.waitFor({ state: 'visible' });
  const bounds = await grid.boundingBox();
  if (!bounds) throw new Error('Grid not found');
  return bounds;
}

// ============================================================================
// ROBUST WAIT HELPERS - Use these instead of waitForTimeout
// ============================================================================

/**
 * Wait for a specific number of bins on the grid.
 */
export async function waitForBinCount(page: Page, count: number, timeout = DEFAULT_TIMEOUT) {
  await expect(page.locator('[data-bin-id]')).toHaveCount(count, { timeout });
}

/**
 * Wait for a bin to be selected (aria-pressed="true").
 */
export async function waitForBinSelected(bin: Locator, timeout = DEFAULT_TIMEOUT) {
  await expect(bin).toHaveAttribute('aria-pressed', 'true', { timeout });
}

/**
 * Wait for no bins to be selected.
 */
export async function waitForNoSelection(page: Page, timeout = DEFAULT_TIMEOUT) {
  // Wait until no bin has aria-pressed="true"
  await expect(page.locator('[data-bin-id][aria-pressed="true"]')).toHaveCount(0, { timeout });
}

/**
 * Wait for a specific number of bins to be selected.
 */
export async function waitForSelectionCount(page: Page, count: number, timeout = DEFAULT_TIMEOUT) {
  await expect(page.locator('[data-bin-id][aria-pressed="true"]')).toHaveCount(count, { timeout });
}

/**
 * Wait for undo button to be enabled.
 */
export async function waitForUndoEnabled(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('button', { name: /undo/i })).toBeEnabled({ timeout });
}

/**
 * Wait for undo button to be disabled.
 */
export async function waitForUndoDisabled(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('button', { name: /undo/i })).toBeDisabled({ timeout });
}

/**
 * Wait for redo button to be enabled.
 */
export async function waitForRedoEnabled(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('button', { name: /redo/i })).toBeEnabled({ timeout });
}

/**
 * Wait for redo button to be disabled.
 */
export async function waitForRedoDisabled(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('button', { name: /redo/i })).toBeDisabled({ timeout });
}

/**
 * Wait for a toast message to appear.
 */
export async function waitForToast(page: Page, pattern: RegExp, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByText(pattern)).toBeVisible({ timeout });
}

/**
 * Wait for a dialog to be visible.
 */
export async function waitForDialog(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('dialog')).toBeVisible({ timeout });
}

/**
 * Wait for dialog to close.
 */
export async function waitForDialogClosed(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout });
}

/**
 * Wait for stash container to be visible (has bins).
 */
export async function waitForStashVisible(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.locator('[data-staging-bin-id]').first()).toBeVisible({ timeout });
}

/**
 * Wait for stash to be empty/hidden.
 */
export async function waitForStashHidden(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.locator('[data-staging-bin-id]')).toHaveCount(0, { timeout });
}

/**
 * Wait for staging bins count.
 */
export async function waitForStagingBinCount(page: Page, count: number, timeout = DEFAULT_TIMEOUT) {
  await expect(page.locator('[data-staging-bin-id]')).toHaveCount(count, { timeout });
}

/**
 * Wait for paint mode indicator to be visible.
 */
export async function waitForPaintMode(page: Page, width: number, depth: number, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByText(new RegExp(`paint.*${width}×${depth}`, 'i'))).toBeVisible({ timeout });
}

/**
 * Wait for paint mode to be exited.
 * Looks for the paint mode button (with aria-label="Exit paint mode") to not be visible.
 */
export async function waitForPaintModeExited(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.getByRole('button', { name: 'Exit paint mode' })).not.toBeVisible({ timeout });
}

/**
 * Wait for canvas (3D preview) to be visible.
 */
export async function waitForCanvas(page: Page, timeout = 10000) {
  await expect(page.locator('canvas').first()).toBeVisible({ timeout });
}

/**
 * Wait for canvas (3D preview) to be hidden.
 */
export async function waitForCanvasHidden(page: Page, timeout = DEFAULT_TIMEOUT) {
  await expect(page.locator('canvas')).not.toBeVisible({ timeout });
}

// ============================================================================
// IMPROVED INTERACTION HELPERS
// ============================================================================

/**
 * Helper to draw a bin on the grid by dragging.
 * Returns the bin locator for the newly created bin.
 */
export async function drawBinOnGrid(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<Locator> {
  const countBefore = await page.locator('[data-bin-id]').count();
  const bounds = await getGridBounds(page);

  await page.mouse.move(bounds.x + startX, bounds.y + startY);
  await page.mouse.down();
  await page.mouse.move(bounds.x + endX, bounds.y + endY, { steps: 5 });
  await page.mouse.up();

  // Wait for bin count to increase
  await waitForBinCount(page, countBefore + 1);

  // Return the newest bin (more explicit than .last())
  const { getNewestBin } = await import('./test-utils');
  return getNewestBin(page);
}

/**
 * Helper to select a bin at a position and verify selection.
 */
export async function selectBinAt(page: Page, x: number, y: number) {
  const bounds = await getGridBounds(page);
  await page.mouse.click(bounds.x + x, bounds.y + y);

  // Wait for at least one bin to be selected
  await expect(page.locator('[data-bin-id][aria-pressed="true"]').first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
}

/**
 * Helper to count bins displayed on the grid.
 */
export async function countBins(page: Page): Promise<number> {
  const bins = page.locator('[data-bin-id]');
  return bins.count();
}

/**
 * Helper to select a bin size from the palette.
 */
export async function selectBinSize(page: Page, width: number, depth: number) {
  const sizeButton = page.getByRole('button', { name: new RegExp(`${width}×${depth}`, 'i') }).first();
  await sizeButton.click();
  // Wait for paint mode indicator to appear (confirms selection worked)
  await page.getByText(new RegExp(`paint.*${width}×${depth}`, 'i')).waitFor({ state: 'visible', timeout: 2000 });
}

/**
 * Helper to fill the current layer with bins of selected size.
 */
export async function fillLayerWithSize(page: Page, width: number, depth: number) {
  await selectBinSize(page, width, depth);

  // Fill button is in the sidebar
  const sidebar = page.locator('aside').first();
  const fillButton = sidebar.getByRole('button', { name: new RegExp(`fill with ${width}×${depth}`, 'i') });
  await fillButton.click();

  // Wait for toast notification confirming bins were added
  await page.getByText(/added \d+ bins/i).waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Get the right panel (inspector).
 * More explicit than .last() - explicitly selects the second aside element.
 */
export function getInspector(page: Page): Locator {
  return page.locator('aside').nth(1);
}

/**
 * Get the left sidebar.
 * More explicit than .first() - explicitly selects the first aside element.
 */
export function getSidebar(page: Page): Locator {
  return page.locator('aside').nth(0);
}

// Mobile viewport configurations
export const MOBILE_VIEWPORT = { width: 375, height: 667 };
export const TABLET_VIEWPORT = { width: 768, height: 1024 };

/**
 * Wait for mobile layout to be ready (bottom nav visible).
 */
export async function waitForMobileAppReady(page: Page) {
  // Wait for the bottom nav bar that's unique to mobile (has .bottom-nav class)
  await page.waitForSelector('nav.bottom-nav', { timeout: 10000 });
  // Wait for grid to be rendered
  await page.waitForSelector('[role="application"]', { timeout: 10000 });
}

/**
 * Get the mobile bottom navigation bar.
 */
export function getBottomNav(page: Page): Locator {
  return page.locator('nav.bottom-nav');
}

/**
 * Get the mobile bottom sheet (when a panel is open).
 */
export function getBottomSheet(page: Page): Locator {
  return page.locator('[role="dialog"]').filter({ hasText: /(Layers|Categories|Inspector|Settings|Print)/ });
}
