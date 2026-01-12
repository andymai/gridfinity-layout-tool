import {
  test,
  expect,
  MOBILE_VIEWPORT,
  waitForMobileAppReady,
  getBottomNav,
  getGridBounds,
  waitForBinCount,
  waitForDialog,
  waitForDialogClosed,
  waitForBinSelected,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Mobile Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForMobileAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    // CRITICAL: Reset viewport after mobile tests to prevent pollution
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
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

    // Bottom sheet should open - look for the dialog
    await waitForDialog(page);
    const sheet = page.locator('[role="dialog"]');

    // Sheet should contain layer management content - look for "Add layer" button
    await expect(sheet.getByRole('button', { name: /add.*layer/i })).toBeVisible();
  });

  test('can open categories panel from bottom nav', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Tap categories button
    await bottomNav.getByRole('button', { name: /categories panel/i }).click();

    // Bottom sheet should open
    await waitForDialog(page);
    const sheet = page.locator('[role="dialog"]');

    // Should see default categories in the sheet
    await expect(sheet.getByText('Coral')).toBeVisible();
  });

  test('can close bottom sheet with escape key', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Open layers panel
    await bottomNav.getByRole('button', { name: /layers panel/i }).click();

    // Sheet should be visible
    await waitForDialog(page);

    // Close using Escape key
    await page.keyboard.press('Escape');

    // Sheet should be closed
    await waitForDialogClosed(page);
  });

  test('can add bin by tapping on grid', async ({ page }) => {
    // Get grid bounds and tap to create a bin
    const bounds = await getGridBounds(page);

    // Tap on grid to add a 1x1 bin
    await page.mouse.click(bounds.x + 50, bounds.y + 50);

    // Should have created a bin
    await waitForBinCount(page, 1);
  });

  test('bin panel shows selected bin details', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // First create a bin by clicking on grid
    const bounds = await getGridBounds(page);
    await page.mouse.click(bounds.x + 50, bounds.y + 50);

    // Wait for bin to appear
    await waitForBinCount(page, 1);
    const bin = page.locator('[data-bin-id]').first();

    // Click on the bin to select it
    await bin.click();
    await waitForBinSelected(bin);

    // Open Bin panel via bottom nav
    await bottomNav.getByRole('button', { name: /bin panel/i }).click();

    // Inspector should open in bottom sheet showing bin details
    await waitForDialog(page);
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet.getByRole('heading', { name: /^\d×\d Bin$/ })).toBeVisible({ timeout: 5000 });
  });

  test('switching panels via escape and reopen', async ({ page }) => {
    const bottomNav = getBottomNav(page);

    // Open layers panel
    await bottomNav.getByRole('button', { name: /layers panel/i }).click();

    // Verify layers panel is open
    await waitForDialog(page);
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet.getByRole('button', { name: /add.*layer/i })).toBeVisible();

    // Close the sheet via Escape key (sheet intercepts nav clicks when open)
    await page.keyboard.press('Escape');
    await waitForDialogClosed(page);

    // Now open categories
    await bottomNav.getByRole('button', { name: /categories panel/i }).click();

    // Categories should now be visible
    await waitForDialog(page);
    await expect(sheet.getByText('Coral')).toBeVisible();
  });

  test('mobile settings panel is accessible', async ({ page }) => {
    // Look for settings/menu button in header
    const settingsButton = page.getByRole('button', { name: /settings|menu/i }).first();
    if (await settingsButton.isVisible()) {
      await settingsButton.click();

      // Settings panel should show drawer settings
      await waitForDialog(page);
    }
  });

  test('mobile help modal can be opened', async ({ page }) => {
    // Look for help button
    const helpButton = page.getByRole('button', { name: /help|\?/i }).first();
    if (await helpButton.isVisible()) {
      await helpButton.click();

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
    await waitForDialog(page);

    // Layers tab should now be active (has aria-pressed="true")
    await expect(layersTab).toHaveAttribute('aria-pressed', 'true');

    // And panel should be open - look for Add Layer button which is unique to layers panel
    const sheet = page.locator('[role="dialog"]');
    await expect(sheet.getByRole('button', { name: /add.*layer/i })).toBeVisible();
  });
});
