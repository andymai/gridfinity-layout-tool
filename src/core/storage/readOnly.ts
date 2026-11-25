import { migrateBaseplateParams } from '@/core/baseplateDefaults';
import { err, isOk, ok, storageUnavailable } from '@/core/result';
import type { Result, StorageUnavailableError } from '@/core/result';
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
// Missing and failed differ: no database means no saved data, but a
// database that fails to open may still hold the reader's layouts.
function openExisting(): Promise<Result<IDBDatabase | null, StorageUnavailableError>> {
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(LAYOUT_DB_NAME);
    } catch (cause) {
      resolve(err(storageUnavailable('indexedDB', cause)));
      return;
    }
    let missing = false;
    // Without a version, only a database that does not exist yet asks for an upgrade.
    request.onupgradeneeded = () => {
      missing = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(ok(db));
    };
    request.onerror = () =>
      resolve(missing ? ok(null) : err(storageUnavailable('indexedDB', request.error)));
    request.onblocked = () => resolve(err(storageUnavailable('indexedDB')));
  });
}

async function readStored(
  store: string,
  key: string
): Promise<Result<unknown, StorageUnavailableError>> {
  const opened = await openExisting();
  if (!isOk(opened)) return opened;
  const db = opened.value;
  if (db === null) return ok(undefined);
  try {
    if (!db.objectStoreNames.contains(store)) return ok(undefined);
    return await new Promise<Result<unknown, StorageUnavailableError>>((resolve) => {
      const request = db.transaction(store, 'readonly').objectStore(store).get(key);
      request.onsuccess = () => resolve(ok(request.result));
      request.onerror = () => resolve(err(storageUnavailable('indexedDB', request.error)));
    });
  } catch (cause) {
    return err(storageUnavailable('indexedDB', cause));
  } finally {
    db.close();
  }
}

// A browser that blocks storage throws on access. That is an error, not
// missing data: the reader's data is unknown, which is not the same as none.
function readLocal(key: string): Result<unknown, StorageUnavailableError> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch (cause) {
    return err(storageUnavailable('localStorage', cause));
  }
  if (raw === null) return ok(undefined);
  try {
    return ok(JSON.parse(raw) as unknown);
  } catch {
    return ok(undefined);
  }
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isPreview(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const preview = value as Record<string, unknown>;
  return ['drawerWidth', 'drawerDepth', 'drawerHeight', 'binCount', 'layerCount'].every((key) =>
    isFiniteNumber(preview[key])
  );
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
        isFiniteNumber((entry as { modifiedAt?: unknown }).modifiedAt) &&
        isPreview((entry as { preview?: unknown }).preview)
    )
  );
}

/** The library index as the app last saved it: IndexedDB first, then localStorage, as the app reads it. */
export async function readLibraryIndex(): Promise<
  Result<LayoutLibrary | null, StorageUnavailableError>
> {
  const stored = await readStored(LIBRARY_STORE, LIBRARY_INDEX_KEY);
  if (isOk(stored) && isLibrary(stored.value)) return ok(stored.value);
  const local = readLocal(LIBRARY_STORAGE_KEY);
  if (!isOk(local)) return local;
  if (isLibrary(local.value)) return ok(local.value);
  return isOk(stored) ? ok(null) : stored;
}

/** One layout through the app's own load steps, or null when it is missing or broken. */
export async function readLayout(
  id: string
): Promise<Result<Layout | null, StorageUnavailableError>> {
  const key = `${LAYOUT_KEY_PREFIX}${id}`;
  const stored = await readStored(LAYOUTS_STORE, key);
  let raw: unknown =
    isOk(stored) && typeof stored.value === 'string' ? decompressLayout(stored.value) : null;
  if (raw === null) {
    const local = readLocal(key);
    if (!isOk(local)) return local;
    raw = local.value;
  }
  if (raw === null || raw === undefined) return isOk(stored) ? ok(null) : stored;
  const result = salvageImport(raw);
  if (!result.valid) return isOk(stored) ? ok(null) : stored;
  const layout = result.layout;
  return ok(
    layout.baseplateParams
      ? { ...layout, baseplateParams: migrateBaseplateParams(layout.baseplateParams) }
      : layout
  );
}

export interface PrinterSettings {
  readonly measureUnit: LengthUnit;
  readonly printBedMm: { readonly width: number; readonly depth: number };
  readonly gridUnitMm: number;
  readonly heightUnitMm: number;
  readonly print: PrintSettings;
}

const positive = (value: unknown, fallback: number): number =>
  isFiniteNumber(value) && value > 0 ? value : fallback;
const nonNegative = (value: unknown, fallback: number): number =>
  isFiniteNumber(value) && value >= 0 ? value : fallback;

/** The printer and unit settings, with the app's defaults where a field is missing. */
export function readPrinterSettings(): Result<PrinterSettings, StorageUnavailableError> {
  const read = readLocal(SETTINGS_STORAGE_KEY);
  if (!isOk(read)) return read;
  const stored = read.value;
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
  return ok({
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
      filamentCostPerKg: nonNegative(
        print.filamentCostPerKg,
        DEFAULT_PRINT_SETTINGS.filamentCostPerKg
      ),
    },
  });
}
