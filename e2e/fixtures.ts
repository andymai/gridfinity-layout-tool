import type { Page, Locator } from '@playwright/test';

// Re-export test and expect from Playwright
export { test, expect } from '@playwright/test';

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

/**
 * Helper to draw a bin on the grid by dragging.
 */
export async function drawBinOnGrid(
  page: Page,
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const bounds = await getGridBounds(page);

  await page.mouse.move(bounds.x + startX, bounds.y + startY);
  await page.mouse.down();
  await page.mouse.move(bounds.x + endX, bounds.y + endY, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/**
 * Helper to select a bin at a position.
 */
export async function selectBinAt(page: Page, x: number, y: number) {
  const bounds = await getGridBounds(page);
  await page.mouse.click(bounds.x + x, bounds.y + y);
  await page.waitForTimeout(100);
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
  await page.waitForTimeout(100);
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

  // Wait for toast notification
  await page.waitForTimeout(500);
}

/**
 * Get the right panel (inspector).
 */
export function getInspector(page: Page): Locator {
  return page.locator('aside').last();
}

/**
 * Get the left sidebar.
 */
export function getSidebar(page: Page): Locator {
  return page.locator('aside').first();
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
