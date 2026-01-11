import {
  test,
  expect,
  waitForAppReady,
  waitForDialog,
} from './fixtures';

test.describe('Create Layout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('shows default layout on first load', async ({ page }) => {
    // Should display the default layout name
    await expect(page.getByRole('button', { name: 'Untitled layout' })).toBeVisible();

    // Should have the header with undo/redo buttons
    await expect(page.getByRole('button', { name: /undo/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /redo/i })).toBeVisible();

    // Should have the Tools sidebar
    await expect(page.getByRole('heading', { name: 'Tools' })).toBeVisible();
  });

  test('can edit layout name', async ({ page }) => {
    // Click on the layout name to edit
    const layoutNameButton = page.getByRole('button', { name: 'Untitled layout' });
    await layoutNameButton.click();

    // Should show an input field
    const input = page.locator('header input[type="text"]');
    await expect(input).toBeVisible();

    // Clear and type new name
    await input.fill('My Drawer Layout');
    await input.press('Enter');

    // Should show the new name
    await expect(page.getByRole('button', { name: 'My Drawer Layout' })).toBeVisible();
  });

  test('shows help modal with keyboard shortcut', async ({ page }) => {
    // Press ? key to open help (Shift+/ on US keyboard)
    await page.keyboard.press('?');

    // Wait for help modal with title "Help & Shortcuts"
    await waitForDialog(page);
    const modal = page.locator('[role="dialog"]').filter({
      has: page.getByRole('heading', { name: /help/i })
    });
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Close modal by pressing Escape
    await page.keyboard.press('Escape');

    // Modal should be hidden
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('persists layout to localStorage', async ({ page }) => {
    // Edit layout name
    const layoutNameButton = page.getByRole('button', { name: 'Untitled layout' });
    await layoutNameButton.click();
    const input = page.locator('header input[type="text"]');
    await input.fill('Persisted Layout');
    await input.press('Enter');

    // Wait for auto-save (debounced) - longer wait to ensure persistence
    await page.waitForTimeout(2000);

    // Reload page (DON'T clear localStorage this time since we want to test persistence)
    await page.reload();
    await waitForAppReady(page);

    // Should still show the custom name
    await expect(page.getByRole('button', { name: 'Persisted Layout' })).toBeVisible({ timeout: 5000 });
  });
});
