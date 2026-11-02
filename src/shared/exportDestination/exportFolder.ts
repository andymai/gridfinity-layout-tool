import type { IDBPDatabase } from 'idb';
import { createDbAccessor } from '@/core/storage';
import type { DbAccessor } from '@/core/storage';
import { err, ok } from '@/core/result';
import type { Result } from '@/core/result';
import { useSettingsStore } from '@/core/store/settings';

// The File System Access permission methods and picker are Chromium-only, so
// lib.dom does not declare them.
interface FolderHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}

type DirectoryPicker = (options: { id: string; mode: 'readwrite' }) => Promise<FolderHandle>;

export type FolderAccess = PermissionState | 'missing';

export interface FolderSaveFailure {
  reason: 'denied' | 'failed';
  /** The stored folder's name, when the handle could be read. */
  folder?: string;
}

const STORE = 'handles';
const KEY = 'exportFolder';
const READWRITE = { mode: 'readwrite' } as const;

let folderDb: DbAccessor<IDBPDatabase | null> | undefined;
let pendingRequest: Promise<void> | null = null;
const writes = new Map<string, Promise<unknown>>();

function getFolderDb(): Promise<IDBPDatabase | null> {
  folderDb ??= createDbAccessor({
    name: 'gridfinity-export-folder-v1',
    version: 1,
    upgrade(db) {
      db.createObjectStore(STORE);
    },
    onUnavailable: () => null,
  });
  return folderDb.get();
}

// Read on every use, never cached: another tab may have changed or forgotten
// the folder since.
async function loadHandle(): Promise<FolderHandle | null> {
  const db = await getFolderDb();
  return ((await db?.get(STORE, KEY)) as FolderHandle | undefined) ?? null;
}

async function requestAccess(handle: FolderHandle): Promise<PermissionState> {
  try {
    return await handle.requestPermission(READWRITE);
  } catch {
    // SecurityError once the click that started the export is too far back.
    return 'prompt';
  }
}

export function canPickFolder(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'showDirectoryPicker' in window;
}

/**
 * Call as the first statement of an export's click handler, before any await.
 * The browser shows its permission prompt only while the click is recent, and
 * an export can take far longer than that before its file is ready to save.
 */
export function primeExportFolder(): void {
  if (pendingRequest || useSettingsStore.getState().settings.exportFolderName === null) return;
  pendingRequest = loadHandle()
    .then(async (handle) => {
      if (handle && (await handle.queryPermission(READWRITE)) === 'prompt') {
        await requestAccess(handle);
      }
    })
    .catch(() => undefined)
    .finally(() => {
      pendingRequest = null;
    });
}

/** Resolves the chosen folder's name, or null when the picker was dismissed. */
export async function pickExportFolder(): Promise<Result<string | null, 'storeFailed'>> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker })
    .showDirectoryPicker;
  let handle: FolderHandle;
  try {
    handle = await picker({ id: 'gridfinity-exports', mode: 'readwrite' });
  } catch {
    return ok(null);
  }
  try {
    const db = await getFolderDb();
    if (!db) return err('storeFailed');
    await db.put(STORE, handle, KEY);
  } catch {
    return err('storeFailed');
  }
  useSettingsStore.getState().updateSetting('exportFolderName', handle.name);
  return ok(handle.name);
}

export async function forgetExportFolder(): Promise<void> {
  useSettingsStore.getState().updateSetting('exportFolderName', null);
  const db = await getFolderDb();
  await db?.delete(STORE, KEY).catch(() => undefined);
}

export async function getFolderAccess(): Promise<FolderAccess> {
  try {
    const handle = await loadHandle();
    return handle ? await handle.queryPermission(READWRITE) : 'missing';
  } catch {
    return 'missing';
  }
}

/** Call from a click: the browser shows its permission prompt only during a user gesture. */
export async function allowExportFolder(): Promise<boolean> {
  const handle = await loadHandle().catch(() => null);
  return handle !== null && (await requestAccess(handle)) === 'granted';
}

async function writeToFolder(
  blob: Blob,
  fileName: string
): Promise<Result<string, FolderSaveFailure>> {
  let handle: FolderHandle | null = null;
  try {
    handle = await loadHandle();
    if (!handle) return err({ reason: 'failed' });
    await pendingRequest;
    let access = await handle.queryPermission(READWRITE);
    if (access === 'prompt') access = await requestAccess(handle);
    if (access !== 'granted') return err({ reason: 'denied', folder: handle.name });
    const file = await handle.getFileHandle(fileName, { create: true });
    await blob.stream().pipeTo(await file.createWritable());
    return ok(handle.name);
  } catch {
    return err({ reason: 'failed', folder: handle?.name });
  }
}

/**
 * Writes the file into the stored folder, replacing one of the same name, and
 * resolves the folder's name. Writes to one name run in call order, so the
 * latest export is the file that stays.
 */
export function saveToExportFolder(
  blob: Blob,
  fileName: string
): Promise<Result<string, FolderSaveFailure>> {
  const previous = writes.get(fileName) ?? Promise.resolve();
  const current = previous.then(() => writeToFolder(blob, fileName));
  writes.set(fileName, current);
  void current.then(() => {
    if (writes.get(fileName) === current) writes.delete(fileName);
  });
  return current;
}
