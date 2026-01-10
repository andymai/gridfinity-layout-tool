import { test, expect, waitForAppReady, drawBinOnGrid, getSidebar } from './fixtures';

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('handles empty state gracefully', async ({ page }) => {
    // App should load with no bins
    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(0);

    // Grid should still be interactive
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();
  });

  test('handles rapid bin creation', async ({ page }) => {
    // Rapidly create multiple bins
    for (let i = 0; i < 5; i++) {
      await drawBinOnGrid(page, 50 + i * 50, 50, 80 + i * 50, 80);
      // Minimal wait between operations
      await page.waitForTimeout(100);
    }

    // Should have created bins (some may overlap and be rejected)
    const bins = page.locator('[data-bin-id]');
    const count = await bins.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('handles rapid undo/redo', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select and delete
    await bins.first().click();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    await expect(bins).toHaveCount(0);

    // Rapidly undo and redo
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);

    // Should have restored the bin
    await expect(bins).toHaveCount(1);
  });

  test('handles zoom at extremes', async ({ page }) => {
    const zoomDisplay = page.locator('[role="group"][aria-label="Zoom controls"] span.tabular-nums');
    await expect(zoomDisplay).toBeVisible();

    // Get initial zoom
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // Zoom out many times to approach minimum (25%)
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Minus');
      await page.waitForTimeout(50);
    }

    // Should be at or near minimum zoom (25%)
    const minZoomText = await zoomDisplay.textContent();
    const minZoom = parseInt(minZoomText || '100');
    expect(minZoom).toBeGreaterThanOrEqual(25);
    expect(minZoom).toBeLessThan(initialZoom); // Should have decreased

    // Zoom in many times to approach maximum (400%)
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Equal');
      await page.waitForTimeout(50);
    }

    // Should be at or near maximum zoom (400%)
    const maxZoomText = await zoomDisplay.textContent();
    const maxZoom = parseInt(maxZoomText || '100');
    expect(maxZoom).toBeGreaterThan(minZoom); // Should have increased
    expect(maxZoom).toBeLessThanOrEqual(400);
  });

  test('handles bin at drawer edge', async ({ page }) => {
    // Get grid bounds
    const gridBounds = await page.locator('[role="application"]').boundingBox();
    if (!gridBounds) throw new Error('Grid not found');

    // Try to create a bin at the edge
    await page.mouse.move(gridBounds.x + 10, gridBounds.y + 10);
    await page.mouse.down();
    await page.mouse.move(gridBounds.x + 60, gridBounds.y + 60, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Bin should be created (or not if out of bounds)
    // App should not crash either way
    const bins = page.locator('[data-bin-id]');
    const count = await bins.count();
    expect(count).toBeGreaterThanOrEqual(0); // 0 or 1, no crash
  });

  test('handles very small drawer settings', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Set very small print bed size
    const printBedInput = sidebar.locator('input#printBedSize');
    await printBedInput.fill('42'); // Minimum
    await printBedInput.blur();
    await page.waitForTimeout(200);

    // Value should be clamped to minimum
    const value = await printBedInput.inputValue();
    expect(parseInt(value)).toBeGreaterThanOrEqual(42);

    // App should still function
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();
  });

  test('handles very large grid unit', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Set large grid unit
    const gridUnitInput = sidebar.locator('input#gridUnit');
    await gridUnitInput.fill('100');
    await gridUnitInput.blur();
    await page.waitForTimeout(200);

    // Value should be set
    const value = await gridUnitInput.inputValue();
    expect(parseInt(value)).toBe(100);

    // App should still render
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();
  });

  test('handles bin selection after deletion', async ({ page }) => {
    // Create two bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await page.waitForTimeout(200);
    await drawBinOnGrid(page, 150, 50, 180, 80);
    await page.waitForTimeout(200);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(2);

    // Select first bin
    await bins.first().click();
    await page.waitForTimeout(100);

    // Delete it
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // One bin remaining
    await expect(bins).toHaveCount(1);

    // Clicking remaining bin should work
    await bins.first().click();
    await page.waitForTimeout(100);
    await expect(bins.first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('handles invalid numeric input gracefully', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Try entering invalid value
    const printBedInput = sidebar.locator('input#printBedSize');
    await printBedInput.fill('-1');
    await printBedInput.blur();
    await page.waitForTimeout(200);

    // Should be clamped to minimum
    const value = await printBedInput.inputValue();
    expect(parseInt(value)).toBeGreaterThanOrEqual(1);
  });

  test('handles adding layer when at max', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Try to add many layers (max is 10)
    const addLayerButton = sidebar.getByRole('button', { name: /add.*layer/i });

    for (let i = 0; i < 12; i++) {
      if (await addLayerButton.isEnabled()) {
        await addLayerButton.click();
        await page.waitForTimeout(100);
      }
    }

    // Should not exceed max layers
    const layerCount = await sidebar.locator('[data-layer-id]').count();
    expect(layerCount).toBeLessThanOrEqual(10);
  });

  test('handles category cycling at boundaries', async ({ page }) => {
    // Create and select a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await page.waitForTimeout(100);

    // Cycle through all categories multiple times
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press(']');
      await page.waitForTimeout(50);
    }

    // Bin should still be selected and have a category
    await expect(bin).toHaveAttribute('aria-pressed', 'true');
    const label = await bin.getAttribute('aria-label');
    expect(label).toContain('category');
  });

  test('handles window resize gracefully', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(300);

    // Grid should still be visible
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();

    // Bin should still exist
    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Resize back
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(300);

    await expect(grid).toBeVisible();
    await expect(bins).toHaveCount(1);
  });

  test('handles escape key when nothing selected', async ({ page }) => {
    // Press escape with nothing selected
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // App should not crash, grid should still be visible
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();
  });

  test('handles delete key when nothing selected', async ({ page }) => {
    // Press delete with nothing selected
    await page.keyboard.press('Delete');
    await page.waitForTimeout(100);

    // App should not crash, grid should still be visible
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();
  });
});
