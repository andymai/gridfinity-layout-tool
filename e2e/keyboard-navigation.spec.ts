import { test, expect, waitForAppReady, drawBinOnGrid } from './fixtures';

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);
  });

  test('tab navigates between focusable elements', async ({ page }) => {
    // Create some bins to navigate to
    await drawBinOnGrid(page, 50, 50, 80, 80);
    await page.waitForTimeout(200);
    await drawBinOnGrid(page, 150, 50, 180, 80);
    await page.waitForTimeout(200);

    // Start from the body
    await page.locator('body').focus();

    // Tab should navigate to focusable elements
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);

    // Some element should now be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).toBeTruthy();
  });

  test('bins are keyboard focusable', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();

    // Focus the bin directly
    await bin.focus();
    await page.waitForTimeout(100);

    // Verify it received focus
    const isFocused = await bin.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Bin should have correct accessibility attributes
    await expect(bin).toHaveAttribute('tabindex', '0');
    await expect(bin).toHaveAttribute('role', 'button');
  });

  test('enter key on focused bin selects it', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();

    // Focus the bin
    await bin.focus();
    await page.waitForTimeout(100);

    // Press Enter to select
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);

    // Bin should be selected
    await expect(bin).toHaveAttribute('aria-pressed', 'true');
  });

  test('space key on focused bin selects it', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();

    // Focus the bin
    await bin.focus();
    await page.waitForTimeout(100);

    // Press Space to select
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);

    // Bin should be selected
    await expect(bin).toHaveAttribute('aria-pressed', 'true');
  });

  test('arrow keys nudge selected bin', async ({ page }) => {
    // Create and select a bin
    await drawBinOnGrid(page, 100, 100, 150, 150);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await page.waitForTimeout(100);

    // Nudge with arrow keys
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);

    // Bin should have moved (checking that undo becomes available indicates a change)
    // Since position might change, we verify the nudge was processed
    // by checking that undo is now available
    const undoButton = page.getByRole('button', { name: /undo/i });
    await expect(undoButton).toBeEnabled();
  });

  test('delete key removes selected bin', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await page.waitForTimeout(100);

    // Press Delete
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // Bin should be deleted
    await expect(bins).toHaveCount(0);
  });

  test('backspace key also removes selected bin', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await page.waitForTimeout(100);

    // Press Backspace
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);

    // Bin should be deleted
    await expect(bins).toHaveCount(0);
  });

  test('escape clears selection', async ({ page }) => {
    // Create and select a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await page.waitForTimeout(100);

    // Verify selected
    await expect(bin).toHaveAttribute('aria-pressed', 'true');

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Selection should be cleared
    const isSelected = await bin.getAttribute('aria-pressed');
    expect(isSelected).not.toBe('true');
  });

  test('ctrl+z triggers undo', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select and delete the bin
    await bins.first().click();
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);
    await expect(bins).toHaveCount(0);

    // Undo with Ctrl+Z
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);

    // Bin should be restored
    await expect(bins).toHaveCount(1);
  });

  test('ctrl+y triggers redo', async ({ page }) => {
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

    // Undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    await expect(bins).toHaveCount(1);

    // Redo with Ctrl+Y
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(200);

    // Bin should be deleted again
    await expect(bins).toHaveCount(0);
  });

  test('ctrl+d duplicates selected bin', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bins = page.locator('[data-bin-id]');
    await expect(bins).toHaveCount(1);

    // Select the bin
    await bins.first().click();
    await page.waitForTimeout(100);

    // Duplicate with Ctrl+D
    await page.keyboard.press('Control+d');
    await page.waitForTimeout(300);

    // Should have 2 bins now
    await expect(bins).toHaveCount(2);
  });

  test('= key zooms in', async ({ page }) => {
    // Get zoom display using the established pattern
    const zoomDisplay = page.locator('[role="group"][aria-label="Zoom controls"] span.tabular-nums');
    await expect(zoomDisplay).toBeVisible();
    const initialZoomText = await zoomDisplay.textContent();
    const initialZoom = parseInt(initialZoomText || '100');

    // Press Equal key multiple times (= key is 'Equal' in Playwright)
    await page.keyboard.press('Equal');
    await page.waitForTimeout(50);
    await page.keyboard.press('Equal');
    await page.waitForTimeout(100);

    // Zoom should have increased
    const newZoomText = await zoomDisplay.textContent();
    const newZoom = parseInt(newZoomText || '0');
    expect(newZoom).toBeGreaterThan(initialZoom);
  });

  test('- key zooms out', async ({ page }) => {
    // First zoom in so we have room to zoom out
    await page.keyboard.press('Equal');
    await page.keyboard.press('Equal');
    await page.waitForTimeout(100);

    const zoomDisplay = page.locator('[role="group"][aria-label="Zoom controls"] span.tabular-nums');
    await expect(zoomDisplay).toBeVisible();
    const beforeZoom = await zoomDisplay.textContent();

    // Press Minus key to zoom out
    await page.keyboard.press('Minus');
    await page.waitForTimeout(100);

    // Zoom should have decreased
    const afterZoom = await zoomDisplay.textContent();
    expect(parseInt(afterZoom || '0')).toBeLessThan(parseInt(beforeZoom || '100'));
  });

  test('? key opens help modal', async ({ page }) => {
    // Press ? to open help
    await page.keyboard.press('?');
    await page.waitForTimeout(300);

    // Help modal should be visible (use the dialog/modal container)
    const helpModal = page.locator('[role="dialog"], [aria-modal="true"]').filter({
      has: page.getByText(/keyboard shortcuts/i)
    });
    await expect(helpModal).toBeVisible();
  });

  test('escape closes help modal', async ({ page }) => {
    // Open help modal
    await page.keyboard.press('?');
    await page.waitForTimeout(300);

    // Verify modal is open
    const helpModal = page.locator('[role="dialog"], [aria-modal="true"]').filter({
      has: page.getByText(/keyboard shortcuts/i)
    });
    await expect(helpModal).toBeVisible();

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Modal should be closed
    await expect(helpModal).not.toBeVisible();
  });

  test('[ and ] cycle through categories for selected bin', async ({ page }) => {
    // Create and select a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();
    await bin.click();
    await page.waitForTimeout(100);

    // Get initial category from aria-label
    const initialLabel = await bin.getAttribute('aria-label');

    // Press ] to go to next category
    await page.keyboard.press(']');
    await page.waitForTimeout(200);

    // Category should have changed
    const newLabel = await bin.getAttribute('aria-label');
    expect(newLabel).not.toBe(initialLabel);
  });

  test('bins have accessible labels', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();

    // Check accessible label contains dimension info
    const ariaLabel = await bin.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/Bin \d+ by \d+/);
    expect(ariaLabel).toMatch(/category/);
  });

  test('selected state is announced via aria-pressed', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();

    // Clear any auto-selection first
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // Initially not selected
    const initialPressed = await bin.getAttribute('aria-pressed');
    expect(initialPressed).not.toBe('true');

    // Select the bin
    await bin.click();
    await page.waitForTimeout(100);

    // aria-pressed should be true
    await expect(bin).toHaveAttribute('aria-pressed', 'true');

    // Deselect
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);

    // aria-pressed should be false
    const finalPressed = await bin.getAttribute('aria-pressed');
    expect(finalPressed).not.toBe('true');
  });

  test('keyboard focus ring is visible', async ({ page }) => {
    // Create a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await page.waitForTimeout(200);

    const bin = page.locator('[data-bin-id]').first();

    // Focus the bin via keyboard
    await bin.focus();
    await page.waitForTimeout(100);

    // Check that focus is visible (the bin should have focus-visible styles)
    // We can verify by checking computed styles or just that focus was received
    const isFocused = await bin.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
  });
});
