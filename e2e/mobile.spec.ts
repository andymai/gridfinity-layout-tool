import { test, expect, MOBILE_VIEWPORT, waitForMobileAppReady, getBottomNav, getGridBounds } from './fixtures';

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForMobileAppReady(page);
  });

  test('shows mobile layout on small viewport', async ({ page }) => {
    // Bottom navigation should be visible (mobile-only component)
    const bottomNav = getBottomNav(page);
    await expect(bottomNav).toBeVisible();

    // Should have the navigation tabs (aria-label includes "panel")
    await expect(bottomNav.getByRole('button', { name: /layers panel/i })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: /categories panel/i })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: /bin panel/i })).toBeVisible();
  });

  test('mobile header shows layout name', async ({ page }) => {
    // Mobile header should show the layout name
    await expect(page.getByText('Untitled layout')).toBeVisible();
  });

  test('can open layers panel from bottom nav', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Tap layers button
    await bottomNav.getByRole('button', { name: /layers panel/i }).click();
    await page.waitForTimeout(300);

    // Bottom sheet should open - look for the dialog
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();

    // Sheet should contain layer management content - look for "Add layer" button
    await expect(sheet.getByRole('button', { name: /add.*layer/i })).toBeVisible();
  });

  test('can open categories panel from bottom nav', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Tap categories button
    await bottomNav.getByRole('button', { name: /categories panel/i }).click();
    await page.waitForTimeout(300);

    // Bottom sheet should open
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();

    // Should see default categories in the sheet
    await expect(sheet.getByText('Coral')).toBeVisible();
  });

  test('can close bottom sheet with escape key', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Open layers panel
    await bottomNav.getByRole('button', { name: /layers panel/i }).click();
    await page.waitForTimeout(300);

    // Sheet should be visible
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();

    // Close using Escape key
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Sheet should be closed
    await expect(sheet).not.toBeVisible();
  });

  test('can add bin by tapping on grid', async ({ page }) => {
    // Get grid bounds and tap to create a bin
    const bounds = await getGridBounds(page);

    // Tap on grid to add a 1x1 bin
    await page.mouse.click(bounds.x + 50, bounds.y + 50);
    await page.waitForTimeout(200);

    // Should have created a bin
    const bins = page.locator('[data-bin-id]');
    const count = await bins.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('bin panel shows selected bin details', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // First create a bin
    const bounds = await getGridBounds(page);
    await page.mouse.click(bounds.x + 50, bounds.y + 50);
    await page.waitForTimeout(200);

    // Click on the bin to select it
    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await page.waitForTimeout(100);

    // Open Bin panel via bottom nav
    await bottomNav.getByRole('button', { name: /bin panel/i }).click();
    await page.waitForTimeout(300);

    // Inspector should open in bottom sheet showing bin details
    // The bin size is in an h3 tag with format "1×1 Bin"
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible({ timeout: 3000 });
    await expect(sheet.locator('h3').filter({ hasText: /^\d×\d Bin$/ })).toBeVisible();
  });

  test('switching panels via escape and reopen', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Open layers panel
    await bottomNav.getByRole('button', { name: /layers panel/i }).click();
    await page.waitForTimeout(300);

    // Verify layers panel is open
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('button', { name: /add.*layer/i })).toBeVisible();

    // Close the sheet via Escape key (sheet intercepts nav clicks when open)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(sheet).not.toBeVisible();

    // Now open categories
    await bottomNav.getByRole('button', { name: /categories panel/i }).click();
    await page.waitForTimeout(300);

    // Categories should now be visible
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Coral')).toBeVisible();
  });

  test('mobile settings panel is accessible', async ({ page }) => {
    // Look for settings/menu button in header
    const settingsButton = page.getByRole('button', { name: /settings|menu/i }).first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(300);

      // Settings panel should show drawer settings
      const sheet = page.locator('[role="dialog"]');
      await expect(sheet).toBeVisible();
    }
  });

  test('mobile help modal can be opened', async ({ page }) => {
    // Look for help button
    const helpButton = page.getByRole('button', { name: /help|\?/i }).first();
    if (await helpButton.isVisible()) {
      await helpButton.click();
      await page.waitForTimeout(300);

      // Help modal should be visible
      await expect(page.getByText(/touch gestures|keyboard shortcuts/i)).toBeVisible({ timeout: 3000 });

      // Close it
      await page.keyboard.press('Escape');
    }
  });

  test('grid is scrollable/pannable on mobile', async ({ page }) => {
    // Verify the grid is visible and can be interacted with
    const grid = page.locator('[role="application"]');
    await expect(grid).toBeVisible();

    // Grid should have reasonable dimensions
    const bounds = await grid.boundingBox();
    expect(bounds?.width).toBeGreaterThan(100);
    expect(bounds?.height).toBeGreaterThan(100);
  });

  test('bottom nav highlights active tab', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Click layers
    const layersTab = bottomNav.getByRole('button', { name: /layers panel/i });
    await layersTab.click();
    await page.waitForTimeout(300);

    // Layers tab should now be active (has aria-pressed="true")
    await expect(layersTab).toHaveAttribute('aria-pressed', 'true');

    // And panel should be open - look for Add Layer button which is unique to layers panel
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet.getByRole('button', { name: /add.*layer/i })).toBeVisible();
  });
});
