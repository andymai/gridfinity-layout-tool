import {
  test,
  expect,
  waitForAppReady,
  getSidebar,
  clearAllStorage,
  resetViewport,
} from './fixtures';

/**
 * Settings persistence tests.
 * Note: Layout data persistence is covered in layout-library.spec.ts
 * These tests focus on UI settings that persist independently.
 */
test.describe('Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);
  });

  test.describe('Half-Bin Mode', () => {
    test('half-bin mode persists after reload', async ({ page }) => {
      const sidebar = getSidebar(page);

      // Find half-bin toggle
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-bin mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();

      // Should start unchecked
      await expect(halfBinToggle).not.toBeChecked();

      // Enable it
      await halfBinToggle.click();
      await expect(halfBinToggle).toBeChecked();

      // Wait for save (half-bin mode saves to localStorage independently)
      await page.waitForTimeout(500);

      // Reload
      await page.reload();
      await waitForAppReady(page);

      // Verify persisted
      const toggleAfterReload = getSidebar(page).getByRole('checkbox', { name: /toggle half-bin mode/i });
      await toggleAfterReload.scrollIntoViewIfNeeded();
      await expect(toggleAfterReload).toBeChecked();
    });

    test('half-bin mode defaults to disabled on fresh load', async ({ page }) => {
      const sidebar = getSidebar(page);

      // Find half-bin toggle
      const halfBinToggle = sidebar.getByRole('checkbox', { name: /toggle half-bin mode/i });
      await halfBinToggle.scrollIntoViewIfNeeded();

      // Should start unchecked on fresh load
      await expect(halfBinToggle).not.toBeChecked();
    });
  });
});
