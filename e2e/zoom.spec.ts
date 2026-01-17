import type { Page } from '@playwright/test';
import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  getInspector,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

// Helper to get zoom display within zoom controls group
function getZoomDisplay(page: Page) {
  // Find the zoom controls group and get the span with percentage
  return page.locator('[role="group"][aria-label="Zoom controls"] span.tabular-nums');
}

// Helper to wait for zoom to change
async function waitForZoomChange(page: Page, previousZoom: number, direction: 'increase' | 'decrease') {
  const zoomDisplay = getZoomDisplay(page);
  await expect(async () => {
    const text = await zoomDisplay.textContent();
    const currentZoom = parseInt(text || '0');
    if (direction === 'increase') {
      expect(currentZoom).toBeGreaterThan(previousZoom);
    } else {
      expect(currentZoom).toBeLessThan(previousZoom);
    }
  }).toPass({ timeout: 2000 });
}

test.describe('Zoom Controls Flow', () => {
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
    await zoomInButton.click();
    await zoomInButton.click();

    // Wait for zoom to increase
    await waitForZoomChange(page, initialZoom, 'increase');
  });

  test('can zoom out with button', async ({ page }) => {
    // First zoom in to have room to zoom out
    const zoomInButton = page.getByRole('button', { name: /zoom in/i });
    await zoomInButton.click();
    await zoomInButton.click();

    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();

    // Wait briefly for zoom to settle, then get value
    await expect(async () => {
      const text = await zoomDisplay.textContent();
      expect(parseInt(text || '0')).toBeGreaterThan(100);
    }).toPass({ timeout: 2000 });

    const beforeZoom = parseInt(await zoomDisplay.textContent() || '0');

    // Click zoom out button
    const zoomOutButton = page.getByRole('button', { name: /zoom out/i });
    await zoomOutButton.click();

    // Wait for zoom to decrease
    await waitForZoomChange(page, beforeZoom, 'decrease');
  });

  test('can zoom in with = key', async ({ page }) => {
    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // = key is an alternative to + for zoom in - press multiple times
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');

    // Wait for zoom to increase
    await waitForZoomChange(page, initialZoom, 'increase');
  });

  test('can zoom out with - key', async ({ page }) => {
    // First zoom in using = key
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');

    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();

    // Wait for zoom to settle
    await expect(async () => {
      const text = await zoomDisplay.textContent();
      expect(parseInt(text || '0')).toBeGreaterThan(100);
    }).toPass({ timeout: 2000 });

    const beforeZoom = parseInt(await zoomDisplay.textContent() || '0');

    // Press - to zoom out
    await page.keyboard.press('Minus');

    // Wait for zoom to decrease
    await waitForZoomChange(page, beforeZoom, 'decrease');
  });

  test('fit to screen button adjusts zoom', async ({ page }) => {
    // Zoom in significantly
    const zoomInButton = page.getByRole('button', { name: /zoom in/i });
    for (let i = 0; i < 5; i++) {
      await zoomInButton.click();
    }

    const zoomDisplay = getZoomDisplay(page);
    await expect(zoomDisplay).toBeVisible();

    // Wait for zoom to settle and get value
    await expect(async () => {
      const text = await zoomDisplay.textContent();
      expect(parseInt(text || '0')).toBeGreaterThan(100);
    }).toPass({ timeout: 2000 });

    const beforeZoom = await zoomDisplay.textContent();

    // Click fit button
    const fitButton = page.getByRole('button', { name: /fit/i });
    await fitButton.click();

    // Zoom should be adjusted - wait for change
    await expect(async () => {
      const afterZoom = await zoomDisplay.textContent();
      expect(afterZoom).not.toBe(beforeZoom);
    }).toPass({ timeout: 2000 });
  });

  test('zoom persists bin interactions', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Zoom in using = key
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');

    // Bins should still be visible
    await expect(page.locator('[data-bin-id]')).toHaveCount(1);

    // Click on a bin to select it
    await bin.click();

    // Verify bin is selected
    await waitForBinSelected(bin);

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
    await page.keyboard.press('Shift+Equal');
    await page.keyboard.press('Shift+Equal');

    // Wait for zoom to increase
    await waitForZoomChange(page, initialZoom, 'increase');
  });
});
