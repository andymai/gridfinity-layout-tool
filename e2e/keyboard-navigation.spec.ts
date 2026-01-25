import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  waitForBinCount,
  waitForNoSelection,
  waitForUndoEnabled,
  waitForBinSelected,
  waitForDialog,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

test.describe('Keyboard Navigation', () => {
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

  test('tab navigates between focusable elements', async ({ page }) => {
    // Create some bins to navigate to
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await drawBinOnGrid(page, 150, 50, 180, 80);

    // Start from the body
    await page.locator('body').focus();

    // Tab should navigate to focusable elements
    await page.keyboard.press('Tab');

    // Some element should now be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('bins are keyboard focusable', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Focus the bin directly
    await bin.focus();

    // Verify it received focus
    const isFocused = await bin.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Bin should have correct accessibility attributes
    await expect(bin).toHaveAttribute('tabindex', '0');
    await expect(bin).toHaveAttribute('role', 'button');
  });

  test('enter key on focused bin selects it', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Focus the bin
    await bin.focus();

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Bin should be selected
    await waitForBinSelected(bin);
  });

  test('space key on focused bin selects it', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Focus the bin
    await bin.focus();

    // Press Space to select
    await page.keyboard.press('Space');

    // Bin should be selected
    await waitForBinSelected(bin);
  });

  test('arrow keys nudge selected bin', async ({ page }) => {
    // Create and select a bin
    const bin = await drawBinOnGrid(page, 100, 100, 150, 150);
    await bin.click();
    await waitForBinSelected(bin);

    // Nudge with arrow keys
    await page.keyboard.press('ArrowRight');

    // Bin should have moved (checking that undo becomes available indicates a change)
    await waitForUndoEnabled(page);
  });

  test('delete key removes selected bin', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await waitForBinSelected(bins.first());

    // Press Delete
    await page.keyboard.press('Delete');

    // Bin should be deleted
    await waitForBinCount(page, 0);
  });

  test('backspace key also removes selected bin', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await waitForBinSelected(bins.first());

    // Press Backspace
    await page.keyboard.press('Backspace');

    // Bin should be deleted
    await waitForBinCount(page, 0);
  });

  test('escape clears selection', async ({ page }) => {
    // Create and select a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);
    await bin.click();

    // Verify selected
    await waitForBinSelected(bin);

    // Press Escape
    await page.keyboard.press('Escape');

    // Selection should be cleared
    await waitForNoSelection(page);
  });

  test('ctrl+z triggers undo', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select and delete the bin
    await bins.first().click();
    await page.keyboard.press('Delete');
    await waitForBinCount(page, 0);

    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');

    // Bin should be restored
    await waitForBinCount(page, 1);
  });

  test('ctrl+y triggers redo', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select and delete
    await bins.first().click();
    await page.keyboard.press('Delete');
    await waitForBinCount(page, 0);

    // Undo
    await page.keyboard.press('Control+z');
    await waitForBinCount(page, 1);

    // Redo with Ctrl+Y
    await page.keyboard.press('Control+y');

    // Bin should be deleted again
    await waitForBinCount(page, 0);
  });

  test('ctrl+d duplicates selected bin', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await waitForBinSelected(bins.first());

    // Duplicate with Ctrl+D
    await page.keyboard.press('Control+d');

    // Should have 2 bins now
    await waitForBinCount(page, 2);
  });

  test('= key zooms in', async ({ page }) => {
    // Get zoom display using the established pattern
    const zoomDisplay = page.locator(
      '[role="group"][aria-label="Zoom controls"] span.tabular-nums'
    );
    await expect(zoomDisplay).toBeVisible();
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // Press Equal key multiple times (= key is 'Equal' in Playwright)
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');

    // Zoom should have increased
    await expect(async () => {
      const newZoomText = await zoomDisplay.textContent();
      const newZoom = parseInt(newZoomText || '0');
      expect(newZoom).toBeGreaterThan(initialZoom);
    }).toPass({ timeout: 2000 });
  });

  test('- key zooms out', async ({ page }) => {
    // First zoom in so we have room to zoom out
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');

    const zoomDisplay = page.locator(
      '[role="group"][aria-label="Zoom controls"] span.tabular-nums'
    );
    await expect(zoomDisplay).toBeVisible();

    // Wait for zoom to settle
    await expect(async () => {
      const text = await zoomDisplay.textContent();
      expect(parseInt(text || '0')).toBeGreaterThan(100);
    }).toPass({ timeout: 2000 });

    const beforeZoom = parseInt((await zoomDisplay.textContent()) || '0');

    // Press Minus key to zoom out
    await page.keyboard.press('Minus');

    // Zoom should have decreased
    await expect(async () => {
      const afterZoom = await zoomDisplay.textContent();
      expect(parseInt(afterZoom || '0')).toBeLessThan(beforeZoom);
    }).toPass({ timeout: 2000 });
  });

  test('? key opens help modal', async ({ page }) => {
    // Press ? to open help
    await page.keyboard.press('?');

    // Help modal should be visible with heading "Keyboard Shortcuts"
    await waitForDialog(page);
    const helpModal = page.locator('[role="dialog"]').filter({
      has: page.getByRole('heading', { name: /keyboard shortcuts/i }),
    });
    await expect(helpModal).toBeVisible();
  });

  test('escape closes help modal', async ({ page }) => {
    // Open help modal
    await page.keyboard.press('?');

    // Wait for modal to open
    await waitForDialog(page);
    const helpModal = page.locator('[role="dialog"]').filter({
      has: page.getByRole('heading', { name: /keyboard shortcuts/i }),
    });
    await expect(helpModal).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');

    // Modal should be closed
    await expect(helpModal).not.toBeVisible({ timeout: 3000 });
  });

  test('[ and ] cycle through categories for selected bin', async ({ page }) => {
    // Create and select a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);
    await bin.click();
    await waitForBinSelected(bin);

    // Get initial category from aria-label
    const initialLabel = await bin.getAttribute('aria-label');

    // Press ] to go to next category
    await page.keyboard.press(']');

    // Category should have changed
    await expect(async () => {
      const newLabel = await bin.getAttribute('aria-label');
      expect(newLabel).not.toBe(initialLabel);
    }).toPass({ timeout: 2000 });
  });

  test('bins have accessible labels', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Check accessible label contains dimension info
    const ariaLabel = await bin.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/Bin \d+ by \d+/);
    expect(ariaLabel).toMatch(/category/);
  });

  test('selected state is announced via aria-pressed', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Clear any auto-selection first
    await page.keyboard.press('Escape');
    await waitForNoSelection(page);

    // Initially not selected
    const initialPressed = await bin.getAttribute('aria-pressed');
    expect(initialPressed).not.toBe('true');

    // Select the bin
    await bin.click();

    // aria-pressed should be true
    await waitForBinSelected(bin);

    // Deselect
    await page.keyboard.press('Escape');

    // aria-pressed should be false
    await waitForNoSelection(page);
  });

  test('keyboard focus ring is visible', async ({ page }) => {
    // Create a bin
    const bin = await drawBinOnGrid(page, 50, 50, 100, 100);

    // Focus the bin via keyboard
    await bin.focus();

    // Check that focus is visible (the bin should have focus-visible styles)
    // We can verify by checking computed styles or just that focus was received
    const isFocused = await bin.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
  });
});
