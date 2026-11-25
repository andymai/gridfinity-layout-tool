import { migrateBaseplateParams } from '@/core/baseplateDefaults';
import { DEFAULT_SETTINGS } from '@/core/store/settings.types';
import type { Layout, LayoutLibrary } from '@/core/types';
import { DEFAULT_PRINT_SETTINGS } from '@/shared/printSettings';
import type { PrintSettings } from '@/shared/printSettings';
import { decompressLayout } from '@/shared/utils/compression';
import { isLengthUnit } from '@/shared/utils/lengthUnit';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import { salvageImport } from '@/shared/utils/validation';
import {
  LAYOUTS_STORE,
  LAYOUT_DB_NAME,
  LAYOUT_KEY_PREFIX,
  LIBRARY_INDEX_KEY,
  LIBRARY_STORAGE_KEY,
  LIBRARY_STORE,
  SETTINGS_STORAGE_KEY,
} from './storageKeys';

/**
 * Reads of the reader's own layouts for pages outside the app, such as the
 * docs. They never write. The database opens at the version it has, so it
 * never upgrades; an open that would create it is aborted; and the connection
 * closes when the read ends, or at once when the app asks to upgrade.
 */
function openExisting(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(LAYOUT_DB_NAME);
    } catch {
      resolve(null);
      return;
    }
    // Without a version, only a database that does not exist yet asks for an upgrade.
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function readStored(store: string, key: string): Promise<unknown> {
  const db = await openExisting();
  if (db === null) return undefined;
  try {
    if (!db.objectStoreNames.contains(store)) return undefined;
    return await new Promise<unknown>((resolve) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(undefined);
    });
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}

function readLocal(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as unknown);
  } catch {
    return undefined;
  }
}

function isLibrary(value: unknown): value is LayoutLibrary {
  if (typeof value !== 'object' || value === null) return false;
  const entries = (value as { entries?: unknown }).entries;
  return (
    Array.isArray(entries) &&
    entries.every(
      (entry: unknown) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as { id?: unknown }).id === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string' &&
        typeof (entry as { modifiedAt?: unknown }).modifiedAt === 'number' &&
        typeof (entry as { preview?: unknown }).preview === 'object' &&
        (entry as { preview?: unknown }).preview !== null
    )
  );
}

/** The library index as the app last saved it: IndexedDB first, then localStorage, as the app reads it. */
export async function readLibraryIndex(): Promise<LayoutLibrary | null> {
  const stored =
    (await readStored(LIBRARY_STORE, LIBRARY_INDEX_KEY)) ?? readLocal(LIBRARY_STORAGE_KEY);
  return isLibrary(stored) ? stored : null;
}

/** One layout through the app's own load steps, or null when it is missing or broken. */
export async function readLayout(id: string): Promise<Layout | null> {
  const key = `${LAYOUT_KEY_PREFIX}${id}`;
  const stored = await readStored(LAYOUTS_STORE, key);
  const raw = (typeof stored === 'string' ? decompressLayout(stored) : null) ?? readLocal(key);
  if (raw === null || raw === undefined) return null;
  const result = salvageImport(raw);
  if (!result.valid) return null;
  const layout = result.layout;
  return layout.baseplateParams
    ? { ...layout, baseplateParams: migrateBaseplateParams(layout.baseplateParams) }
    : layout;
}

export interface PrinterSettings {
  readonly measureUnit: LengthUnit;
  readonly printBedMm: { readonly width: number; readonly depth: number };
  readonly gridUnitMm: number;
  readonly heightUnitMm: number;
  readonly print: PrintSettings;
}

const positive = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/** The printer and unit settings, with the app's defaults where a field is missing. */
export function readPrinterSettings(): PrinterSettings {
  const stored = readLocal(SETTINGS_STORAGE_KEY);
  const saved = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >;
  const print = (
    typeof saved.printSettings === 'object' && saved.printSettings !== null
      ? saved.printSettings
      : {}
  ) as Record<string, unknown>;
  const bedWidth = positive(saved.defaultPrintBedSize, DEFAULT_SETTINGS.defaultPrintBedSize);
  return {
    measureUnit: isLengthUnit(saved.measureUnit) ? saved.measureUnit : DEFAULT_SETTINGS.measureUnit,
    printBedMm: { width: bedWidth, depth: positive(saved.defaultPrintBedDepth, bedWidth) },
    gridUnitMm: positive(saved.defaultGridUnitMm, DEFAULT_SETTINGS.defaultGridUnitMm),
    heightUnitMm: positive(saved.defaultHeightUnitMm, DEFAULT_SETTINGS.defaultHeightUnitMm),
    print: {
      ...DEFAULT_PRINT_SETTINGS,
      nozzleSizeMm: positive(print.nozzleSizeMm, DEFAULT_PRINT_SETTINGS.nozzleSizeMm),
      layerHeightMm: positive(print.layerHeightMm, DEFAULT_PRINT_SETTINGS.layerHeightMm),
      maxPrintHeightMm: positive(print.maxPrintHeightMm, DEFAULT_PRINT_SETTINGS.maxPrintHeightMm),
      infillPercent: positive(print.infillPercent, DEFAULT_PRINT_SETTINGS.infillPercent),
      filamentCostPerKg: positive(
        print.filamentCostPerKg,
        DEFAULT_PRINT_SETTINGS.filamentCostPerKg
      ),
    },
  };
}
