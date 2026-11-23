import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { waitForAppReady, clearAllStorage, resetViewport, getActiveDialog } from './fixtures';

/** Layouts and the library live in IndexedDB. */
function readAppDb(page: Page, store: string, key: string): Promise<unknown> {
  return page.evaluate(
    ([storeName, recordKey]) =>
      new Promise<unknown>((resolve) => {
        const open = indexedDB.open('gridfinity-db');
        open.onerror = () => resolve(null);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.close();
            resolve(null);
            return;
          }
          const get = db.transaction(storeName, 'readonly').objectStore(storeName).get(recordKey);
          get.onsuccess = () => {
            db.close();
            resolve(get.result ?? null);
          };
          get.onerror = () => {
            db.close();
            resolve(null);
          };
        };
      }),
    [store, key] as const
  );
}

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
    const dialogs = getActiveDialog(page);
    if ((await dialogs.count()) > 0) {
      await page.keyboard.press('Escape');
      await dialogs.waitFor({ state: 'detached', timeout: 1000 }).catch(() => {});
    }
  });

  test('storage is clean at test start', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const storageState = await page.evaluate(() => ({
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
    }));

    // Only what the app itself writes at startup, nothing a previous test left.
    const notApp = (key: string) => !key.startsWith('gridfinity-');
    expect(storageState.localKeys.filter(notApp)).toEqual([]);
    expect(storageState.sessionKeys.filter(notApp)).toEqual([]);
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
    // Check for dialogs
    const dialogs = getActiveDialog(page);
    const dialogCount = await dialogs.count();
    expect(dialogCount).toBe(0);
  });

  test('library state is initialized correctly', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const libraryData = (await readAppDb(page, 'library', 'index')) as {
      activeLayoutId?: unknown;
      entries?: unknown;
    } | null;

    expect(libraryData).not.toBeNull();
    expect(libraryData).toHaveProperty('activeLayoutId');
    expect(Array.isArray(libraryData?.entries)).toBe(true);
  });

  test('active layout is loaded correctly', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
    const library = (await readAppDb(page, 'library', 'index')) as {
      activeLayoutId?: string;
      entries?: Array<{
        id: string;
        preview?: { drawerWidth?: number; layerCount?: number; binCount?: number };
      }>;
    } | null;
    const activeId = library?.activeLayoutId;
    expect(typeof activeId).toBe('string');
    const entry = library?.entries?.find((e) => e.id === activeId);
    expect(entry).toBeDefined();

    // The document is stored compressed; its library entry carries a summary.
    expect(await readAppDb(page, 'layouts', `gridfinity-layout-${activeId}`)).not.toBeNull();
    expect(entry?.preview?.drawerWidth).toBeGreaterThan(0);
    expect(entry?.preview?.layerCount).toBeGreaterThanOrEqual(1);
    expect(typeof entry?.preview?.binCount).toBe('number');
  });
});
