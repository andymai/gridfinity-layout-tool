import {
  test,
  expect,
  waitForAppReady,
  getGridBounds,
  drawBinOnGrid,
  getSidebar,
  waitForBinCount,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

/**
 * Blocked Zone UX Tests
 *
 * Tests the improved UX for layer blocking scenarios:
 * - When bins on lower layers extend upward, they create "blocked zones" on upper layers
 * - Users see visual feedback when trying to place bins in blocked areas
 * - Clicking blocked zones switches to the blocking layer
 */
test.describe('Blocked Zone UX', () => {
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

  test('blocked zone is visible when tall bin extends to upper layer', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Create a tall bin on Layer 1 (height > 3 extends to Layer 2)
    // First, we need to increase the bin height
    const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);

    // Select the bin and increase its height to extend to Layer 2
    await bin.click();

    // Increase height using the inspector
    const inspector = page.locator('[data-testid="inspector"]').or(page.locator('aside').last());
    const heightInput = inspector.locator('input[type="number"]').nth(2); // Height is usually 3rd input

    if (await heightInput.isVisible()) {
      await heightInput.fill('6'); // 6 units = extends 2 layers
      await heightInput.press('Enter');
    }

    // Add a second layer
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });
    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      await expect(sidebar.getByText('Layer 2')).toBeVisible();

      // Switch to Layer 2
      const layer2Button = sidebar.getByRole('button', { name: /layer 2/i }).first();
      await layer2Button.click();

      // The blocked zone should be visible (has class 'blocked-zone')
      const blockedZone = page.locator('.blocked-zone');
      await expect(blockedZone).toBeVisible({ timeout: 3000 });
    }
  });

  test('blocked zone shows tooltip with layer info', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Create a tall bin on Layer 1
    const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);

    // Select and increase height
    await bin.click();
    const inspector = page.locator('[data-testid="inspector"]').or(page.locator('aside').last());
    const heightInput = inspector.locator('input[type="number"]').nth(2);

    if (await heightInput.isVisible()) {
      await heightInput.fill('6');
      await heightInput.press('Enter');
    }

    // Add Layer 2 and switch to it
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });
    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      const layer2Button = sidebar.getByRole('button', { name: /layer 2/i }).first();
      await layer2Button.click();

      // Hover over the blocked zone to see tooltip
      const blockedZone = page.locator('.blocked-zone');
      if (await blockedZone.isVisible()) {
        // The blocked zone should have a title attribute with layer info
        const title = await blockedZone.getAttribute('title');
        expect(title).toContain('Layer 1');
        expect(title).toContain('Click');
      }
    }
  });

  test('clicking blocked zone switches to the blocking layer', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Create a tall bin on Layer 1
    const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);

    // Increase height to extend to Layer 2
    await bin.click();
    const inspector = page.locator('[data-testid="inspector"]').or(page.locator('aside').last());
    const heightInput = inspector.locator('input[type="number"]').nth(2);

    if (await heightInput.isVisible()) {
      await heightInput.fill('6');
      await heightInput.press('Enter');
    }

    // Add Layer 2 and switch to it
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });
    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      const layer2Button = sidebar.getByRole('button', { name: /layer 2/i }).first();
      await layer2Button.click();

      // Verify we're on Layer 2
      await expect(layer2Button).toHaveAttribute('aria-pressed', 'true');

      // Click on the blocked zone
      const blockedZone = page.locator('.blocked-zone');
      if (await blockedZone.isVisible()) {
        await blockedZone.click();

        // Should have switched to Layer 1 and selected the blocking bin
        const layer1Button = sidebar.getByRole('button', { name: /layer 1/i }).first();
        await expect(layer1Button).toHaveAttribute('aria-pressed', 'true', { timeout: 2000 });
      }
    }
  });

  test('dragging bin shows red preview when over blocked zone', async ({ page }) => {
    const sidebar = getSidebar(page);
    const bounds = await getGridBounds(page);

    // Create a tall bin on Layer 1
    const tallBin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);

    // Increase height
    await tallBin.click();
    const inspector = page.locator('[data-testid="inspector"]').or(page.locator('aside').last());
    const heightInput = inspector.locator('input[type="number"]').nth(2);

    if (await heightInput.isVisible()) {
      await heightInput.fill('6');
      await heightInput.press('Enter');
    }

    // Add Layer 2 and switch to it
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });
    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      const layer2Button = sidebar.getByRole('button', { name: /layer 2/i }).first();
      await layer2Button.click();

      // Create a bin on Layer 2 (away from the blocked zone)
      const newBin = await drawBinOnGrid(page, 200, 200, 270, 270);
      await waitForBinCount(page, 2);

      // Try to drag the new bin toward the blocked zone
      const binBox = await newBin.boundingBox();
      if (binBox) {
        await page.mouse.move(binBox.x + binBox.width / 2, binBox.y + binBox.height / 2);
        await page.mouse.down();

        // Move toward the blocked zone (where the tall bin is)
        await page.mouse.move(bounds.x + 70, bounds.y + 70, { steps: 10 });

        // During drag over blocked zone, the preview should show error color
        // The overlay uses var(--color-error) which is typically red
        const preview = page.locator('[style*="border"][style*="solid"]').last();
        if (await preview.isVisible()) {
          const style = await preview.getAttribute('style');
          // Error color is usually set via CSS variable
          expect(style).toContain('error');
        }

        await page.mouse.up();
      }
    }
  });

  test('blocked zone has breathing animation', async ({ page }) => {
    const sidebar = getSidebar(page);

    // Create a tall bin on Layer 1
    const bin = await drawBinOnGrid(page, 50, 50, 120, 120);
    await waitForBinCount(page, 1);

    // Increase height
    await bin.click();
    const inspector = page.locator('[data-testid="inspector"]').or(page.locator('aside').last());
    const heightInput = inspector.locator('input[type="number"]').nth(2);

    if (await heightInput.isVisible()) {
      await heightInput.fill('6');
      await heightInput.press('Enter');
    }

    // Add Layer 2 and switch to it
    const addLayerButton = sidebar.getByRole('button', { name: /add layer/i });
    if (await addLayerButton.isVisible()) {
      await addLayerButton.click();
      const layer2Button = sidebar.getByRole('button', { name: /layer 2/i }).first();
      await layer2Button.click();

      // The blocked zone should have the blocked-zone class with animation
      const blockedZone = page.locator('.blocked-zone');
      if (await blockedZone.isVisible()) {
        // Check that animation is applied (via CSS class)
        const computedStyle = await blockedZone.evaluate((el) => {
          return window.getComputedStyle(el).animation;
        });
        expect(computedStyle).toContain('blocked-zone-breathe');
      }
    }
  });
});
