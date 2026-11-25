// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LayoutLibrary } from '@/core/types';
import { gridUnits, heightUnits, layoutId } from '@/core/types';
import { createTestLayout, expectErr, expectOk } from '@/test/testUtils';
import { clearAllData, closeDatabase, saveLayout, saveLibraryIndex } from './backends/indexedDB';
import { readLayout, readLibraryIndex, readPrinterSettings } from './readOnly';
import {
  LAYOUT_DB_NAME,
  LAYOUT_KEY_PREFIX,
  LIBRARY_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from './storageKeys';

const id = 'a1b2c3d4-0000-4000-8000-000000000001';
const library: LayoutLibrary = {
  version: '1.0',
  activeLayoutId: layoutId(id),
  settings: {},
  entries: [
    {
      id: layoutId(id),
      name: 'Desk drawer',
      createdAt: 1,
      modifiedAt: 2,
      preview: {
        drawerWidth: gridUnits(5),
        drawerDepth: gridUnits(4),
        drawerHeight: heightUnits(12),
        binCount: 0,
        layerCount: 1,
        binMap: [],
      },
    },
  ],
};

async function databaseNames(): Promise<string[]> {
  return (await indexedDB.databases()).map((db) => db.name ?? '');
}

describe('read-only layout reads', () => {
  beforeEach(() => {
    closeDatabase();
    localStorage.clear();
  });
  afterEach(async () => {
    await clearAllData().catch(() => undefined);
    closeDatabase();
  });

  it('reads the library and a layout as the app saved them', async () => {
    const layout = createTestLayout({ name: 'Desk drawer' });
    await saveLibraryIndex(library);
    await saveLayout(`${LAYOUT_KEY_PREFIX}${id}`, layout);
    closeDatabase();
    expect(expectOk(await readLibraryIndex())?.entries.map((e) => e.name)).toEqual(['Desk drawer']);
    expect(expectOk(await readLayout(id))?.name).toBe('Desk drawer');
    expect(expectOk(await readLayout('missing'))).toBeNull();
  });

  it('falls back to localStorage when the IndexedDB index is broken', async () => {
    await saveLibraryIndex({ entries: [{ id: 7 }] } as unknown as LayoutLibrary);
    closeDatabase();
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    expect(expectOk(await readLibraryIndex())?.entries.map((e) => e.name)).toEqual(['Desk drawer']);
  });

  it('answers with an error, not with no data, when the browser blocks storage', async () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    try {
      expect(expectErr(await readLibraryIndex()).code).toBe('STORAGE_UNAVAILABLE');
      expect(expectErr(readPrinterSettings()).code).toBe('STORAGE_UNAVAILABLE');
    } finally {
      blocked.mockRestore();
    }
  });

  it('falls back to localStorage, as the app does', async () => {
    closeDatabase();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(LAYOUT_DB_NAME);
      request.onsuccess = request.onerror = resolve;
    });
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));
    localStorage.setItem(
      `${LAYOUT_KEY_PREFIX}${id}`,
      JSON.stringify(createTestLayout({ name: 'Old' }))
    );
    expect(expectOk(await readLibraryIndex())?.activeLayoutId).toBe(id);
    expect(expectOk(await readLayout(id))?.name).toBe('Old');
  });

  it('creates no database when there is none, and ignores a broken library', async () => {
    closeDatabase();
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(LAYOUT_DB_NAME);
      request.onsuccess = request.onerror = resolve;
    });
    expect(expectOk(await readLibraryIndex())).toBeNull();
    expect(expectOk(await readLayout(id))).toBeNull();
    expect(await databaseNames()).not.toContain(LAYOUT_DB_NAME);
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify({ entries: [{ id: 7 }] }));
    expect(expectOk(await readLibraryIndex())).toBeNull();
    const damaged = { ...library, entries: [{ ...library.entries[0], preview: {} }] };
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(damaged));
    expect(expectOk(await readLibraryIndex())).toBeNull();
  });

  it('never holds the database open, so the app can still upgrade it', async () => {
    await saveLibraryIndex(library);
    closeDatabase();
    await readLibraryIndex();
    const upgraded = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open(LAYOUT_DB_NAME, 99);
      request.onblocked = () => reject(new Error('blocked'));
      request.onsuccess = () => {
        request.result.close();
        resolve(request.result.version);
      };
    });
    expect(upgraded).toBe(99);
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase(LAYOUT_DB_NAME);
      request.onsuccess = request.onerror = resolve;
    });
  });

  it('reads the printer settings, with defaults for a missing or broken field', () => {
    expect(expectOk(readPrinterSettings())).toMatchObject({
      measureUnit: 'mm',
      printBedMm: { width: 256, depth: 256 },
      gridUnitMm: 42,
    });
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        measureUnit: 'in',
        defaultPrintBedSize: 180,
        defaultPrintBedDepth: -1,
        printSettings: { nozzleSizeMm: 0.6, layerHeightMm: 'thin', filamentCostPerKg: 0 },
      })
    );
    const settings = expectOk(readPrinterSettings());
    expect(settings).toMatchObject({ measureUnit: 'in', printBedMm: { width: 180, depth: 180 } });
    expect(settings.print.nozzleSizeMm).toBe(0.6);
    expect(settings.print.layerHeightMm).toBeGreaterThan(0);
    expect(settings.print.filamentCostPerKg).toBe(0);
  });
});
