import {
  test,
  expect,
  waitForAppReady,
  drawBinOnGrid,
  waitForBinCount,
  clearAllStorage,
  resetViewport,
  getActiveDialog,
} from './fixtures';

/**
 * Error Recovery Tests
 *
 * Tests the app's ability to gracefully handle and recover from:
 * - Corrupted localStorage data
 * - Invalid layout data
 * - Missing required fields
 *
 * These tests ensure the app remains usable even when storage is corrupted.
 */
test.describe('Error Recovery', () => {
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

  test.describe('Corrupted localStorage', () => {
    test('recovers from corrupted layout JSON in localStorage', async ({ page }) => {
      // Inject corrupted data before loading app
      await page.goto('/');
      await page.evaluate(() => {
        // Set corrupted JSON for the active layout
        localStorage.setItem('gridfinity-layout-test-corrupt', 'not valid json {{{');
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: 'test-corrupt',
            settings: {},
            layouts: [
              {
                id: 'test-corrupt',
                name: 'Corrupted Layout',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      // Reload to trigger loading corrupted data
      await page.reload();
      await waitForAppReady(page);

      // App should still be functional - grid should be visible
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to create a new bin
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
    });

    test('recovers from corrupted library index', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        // Set corrupted library index
        localStorage.setItem('gridfinity-library-v1', 'corrupted data here!!!');
      });

      await page.reload();
      await waitForAppReady(page);

      // App should initialize with default state
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to create bins
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
    });

    test('handles missing drawer dimensions gracefully', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        // Layout with missing drawer dimensions
        const layoutId = 'test-missing-drawer';
        const invalidLayout = {
          version: 1,
          name: 'Missing Drawer',
          drawer: {}, // Missing width, depth, height
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
          bins: [],
          categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
        };
        localStorage.setItem(`gridfinity-layout-${layoutId}`, JSON.stringify(invalidLayout));
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'Missing Drawer',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should show grid with defaults or handle gracefully
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();
    });

    test('handles invalid bin data gracefully', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const layoutId = 'test-invalid-bins';
        const layoutWithInvalidBins = {
          version: 1,
          name: 'Invalid Bins',
          drawer: { width: 10, depth: 8, height: 12 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
          bins: [
            // Bin with negative dimensions
            {
              id: 'bin-1',
              x: 0,
              y: 0,
              width: -1,
              depth: -1,
              height: 3,
              layerId: 'layer-1',
              category: 'default',
            },
            // Bin with missing fields
            { id: 'bin-2' },
            // Bin out of bounds
            {
              id: 'bin-3',
              x: 100,
              y: 100,
              width: 2,
              depth: 2,
              height: 3,
              layerId: 'layer-1',
              category: 'default',
            },
            // Valid bin
            {
              id: 'bin-4',
              x: 0,
              y: 0,
              width: 2,
              depth: 2,
              height: 3,
              layerId: 'layer-1',
              category: 'default',
            },
          ],
          categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
        };
        localStorage.setItem(
          `gridfinity-layout-${layoutId}`,
          JSON.stringify(layoutWithInvalidBins)
        );
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'Invalid Bins',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should still be functional
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to interact with the app
      await drawBinOnGrid(page, 150, 50, 200, 100);
    });
  });

  test.describe('Empty and missing data', () => {
    test('handles completely empty localStorage', async ({ page }) => {
      await page.goto('/');
      await clearAllStorage(page);
      await page.reload();
      await waitForAppReady(page);

      // App should initialize with defaults
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to create bins
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
    });

    test('handles layout reference to non-existent layout', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        // Library references a layout that doesn't exist in storage
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: 'non-existent-layout-id',
            settings: {},
            layouts: [
              {
                id: 'non-existent-layout-id',
                name: 'Ghost Layout',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
        // Don't set the actual layout data
      });

      await page.reload();
      await waitForAppReady(page);

      // App should handle missing layout gracefully
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();
    });

    test('handles missing categories array', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const layoutId = 'test-no-categories';
        const layoutWithoutCategories = {
          version: 1,
          name: 'No Categories',
          drawer: { width: 10, depth: 8, height: 12 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
          bins: [],
          // categories array missing
        };
        localStorage.setItem(
          `gridfinity-layout-${layoutId}`,
          JSON.stringify(layoutWithoutCategories)
        );
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'No Categories',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should still function (uses default categories)
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();
    });

    test('handles missing layers array', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const layoutId = 'test-no-layers';
        const layoutWithoutLayers = {
          version: 1,
          name: 'No Layers',
          drawer: { width: 10, depth: 8, height: 12 },
          bins: [],
          categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
          // layers array missing
        };
        localStorage.setItem(`gridfinity-layout-${layoutId}`, JSON.stringify(layoutWithoutLayers));
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'No Layers',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should still function (creates default layer)
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();
    });
  });

  test.describe('Type coercion edge cases', () => {
    test('handles string numbers in drawer dimensions', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const layoutId = 'test-string-numbers';
        const layoutWithStringNumbers = {
          version: 1,
          name: 'String Numbers',
          drawer: { width: '10', depth: '8', height: '12' }, // Strings instead of numbers
          layers: [{ id: 'layer-1', name: 'Layer 1', height: '3' }],
          bins: [],
          categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
        };
        localStorage.setItem(
          `gridfinity-layout-${layoutId}`,
          JSON.stringify(layoutWithStringNumbers)
        );
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'String Numbers',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should coerce strings to numbers or use defaults
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to create bins
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
    });

    test('handles null values in optional fields', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const layoutId = 'test-null-fields';
        const layoutWithNulls = {
          version: 1,
          name: 'Null Fields',
          drawer: { width: 10, depth: 8, height: 12 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
          bins: [
            {
              id: 'bin-1',
              x: 0,
              y: 0,
              width: 2,
              depth: 2,
              height: 3,
              layerId: 'layer-1',
              category: 'default',
              label: null, // Explicitly null
              notes: null,
            },
          ],
          categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
          gridUnitMm: null, // Explicitly null
          heightUnitMm: null,
        };
        localStorage.setItem(`gridfinity-layout-${layoutId}`, JSON.stringify(layoutWithNulls));
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'Null Fields',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should handle nulls gracefully - recover to usable state
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to create new bins (app recovered successfully)
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
    });
  });

  test.describe('Version migration', () => {
    test('handles old layout format without version field', async ({ page }) => {
      await page.goto('/');
      await page.evaluate(() => {
        const layoutId = 'test-no-version';
        const oldFormatLayout = {
          // No version field - old format
          name: 'Old Format',
          drawer: { width: 10, depth: 8, height: 12 },
          layers: [{ id: 'layer-1', name: 'Layer 1', height: 3 }],
          bins: [
            {
              id: 'bin-1',
              x: 0,
              y: 0,
              width: 2,
              depth: 2,
              height: 3,
              layerId: 'layer-1',
              category: 'default',
            },
          ],
          categories: [{ id: 'default', name: 'Default', color: '#3b82f6' }],
        };
        localStorage.setItem(`gridfinity-layout-${layoutId}`, JSON.stringify(oldFormatLayout));
        localStorage.setItem(
          'gridfinity-library-v1',
          JSON.stringify({
            activeLayoutId: layoutId,
            settings: {},
            layouts: [
              {
                id: layoutId,
                name: 'Old Format',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              },
            ],
          })
        );
      });

      await page.reload();
      await waitForAppReady(page);

      // App should handle old format gracefully - recover to usable state
      const grid = page.locator('[role="application"]');
      await expect(grid).toBeVisible();

      // Should be able to create new bins (app recovered successfully)
      await drawBinOnGrid(page, 50, 50, 100, 100);
      await waitForBinCount(page, 1);
    });
  });
});
