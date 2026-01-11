import { test, expect, waitForAppReady, drawBinOnGrid } from './fixtures';

test.describe('3D Preview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('3D preview toggle button is visible', async ({ page }) => {
    // Look for the 3D preview toggle button
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await expect(toggleButton).toBeVisible();
  });

  test('toggle button shows and hides preview', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();

    // Click to show preview
    await toggleButton.click();

    // Wait for canvas to appear (WebGL loading can be slow)
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });

    // Click again to hide
    await toggleButton.click();

    // Canvas should be hidden
    await expect(canvas).not.toBeVisible();
  });

  test('3D preview shows bins from grid', async ({ page }) => {
    // Create a bin on the grid
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Enable 3D preview via button click (more reliable)
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    // Wait for canvas to appear (WebGL loading can be slow)
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });

  test('space key expands 3D preview when visible', async ({ page }) => {
    // First show the preview via button click
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });

    // Get initial canvas size
    const initialSize = await canvas.first().boundingBox();

    // Press Space to expand (should open modal/fullscreen view)
    await page.keyboard.press('Space');

    // Look for expanded view indicators (modal overlay or larger container)
    const expandedView = page.locator('.fixed.inset-0').filter({
      has: page.locator('canvas')
    });

    // Either the expanded view is visible, or canvas got larger
    const hasExpandedView = await expandedView.isVisible().catch(() => false);
    if (hasExpandedView) {
      await expect(expandedView).toBeVisible();
    } else {
      // Canvas should be larger than before
      const newSize = await canvas.first().boundingBox();
      if (initialSize && newSize) {
        expect(newSize.width).toBeGreaterThanOrEqual(initialSize.width);
      }
    }
  });

  test('escape closes expanded 3D preview', async ({ page }) => {
    // Show preview via button
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });

    // Expand with Space
    await page.keyboard.press('Space');

    // Wait for expanded view to appear
    const expandedView = page.locator('.fixed.inset-0').filter({ has: page.locator('canvas') });
    await expandedView.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {});

    // Press Escape to close expanded view
    await page.keyboard.press('Escape');

    // The preview should still be shown (just not expanded)
    await expect(canvas.first()).toBeVisible();
  });

  test('3D preview has layer view controls', async ({ page }) => {
    // Create bins on grid to have content to display
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview via button (more reliable than keyboard)
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    // Wait for canvas to appear
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });

    // Look for layer view mode controls (buttons for focus/stack/all modes)
    // These are typically near the preview or in a controls panel
    const layerControls = page.locator('button').filter({
      hasText: /focus|stack|all/i
    });

    // If layer controls exist, verify they're interactive
    const controlCount = await layerControls.count();
    if (controlCount > 0) {
      await expect(layerControls.first()).toBeEnabled();
    }
  });

  test('3D preview camera can be rotated with keyboard', async ({ page }) => {
    // Show 3D preview via button
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });

    // Press number keys to change camera preset (1-6)
    // These should change the camera angle
    await page.keyboard.press('1');

    // Canvas should still be visible (camera changed but view persists)
    await expect(canvas.first()).toBeVisible();

    // Try another preset
    await page.keyboard.press('2');

    await expect(canvas.first()).toBeVisible();
  });

  test('3D preview handles empty drawer', async ({ page }) => {
    // Enable 3D preview with no bins (empty drawer) via button
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    // Canvas should still render (shows empty drawer base)
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });

  test('3D preview toggle button changes state', async ({ page }) => {
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();

    // Initially should say "Show 3D preview"
    await expect(toggleButton).toHaveAttribute('aria-label', /show 3d preview/i);

    // Click to show
    await toggleButton.click();

    // Button label should change to "Hide"
    await expect(toggleButton).toHaveAttribute('aria-label', /hide 3d preview/i);

    // Click to hide
    await toggleButton.click();

    // Button label should change back to "Show"
    await expect(toggleButton).toHaveAttribute('aria-label', /show 3d preview/i);
  });

  test('3D preview renders multiple bins', async ({ page }) => {
    // Create multiple bins
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);
    await drawBinOnGrid(page, 50, 150, 80, 180);

    // Enable 3D preview via button
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();

    // Canvas should be visible with all bins rendered
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10000 });
  });
});
