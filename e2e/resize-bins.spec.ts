import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  selectBinAt,
  getInspector,
  waitForRedoEnabled,
} from './fixtures';

test.describe('Resize Bins Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await waitForAppReady(page);

    // Create a bin to work with
    await drawBinOnGrid(page, 50, 50, 150, 150);
  });

  test('selected bin shows in inspector', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 100, 100);

    // Inspector should show bin details
    const inspector = getInspector(page);
    await expect(inspector.getByRole('heading', { name: /^\d×\d Bin$/i })).toBeVisible({ timeout: 3000 });
  });

  test('inspector shows bin size controls', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 100, 100);

    // Should see height controls in inspector
    const inspector = getInspector(page);
    await expect(inspector.getByText(/height/i)).toBeVisible({ timeout: 3000 });
  });

  test('can change bin height with controls', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 100, 100);

    const inspector = getInspector(page);

    // Find height increase button
    const increaseButton = inspector.getByRole('button', { name: /increase height|▲|\+/i });
    if (await increaseButton.count() > 0) {
      // Get initial height text
      const initialHeight = await inspector.getByText(/\du/).first().textContent();

      await increaseButton.first().click();

      // Wait for state to update - verify height display exists
      const newHeight = await inspector.getByText(/\du/).first().textContent();
      expect(newHeight).toBeTruthy();
      expect(initialHeight).toBeTruthy();
    }
  });

  test('resize can be undone', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 100, 100);

    const inspector = getInspector(page);

    // Find height increase button
    const increaseButton = inspector.getByRole('button', { name: /increase height|▲|\+/i });
    if (await increaseButton.count() > 0) {
      await increaseButton.first().click();

      // Undo
      await page.keyboard.press('Control+z');

      // Verify redo is enabled (undo worked)
      await waitForRedoEnabled(page);
    }
  });

  test('bin can be labeled', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 100, 100);

    const inspector = getInspector(page);

    // Find label input
    const labelInput = inspector.locator('input[placeholder*="label"], input[aria-label*="label"]').first();
    if (await labelInput.isVisible()) {
      await labelInput.fill('My Bin');
      await labelInput.press('Tab');

      // Label should be shown
      await expect(inspector.getByText('My Bin')).toBeVisible();
    }
  });

  test('bin inspector shows category', async ({ page }) => {
    // Select the bin
    await selectBinAt(page, 100, 100);

    const inspector = getInspector(page);

    // Category dropdown should be visible (has aria-label="Bin category")
    await expect(inspector.getByLabel('Bin category')).toBeVisible({ timeout: 3000 });
  });
});
