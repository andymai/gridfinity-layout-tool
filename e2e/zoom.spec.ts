import type { Page } from '@playwright/test';
import { test, expect, waitForAppReady, drawBinOnGrid, getInspector } from './fixtures';

// Helper to get zoom display within zoom controls group
function getZoomDisplay(page: Page) {
  // Find the zoom controls group and get the span with percentage
  return page.locator('[role="group"][aria-label="Zoom controls"] span.tabular-nums');
}

test.describe('Zoom Controls Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('zoom controls are visible', async ({ page }) => {
    // Zoom in button
    await expect(page.getByRole('button', { name: /zoom in/i })).toBeVisible();
    // Zoom out button
    await expect(page.getByRole('button', { name: /zoom out/i })).toBeVisible();
    // Fit button
    await expect(page.getByRole('button', { name: /fit/i })).toBeVisible();
  });

  test('can zoom in with button', async ({ page }) => {
    // Get initial zoom from the percentage display
    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // Click zoom in button multiple times to ensure visible change
    const zoomInButton = page.getByRole('button', { name: /zoom in/i });
    await zoomInButton.click();
    await page.waitForTimeout(50);
    await zoomInButton.click();
    await page.waitForTimeout(50);
    await zoomInButton.click();
    await page.waitForTimeout(100);

    // Zoom should have increased
    const newZoomText = await zoomDisplay.textContent();
    const newZoom = parseInt(newZoomText || '0');
    expect(newZoom).toBeGreaterThan(initialZoom);
  });

  test('can zoom out with button', async ({ page }) => {
    // First zoom in to have room to zoom out
    const zoomInButton = page.getByRole('button', { name: /zoom in/i });
    await zoomInButton.click();
    await zoomInButton.click();
    await page.waitForTimeout(100);

    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const beforeZoom = await zoomDisplay.textContent();

    // Click zoom out button
    const zoomOutButton = page.getByRole('button', { name: /zoom out/i });
    await zoomOutButton.click();
    await page.waitForTimeout(100);

    // Zoom should have decreased
    const afterZoom = await zoomDisplay.textContent();
    expect(parseInt(afterZoom || '0')).toBeLessThan(parseInt(beforeZoom || '100'));
  });

  test('can zoom in with = key', async ({ page }) => {
    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // = key is an alternative to + for zoom in - press multiple times
    await page.keyboard.press('Equal');
    await page.waitForTimeout(50);
    await page.keyboard.press('Equal');
    await page.waitForTimeout(50);
    await page.keyboard.press('Equal');
    await page.waitForTimeout(100);

    // Zoom should have increased
    const newZoomText = await zoomDisplay.textContent();
    const newZoom = parseInt(newZoomText || '0');
    expect(newZoom).toBeGreaterThan(initialZoom);
  });

  test('can zoom out with - key', async ({ page }) => {
    // First zoom in using = key
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');
    await page.waitForTimeout(100);

    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const beforeZoom = await zoomDisplay.textContent();

    // Press - to zoom out
    await page.keyboard.press('Minus');
    await page.waitForTimeout(100);

    // Zoom should have decreased
    const afterZoom = await zoomDisplay.textContent();
    expect(parseInt(afterZoom || '0')).toBeLessThan(parseInt(beforeZoom || '100'));
  });

  test('fit to screen button adjusts zoom', async ({ page }) => {
    // Zoom in significantly
    const zoomInButton = page.getByRole('button', { name: /zoom in/i });
    for (let i = 0; i < 5; i++) {
      await zoomInButton.click();
    }
    await page.waitForTimeout(100);

    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const beforeZoom = await zoomDisplay.textContent();

    // Click fit button
    const fitButton = page.getByRole('button', { name: /fit/i });
    await fitButton.click();
    await page.waitForTimeout(200);

    // Zoom should be adjusted
    const afterZoom = await zoomDisplay.textContent();
    // After fit, zoom is optimized for the viewport
    expect(afterZoom).not.toBe(beforeZoom);
  });

  test('zoom persists bin interactions', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    expect(await page.locator('[data-bin-id]').count()).toBe(1);

    // Zoom in using = key
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');
    await page.waitForTimeout(200);

    // Bins should still be visible
    expect(await page.locator('[data-bin-id]').count()).toBe(1);

    // Click on a bin
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await page.waitForTimeout(200);

    // Inspector should show bin details
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({ timeout: 3000 });
  });

  test('+ key (with shift) also zooms in', async ({ page }) => {
    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // + requires Shift on most keyboards - press multiple times
    await page.keyboard.press('Shift+Equal');
    await page.waitForTimeout(50);
    await page.keyboard.press('Shift+Equal');
    await page.waitForTimeout(50);
    await page.keyboard.press('Shift+Equal');
    await page.waitForTimeout(100);

    // Zoom should have increased
    const newZoomText = await zoomDisplay.textContent();
    const newZoom = parseInt(newZoomText || '0');
    expect(newZoom).toBeGreaterThan(initialZoom);
  });
});
