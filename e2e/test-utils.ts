import type { Page } from '@playwright/test';

/**
 * Complete storage cleanup for test isolation.
 * Clears ALL storage mechanisms used by the app:
 * - localStorage (library index + all layout keys)
 * - sessionStorage (not currently used, but clean anyway)
 * - IndexedDB (not currently used, but clean for future-proofing)
 *
 * This replaces the simple `localStorage.clear()` pattern and prevents
 * cross-test pollution from the multi-layout library system.
 *
 * @param page - Playwright page instance
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear localStorage completely
    localStorage.clear();

    // Clear sessionStorage
    sessionStorage.clear();

    // Clear all IndexedDB databases (async, but fire-and-forget)
    if (window.indexedDB && indexedDB.databases) {
      indexedDB.databases().then((dbs) => {
        dbs.forEach((db) => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      });
    }
  });
}

/**
 * Wait for auto-save to complete after state changes.
 *
 * The app uses a 1000ms debounce (SAVE_DEBOUNCE_MS in useAutoSave.ts).
 * This replaces hard-coded `page.waitForTimeout(2000)` calls with
 * actual state observation - waits for the layout to actually be saved.
 *
 * **Replaces**:
 * - `await page.waitForTimeout(2000)` in create-layout.spec.ts:72
 * - `await page.waitForTimeout(1500)` in drawer-settings.spec.ts:203
 *
 * @param page - Playwright page instance
 * @param timeout - Maximum time to wait (default 2000ms)
 */
export async function waitForAutoSave(page: Page, timeout = 2000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if library index exists in localStorage
      const libraryKey = 'gridfinity-library-v1';
      const library = localStorage.getItem(libraryKey);
      if (!library) return false;

      try {
        // Check if active layout exists
        const parsed = JSON.parse(library);
        const activeId = parsed.activeLayoutId;
        if (!activeId) return false;

        const layoutKey = `gridfinity-layout-${activeId}`;
        return localStorage.getItem(layoutKey) !== null;
      } catch {
        return false;
      }
    },
    { timeout }
  );
}

/**
 * Reset viewport to default desktop size.
 * Call this after tests that change viewport (e.g., mobile tests).
 *
 * Fixes viewport pollution from mobile.spec.ts where viewport is set to
 * 375x667 but never reset, causing subsequent tests to fail.
 *
 * @param page - Playwright page instance
 */
export async function resetViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
}

/**
 * Get the most recently created bin (by DOM order).
 * More explicit and reliable than `.last()` for readability and debugging.
 *
 * Replaces `.last()` pattern in fixtures.ts drawBinOnGrid (line 197)
 * which breaks in parallel execution due to non-deterministic DOM order.
 *
 * @param page - Playwright page instance
 * @returns Locator for the newest bin
 * @throws Error if no bins exist
 */
export async function getNewestBin(page: Page) {
  const bins = await page.locator('[data-bin-id]').all();
  if (bins.length === 0) {
    throw new Error('No bins found on grid');
  }
  return bins[bins.length - 1];
}

/**
 * Get a bin by its index in DOM order.
 * Provides deterministic bin selection for testing.
 *
 * More reliable than `.first()` or `.last()` which can fail when:
 * - Tests run in parallel (DOM order non-deterministic)
 * - Multiple bins are created simultaneously
 * - Animation timing varies
 *
 * @param page - Playwright page instance
 * @param index - Zero-based index of bin
 * @returns Locator for the bin at specified index
 * @throws Error if index is out of range
 */
export async function getBinByIndex(page: Page, index: number) {
  const bins = await page.locator('[data-bin-id]').all();
  if (index < 0 || index >= bins.length) {
    throw new Error(`Bin index ${index} out of range (0-${bins.length - 1})`);
  }
  return bins[index];
}

/**
 * Get total count of bins on the grid.
 * Useful for assertions about bin creation/deletion.
 *
 * @param page - Playwright page instance
 * @returns Number of bins currently on grid
 */
export async function getBinCount(page: Page): Promise<number> {
  return await page.locator('[data-bin-id]').count();
}
