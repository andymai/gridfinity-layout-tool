/**
 * E2E tests for the Shared Collections feature.
 *
 * Tests cover:
 * - Opening the Layout Manager modal
 * - Creating collections
 * - Joining collections (UI flow)
 * - Collection banner interactions
 * - Share dialog functionality
 *
 * Note: These tests focus on UI interactions. Server-dependent operations
 * may be mocked or limited to testing the UI flow.
 */

import {
  test,
  expect,
  waitForAppReady,
  waitForDialog,
  waitForDialogClosed,
  clearAllStorage,
  resetViewport,
} from './fixtures';

test.describe('Collections - Layout Manager Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('opens layout manager with Ctrl+O', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Should show the Layouts dialog
    await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible();
  });

  test('shows My Layouts tab with personal layouts', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // My Layouts tab should be active by default
    const myLayoutsTab = page.getByRole('tab', { name: /my layouts/i });
    await expect(myLayoutsTab).toHaveAttribute('aria-selected', 'true');

    // Should show the layout list
    await expect(page.getByRole('listbox')).toBeVisible();
  });

  test('shows Import tab with file upload option', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click on Import tab
    await page.getByRole('tab', { name: /import/i }).click();

    // Should show file drop zone
    await expect(page.getByText(/drag and drop a json file/i)).toBeVisible();

    // Should show browse files button
    await expect(page.getByRole('button', { name: /browse files/i })).toBeVisible();

    // Should show the note about importing to My Layouts
    await expect(page.getByText(/imported layouts are saved to my layouts/i)).toBeVisible();
  });

  test('shows Shared Collections section at bottom of My Layouts', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Should show Shared Collections section
    await expect(page.getByRole('heading', { name: /shared collections/i })).toBeVisible();

    // Should have Join Existing button
    await expect(page.getByRole('button', { name: /join existing/i })).toBeVisible();

    // Should have Create New button
    await expect(page.getByRole('button', { name: /create new/i })).toBeVisible();
  });

  test('closes layout manager with Escape', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    await page.keyboard.press('Escape');
    await waitForDialogClosed(page);
  });

  test('closes layout manager with close button', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    await page.getByRole('button', { name: /close layouts dialog/i }).click();
    await waitForDialogClosed(page);
  });
});

test.describe('Collections - Create Collection Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('opens Create Collection modal from Layout Manager', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Should show Create Collection modal
    await expect(page.getByRole('heading', { name: /create collection/i })).toBeVisible();
  });

  test('shows collection name input with default value', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Input should have default value based on layout name
    const input = page.getByLabel(/collection name/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(/collection/i);
  });

  test('shows option to include current layout', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Wait for Create Collection dialog
    await expect(page.getByRole('heading', { name: /create collection/i })).toBeVisible();

    // Should show checkbox for including current layout
    const createCollectionDialog = page.getByRole('dialog').filter({ hasText: 'Create Collection' });
    await expect(createCollectionDialog.getByText(/add current layout/i)).toBeVisible();

    // Checkbox should be checked by default
    // Find the checkbox within the Create Collection dialog
    const checkbox = createCollectionDialog.locator('input[type="checkbox"]');
    await expect(checkbox).toBeChecked();
  });

  test('shows Create & Copy Link button', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Should show Create & Copy Link button
    await expect(page.getByRole('button', { name: /create.*copy link/i })).toBeVisible();
  });

  test('shows info about collection expiration', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Should show info about expiration
    await expect(page.getByText(/collections expire after/i)).toBeVisible();
  });

  test('closes Create Collection modal with Escape', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Wait for Create Collection modal
    await expect(page.getByRole('heading', { name: /create collection/i })).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Should close Create Collection modal but keep Layout Manager open
    await expect(page.getByRole('heading', { name: /create collection/i })).not.toBeVisible();
    // Note: Layout Manager may also close due to Escape propagation
  });

  test('validates empty collection name', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Create New button
    await page.getByRole('button', { name: /create new/i }).click();

    // Clear the input
    const input = page.getByLabel(/collection name/i);
    await input.fill('');

    // Create button should be disabled
    const createButton = page.getByRole('button', { name: /create.*copy link/i });
    await expect(createButton).toBeDisabled();
  });
});

test.describe('Collections - Join Collection Modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('opens Join Collection modal from Layout Manager', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Join Existing button
    await page.getByRole('button', { name: /join existing/i }).click();

    // Should show Join Collection modal
    await expect(page.getByRole('heading', { name: /join collection/i })).toBeVisible();
  });

  test('shows input for collection URL or ID', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Join Existing button
    await page.getByRole('button', { name: /join existing/i }).click();

    // Should show input field
    const input = page.getByLabel(/collection url or id/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', /abc123def456/);
  });

  test('shows Join Collection button', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Join Existing button
    await page.getByRole('button', { name: /join existing/i }).click();

    // Join button should be present but disabled when input is empty
    const joinButton = page.getByRole('button', { name: /^join collection$/i });
    await expect(joinButton).toBeVisible();
    await expect(joinButton).toBeDisabled();
  });

  test('enables Join button when URL is entered', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Join Existing button
    await page.getByRole('button', { name: /join existing/i }).click();

    // Enter a collection ID
    const input = page.getByLabel(/collection url or id/i);
    await input.fill('abc123def456');

    // Join button should be enabled
    const joinButton = page.getByRole('button', { name: /^join collection$/i });
    await expect(joinButton).toBeEnabled();
  });

  test('shows error for invalid collection ID format', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Join Existing button
    await page.getByRole('button', { name: /join existing/i }).click();

    // Enter an invalid ID (too short)
    const input = page.getByLabel(/collection url or id/i);
    await input.fill('abc');

    // Click Join button
    const joinButton = page.getByRole('button', { name: /^join collection$/i });
    await joinButton.click();

    // Should show validation error
    await expect(page.getByText(/valid collection url or id/i)).toBeVisible();
  });

  test('closes Join Collection modal with Cancel', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click Join Existing button
    await page.getByRole('button', { name: /join existing/i }).click();

    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click();

    // Should close Join modal
    await expect(page.getByRole('heading', { name: /join collection/i })).not.toBeVisible();
  });
});

test.describe('Collections - Layout Manager with multiple layouts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    // Close any lingering dialogs
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('can create a new layout from Layout Manager', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Click "New Layout" button
    await page.getByRole('button', { name: /new layout/i }).click();

    // Modal should close and show new layout
    await waitForDialogClosed(page);

    // New layout should be created (name would be "Untitled")
    await expect(page.getByRole('button', { name: /untitled/i })).toBeVisible();
  });

  test('shows active layout indicator', async ({ page }) => {
    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // The current layout should have "Active" indicator
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('can duplicate a layout', async ({ page }) => {
    // First create a layout with a known name
    const layoutNameButton = page.getByRole('button', { name: /untitled/i });
    await layoutNameButton.click();
    const input = page.locator('header input[type="text"]');
    await input.fill('Original Layout');
    await input.press('Enter');

    // Wait for name to be displayed
    await expect(page.getByRole('button', { name: 'Original Layout' })).toBeVisible();

    // Open Layout Manager
    await page.keyboard.press('Control+o');
    await waitForDialog(page);

    // Find the layout item
    const layoutItem = page.locator('[role="option"]').filter({ hasText: 'Original Layout' });
    await expect(layoutItem).toBeVisible();

    // Find and click the more actions button (overflow menu)
    const moreActionsButton = layoutItem.getByRole('button', { name: /more actions/i });
    await moreActionsButton.click();

    // Click Duplicate in the dropdown menu
    const duplicateMenuItem = page.getByRole('menuitem', { name: /duplicate/i });
    await duplicateMenuItem.click();

    // Should show the duplicated layout with "(copy)" suffix
    await expect(page.getByText(/original layout.*copy/i)).toBeVisible();
  });
});
