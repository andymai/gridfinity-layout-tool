import { test, expect } from '@playwright/test';
import { waitForAppReady, clearAllStorage, resetViewport } from './fixtures';

test.describe('Test Isolation Verification', () => {
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
    const dialogs = page.locator('[role="dialog"]');
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('storage is clean at test start', async ({ page }) => {
    await page.goto('/');
    const storageState = await page.evaluate(() => ({
      localStorageLength: localStorage.length,
      sessionStorageLength: sessionStorage.length,
    }));

    // Should have minimal state (library + active layout + maybe settings)
    expect(storageState.localStorageLength).toBeLessThanOrEqual(5);
    expect(storageState.sessionStorageLength).toBe(0);
  });

  test('viewport is at baseline', async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(1280);
    expect(viewport?.height).toBe(720);
  });

  test('previous test data does not leak (test 1/2)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('test-marker-1', 'should-be-cleaned');
      sessionStorage.setItem('test-marker-session', 'should-be-cleaned');
    });

    // Verify marker was set
    const marker = await page.evaluate(() => localStorage.getItem('test-marker-1'));
    expect(marker).toBe('should-be-cleaned');
  });

  test('previous test data does not leak (test 2/2)', async ({ page }) => {
    await page.goto('/');
    const markers = await page.evaluate(() => ({
      localStorage: localStorage.getItem('test-marker-1'),
      sessionStorage: sessionStorage.getItem('test-marker-session'),
    }));

    // afterEach should have cleaned these up
    expect(markers.localStorage).toBeNull();
    expect(markers.sessionStorage).toBeNull();
  });

  test('viewport resets between tests after mobile size', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const mobileViewport = page.viewportSize();
    expect(mobileViewport?.width).toBe(375);
    expect(mobileViewport?.height).toBe(667);

    // afterEach will reset this
  });

  test('viewport is back to baseline after mobile test', async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(1280);
    expect(viewport?.height).toBe(720);
  });

  test('no dialogs left open from previous tests', async ({ page }) => {
    const dialogs = page.locator('[role="dialog"]');
    const dialogCount = await dialogs.count();
    expect(dialogCount).toBe(0);
  });

  test('library state is initialized correctly', async ({ page }) => {
    await page.goto('/');
    const libraryData = await page.evaluate(() => {
      const library = localStorage.getItem('gridfinity-library-v1');
      return library ? JSON.parse(library) : null;
    });

    expect(libraryData).not.toBeNull();
    expect(libraryData).toHaveProperty('activeLayoutId');
    expect(libraryData).toHaveProperty('entries');
    expect(Array.isArray(libraryData.entries)).toBe(true);
  });

  test('active layout is loaded correctly', async ({ page }) => {
    await page.goto('/');
    const layoutData = await page.evaluate(() => {
      const library = localStorage.getItem('gridfinity-library-v1');
      if (!library) return null;

      const parsed = JSON.parse(library);
      const layoutKey = `gridfinity-layout-${parsed.activeLayoutId}`;
      const layout = localStorage.getItem(layoutKey);
      return layout ? JSON.parse(layout) : null;
    });

    expect(layoutData).not.toBeNull();
    expect(layoutData).toHaveProperty('drawer');
    expect(layoutData).toHaveProperty('bins');
    expect(layoutData).toHaveProperty('layers');
  });
});
