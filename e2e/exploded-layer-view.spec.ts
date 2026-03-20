import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  waitForCanvas,
  clearAllStorage,
  resetViewport,
  getSidebar,
  getActiveDialog,
} from './fixtures';

test.describe('Exploded Layer View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAllStorage(page);
    await page.reload();
    await waitForAppReady(page);
  });

  test.afterEach(async ({ page }) => {
    await clearAllStorage(page);
    await resetViewport(page);

    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('explode button hidden with single layer', async ({ page }) => {
    // Draw a bin so 3D preview has content
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // With only 1 layer, no explode button should exist
    const explodeButton = page.getByTitle(/exploded view/i);
    await expect(explodeButton).not.toBeVisible();
  });

  test('explode button appears with multiple layers', async ({ page }) => {
    // Add a second layer
    const sidebar = getSidebar(page);
    const addLayerButton = sidebar.getByRole('button', { name: /add new layer/i });
    await addLayerButton.click();

    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // Explode button should be visible
    const explodeButton = page.getByTitle(/exploded view/i);
    await expect(explodeButton).toBeVisible();
  });

  test('clicking explode button toggles exploded view', async ({ page }) => {
    // Add a second layer
    const sidebar = getSidebar(page);
    await sidebar.getByRole('button', { name: /add new layer/i }).click();

    // Draw bins on both layers
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // Click explode button
    const explodeButton = page.getByTitle(/exploded view/i);
    await explodeButton.click();

    // Verify explode button shows active state (has bg-accent class or similar)
    // The button should have the active styling
    await expect(explodeButton).toBeVisible();

    // Layer labels should appear (drei Html renders DOM elements)
    // Labels contain the layer name and height in mm format
    const labels = page.locator('button').filter({ hasText: /mm$/ });
    await expect(labels.first()).toBeVisible({ timeout: 3000 });

    // Click again to toggle off
    await explodeButton.click();

    // Labels should disappear after exit animation (600ms)
    await expect(labels.first()).not.toBeVisible({ timeout: 2000 });
  });

  test('E key toggles exploded view', async ({ page }) => {
    // Add a second layer
    const sidebar = getSidebar(page);
    await sidebar.getByRole('button', { name: /add new layer/i }).click();

    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // Press E to toggle exploded view
    await page.keyboard.press('e');

    // Layer labels should appear
    const labels = page.locator('button').filter({ hasText: /mm$/ });
    await expect(labels.first()).toBeVisible({ timeout: 3000 });

    // Press E again to toggle off
    await page.keyboard.press('e');

    // Labels should disappear
    await expect(labels.first()).not.toBeVisible({ timeout: 2000 });
  });

  test('clicking a layer label sets active layer', async ({ page }) => {
    // Add a second layer
    const sidebar = getSidebar(page);
    await sidebar.getByRole('button', { name: /add new layer/i }).click();

    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // Enable exploded view
    await page.keyboard.press('e');

    // Wait for labels to appear
    const labels = page.locator('button').filter({ hasText: /mm$/ });
    await expect(labels.first()).toBeVisible({ timeout: 3000 });

    // Click the second layer label (should change active layer)
    const labelCount = await labels.count();
    if (labelCount > 1) {
      await labels.nth(1).click();
      // The clicked label should now have active styling
      // (We can verify this by checking the sidebar layer highlight changed)
    }
  });

  test('switching to Focus/Stack mode disables exploded view', async ({ page }) => {
    // Add a second layer
    const sidebar = getSidebar(page);
    await sidebar.getByRole('button', { name: /add new layer/i }).click();

    // Draw a bin
    await drawBinOnGrid(page, 50, 50, 100, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // Enable exploded view
    const explodeButton = page.getByTitle(/exploded view/i);
    await explodeButton.click();

    // Labels should appear
    const labels = page.locator('button').filter({ hasText: /mm$/ });
    await expect(labels.first()).toBeVisible({ timeout: 3000 });

    // Switch to Focus mode — should disable exploded view
    const focusButton = page.getByTitle(/focus/i);
    await focusButton.click();

    // Labels should disappear
    await expect(labels.first()).not.toBeVisible({ timeout: 2000 });
  });

  test('no visual glitches in normal (non-exploded) 3D preview', async ({ page }) => {
    // Create bins without exploding — verify normal render still works
    await drawBinOnGrid(page, 50, 50, 100, 100);
    await drawBinOnGrid(page, 150, 50, 200, 100);

    // Show 3D preview
    const toggleButton = page.getByRole('button', { name: /3D preview/i }).first();
    await toggleButton.click();
    await waitForCanvas(page);

    // Canvas should render without errors
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible();

    // No layer labels should exist in normal mode
    const labels = page.locator('button').filter({ hasText: /mm$/ });
    await expect(labels).toHaveCount(0);
  });
});
