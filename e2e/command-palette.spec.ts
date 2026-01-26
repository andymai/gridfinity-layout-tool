import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  waitForBinCount,
  waitForBinSelected,
  waitForDialog,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
  waitForNoSelection,
} from './fixtures';

test.describe('Command Palette', () => {
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

  test.describe('Opening and Closing', () => {
    test('opens with Ctrl+K', async ({ page }) => {
      await page.keyboard.press('Control+k');

      // Command palette should be visible
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();
    });

    test('opens with Meta+K on Mac', async ({ page }) => {
      // Simulate Mac key combo
      await page.keyboard.press('Meta+k');

      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();
    });

    test('closes with Escape', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      await page.keyboard.press('Escape');
      await expect(palette).not.toBeVisible();
    });

    test('closes when clicking outside', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      // Click on the backdrop
      await page.locator('.bg-black\\/60').click({ position: { x: 10, y: 10 } });
      await expect(palette).not.toBeVisible();
    });

    test('does not open when typing in input field', async ({ page }) => {
      // Open help modal which has a search input
      await page.keyboard.press('?');
      await waitForDialog(page);

      // Focus the search input
      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await searchInput.focus();

      // Try Ctrl+K while focused on input
      await page.keyboard.press('Control+k');

      // Command palette should NOT open (cmdk root should not be visible outside of help modal)
      const palette = page.locator('[cmdk-root]');
      await expect(palette).not.toBeVisible();
    });
  });

  test.describe('Search and Navigation', () => {
    test('filters commands as you type', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      // Type to filter
      await page.keyboard.type('undo');

      // Should show undo command
      const undoItem = palette.locator('[cmdk-item]', { hasText: /undo/i });
      await expect(undoItem).toBeVisible();

      // Should not show unrelated commands like "zoom"
      const zoomItem = palette.locator('[cmdk-item]', { hasText: /zoom in/i });
      await expect(zoomItem).not.toBeVisible();
    });

    test('shows empty state when no results', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      // Type nonsense query
      await page.keyboard.type('xyznonexistent123');

      // Should show empty state
      const emptyState = palette.locator('[cmdk-empty]');
      await expect(emptyState).toBeVisible();
    });

    test('navigates with arrow keys', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      // Get first item
      const firstItem = palette.locator('[cmdk-item]').first();
      await expect(firstItem).toHaveAttribute('data-selected', 'true');

      // Press down arrow
      await page.keyboard.press('ArrowDown');

      // First item should no longer be selected
      await expect(firstItem).not.toHaveAttribute('data-selected', 'true');

      // Second item should be selected
      const secondItem = palette.locator('[cmdk-item]').nth(1);
      await expect(secondItem).toHaveAttribute('data-selected', 'true');
    });

    test('clears search with input clear or new search', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');

      // Type and verify filtering
      await page.keyboard.type('zoom');
      const input = palette.locator('input[cmdk-input]');
      await expect(input).toHaveValue('zoom');

      // Clear with select all + delete
      await page.keyboard.press('Control+a');
      await page.keyboard.press('Backspace');

      await expect(input).toHaveValue('');
    });
  });

  test.describe('Command Execution', () => {
    test('executes undo command', async ({ page }) => {
      // Create a bin first
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);

      // Delete the bin to create undo history
      const bin = page.locator('[data-bin-id]').first();
      await bin.click();
      await page.keyboard.press('Delete');
      await waitForBinCount(page, 0);

      // Open command palette and run undo
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      await page.keyboard.type('undo');
      await page.keyboard.press('Enter');

      // Bin should be restored
      await waitForBinCount(page, 1);
    });

    test('executes zoom in command', async ({ page }) => {
      // Get initial zoom level
      const zoomDisplay = page.locator(
        '[role="group"][aria-label="Zoom controls"] span.tabular-nums'
      );
      await expect(zoomDisplay).toBeVisible();
      const initialZoom = parseInt((await zoomDisplay.textContent()) || '100');

      // Open command palette and zoom in
      await page.keyboard.press('Control+k');
      await page.keyboard.type('zoom in');
      await page.keyboard.press('Enter');

      // Zoom should increase
      await expect(async () => {
        const newZoom = parseInt((await zoomDisplay.textContent()) || '0');
        expect(newZoom).toBeGreaterThan(initialZoom);
      }).toPass({ timeout: 2000 });
    });

    test('executes delete selected command', async ({ page }) => {
      // Create and select a bin
      const bin = await drawBinOnGrid(page, 50, 50, 100, 100);
      await bin.click();
      await waitForBinSelected(bin);

      // Open command palette and delete
      await page.keyboard.press('Control+k');
      await page.keyboard.type('delete');
      await page.keyboard.press('Enter');

      // Bin should be deleted
      await waitForBinCount(page, 0);
    });

    test('executes duplicate command', async ({ page }) => {
      // Create and select a bin
      const bin = await drawBinOnGrid(page, 50, 50, 100, 100);
      await bin.click();
      await waitForBinSelected(bin);

      // Open command palette and duplicate
      await page.keyboard.press('Control+k');
      await page.keyboard.type('duplicate');
      await page.keyboard.press('Enter');

      // Should have 2 bins now
      await waitForBinCount(page, 2);
    });

    test('executes clear selection command', async ({ page }) => {
      // Create and select a bin
      const bin = await drawBinOnGrid(page, 50, 50, 100, 100);
      await bin.click();
      await waitForBinSelected(bin);

      // Open command palette and clear selection
      await page.keyboard.press('Control+k');
      await page.keyboard.type('clear selection');
      await page.keyboard.press('Enter');

      // No bins should be selected
      await waitForNoSelection(page);
    });

    test('executes toggle 3D preview command', async ({ page }) => {
      // 3D preview might be visible or hidden initially
      const previewContainer = page.locator('[data-3d-preview]');
      const wasVisible = await previewContainer.isVisible().catch(() => false);

      // Open command palette and toggle preview
      await page.keyboard.press('Control+k');
      await page.keyboard.type('toggle 3d');
      await page.keyboard.press('Enter');

      // Preview visibility should have toggled
      if (wasVisible) {
        await expect(previewContainer).not.toBeVisible({ timeout: 3000 });
      } else {
        await expect(previewContainer).toBeVisible({ timeout: 3000 });
      }
    });

    test('executes open layout manager command', async ({ page }) => {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('layout manager');
      await page.keyboard.press('Enter');

      // Layout manager modal should open
      await waitForDialog(page);
      const layoutManager = page.locator('[role="dialog"]').filter({
        has: page.getByRole('heading', { name: /layouts/i }),
      });
      await expect(layoutManager).toBeVisible();
    });

    test('executes open print modal command', async ({ page }) => {
      await page.keyboard.press('Control+k');
      await page.keyboard.type('print');
      await page.keyboard.press('Enter');

      // Print modal should open
      await waitForDialog(page);
      const printModal = page.locator('[role="dialog"]').filter({
        has: page.getByRole('heading', { name: /print/i }),
      });
      await expect(printModal).toBeVisible();
    });
  });

  test.describe('Contextual Commands', () => {
    test('undo command works after making changes', async ({ page }) => {
      // Create a bin to have undo history
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);

      // Delete the bin
      const bin = page.locator('[data-bin-id]').first();
      await bin.click();
      await page.keyboard.press('Delete');
      await waitForBinCount(page, 0);

      // Open command palette and undo
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      await page.keyboard.type('undo');
      await page.keyboard.press('Enter');

      // Bin should be restored
      await waitForBinCount(page, 1);
    });

    test('delete command requires selection to execute', async ({ page }) => {
      // Create a bin but don't select it
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);

      // Deselect
      await page.keyboard.press('Escape');
      await waitForNoSelection(page);

      // Open command palette and try delete
      await page.keyboard.press('Control+k');
      await page.keyboard.type('delete selected');

      // Press enter - should NOT delete since nothing is selected
      await page.keyboard.press('Enter');

      // Bin should still exist
      await waitForBinCount(page, 1);
    });

    test('duplicate command works when bin is selected', async ({ page }) => {
      // Create and select a bin
      const bin = await drawBinOnGrid(page, 50, 50, 100, 100);
      await bin.click();
      await waitForBinSelected(bin);

      // Open command palette and duplicate
      await page.keyboard.press('Control+k');
      await page.keyboard.type('duplicate');
      await page.keyboard.press('Enter');

      // Should have 2 bins now
      await waitForBinCount(page, 2);
    });
  });

  test.describe('Recent Commands', () => {
    test('shows recently used commands at top', async ({ page }) => {
      // Execute a command first
      await page.keyboard.press('Control+k');
      await page.keyboard.type('zoom in');
      await page.keyboard.press('Enter');

      // Wait for palette to close
      const palette = page.locator('[cmdk-root]');
      await expect(palette).not.toBeVisible();

      // Reopen palette
      await page.keyboard.press('Control+k');
      await expect(palette).toBeVisible();

      // Recent section should show our command
      const recentGroup = palette.locator('[cmdk-group]', { hasText: /recent/i });
      await expect(recentGroup).toBeVisible();

      const recentZoom = recentGroup.locator('[cmdk-item]', { hasText: /zoom in/i });
      await expect(recentZoom).toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts Display', () => {
    test('shows keyboard shortcuts for commands', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');

      // Find a command that has a shortcut (like Undo)
      await page.keyboard.type('undo');
      const undoItem = palette.locator('[cmdk-item]', { hasText: /undo/i });

      // Should show the keyboard shortcut (Ctrl+Z or ⌘Z)
      const shortcutBadge = undoItem.locator('kbd, [class*="font-mono"]');
      await expect(shortcutBadge.first()).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('has proper ARIA attributes', async ({ page }) => {
      await page.keyboard.press('Control+k');
      const palette = page.locator('[cmdk-root]');
      await expect(palette).toBeVisible();

      // cmdk provides accessibility - input should have combobox role
      const input = palette.locator('input[cmdk-input]');
      await expect(input).toBeVisible();

      // List should have proper role
      const list = palette.locator('[cmdk-list]');
      await expect(list).toHaveAttribute('role', 'listbox');

      // Items should have option role
      const items = palette.locator('[cmdk-item]');
      await expect(items.first()).toHaveAttribute('role', 'option');
    });

    test('input is focused when opened', async ({ page }) => {
      await page.keyboard.press('Control+k');

      // Input should be focused
      const input = page.locator('input[cmdk-input]');
      await expect(input).toBeFocused();
    });

    test('supports keyboard-only navigation', async ({ page }) => {
      await page.keyboard.press('Control+k');

      // Type to filter
      await page.keyboard.type('zoom');

      // Navigate with arrow keys
      await page.keyboard.press('ArrowDown');

      // Execute with Enter
      await page.keyboard.press('Enter');

      // Palette should close after execution
      const palette = page.locator('[cmdk-root]');
      await expect(palette).not.toBeVisible();
    });
  });
});
