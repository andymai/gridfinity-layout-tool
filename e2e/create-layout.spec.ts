import { test, expect, waitForAppReady } from './fixtures';

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

  test('can reset layout to defaults', async ({ page }) => {
    // First, edit the layout name
    const layoutNameButton = page.getByRole('button', { name: 'Untitled layout' });
    await layoutNameButton.click();
    const input = page.locator('header input[type="text"]');
    await input.fill('Custom Name');
    await input.press('Enter');

    // Click reset button (specific one, not Reset View)
    const resetButton = page.getByRole('button', { name: 'Reset layout to defaults' });
    await resetButton.click();

    // Confirm reset in dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Reset', exact: true }).click();

    // Should be back to default name
    await expect(page.getByRole('button', { name: 'Untitled layout' })).toBeVisible();
  });

  test('shows help modal with keyboard shortcut', async ({ page }) => {
    // Press ? key to open help
    await page.keyboard.press('Shift+?');
    await page.waitForTimeout(200);

    // Should show keyboard shortcuts modal - look for the dialog container
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 3000 });

    // Should show the modal title
    await expect(page.getByText('Keyboard Shortcuts').first()).toBeVisible();

    // Close modal by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Modal should be hidden
    await expect(modal).not.toBeVisible();
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
