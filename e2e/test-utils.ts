import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

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

interface StoredActiveLayout {
  readonly stored: boolean;
  readonly name?: string;
  readonly binCount?: number;
}

/** The open layout as IndexedDB holds it: its library entry and whether its record exists. */
function readStoredActiveLayout(page: Page): Promise<StoredActiveLayout> {
  return page.evaluate(async () => {
    const none = { stored: false };
    // Opening a database that does not exist yet would create it empty, ahead
    // of the app's own upgrade, so look first.
    const dbs = await indexedDB.databases();
    if (!dbs.some((db) => db.name === 'gridfinity-db')) return none;
    return new Promise<StoredActiveLayout>((resolve) => {
      const open = indexedDB.open('gridfinity-db');
      open.onerror = () => resolve(none);
      open.onsuccess = () => {
        const db = open.result;
        const done = (result: StoredActiveLayout) => {
          db.close();
          resolve(result);
        };
        if (!db.objectStoreNames.contains('library') || !db.objectStoreNames.contains('layouts')) {
          done(none);
          return;
        }
        const tx = db.transaction(['library', 'layouts'], 'readonly');
        const index = tx.objectStore('library').get('index');
        index.onerror = () => done(none);
        index.onsuccess = () => {
          const library = index.result as
            | {
                activeLayoutId?: string;
                entries?: Array<{ id: string; name: string; preview?: { binCount?: number } }>;
              }
            | undefined;
          const activeId = library?.activeLayoutId;
          if (!activeId) {
            done(none);
            return;
          }
          const entry = library.entries?.find((e) => e.id === activeId);
          const record = tx.objectStore('layouts').get(`gridfinity-layout-${activeId}`);
          record.onerror = () => done(none);
          record.onsuccess = () =>
            done({
              stored: record.result !== undefined,
              name: entry?.name,
              binCount: entry?.preview?.binCount,
            });
        };
      };
    });
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
 * @param timeout - Maximum time to wait (default 5000ms)
 */
export async function waitForAutoSave(page: Page, timeout = 5000): Promise<void> {
  await expect
    .poll(async () => (await readStoredActiveLayout(page)).stored, { timeout, intervals: [200] })
    .toBe(true);
}

/**
 * Wait until the saved library entry of the open layout matches what the test
 * just did. Unlike `waitForAutoSave`, this sees the latest edit land, so it is
 * the one to use before a reload.
 */
export async function waitForSavedLayout(
  page: Page,
  expected: { name?: string; binCount?: number },
  timeout = 5000
): Promise<void> {
  await expect
    .poll(
      async () => {
        const saved = await readStoredActiveLayout(page);
        return (
          saved.stored &&
          (expected.name === undefined || saved.name === expected.name) &&
          (expected.binCount === undefined || saved.binCount === expected.binCount)
        );
      },
      { timeout, intervals: [200] }
    )
    .toBe(true);
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
