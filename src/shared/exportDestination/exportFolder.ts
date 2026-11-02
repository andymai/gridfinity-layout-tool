import { createDbAccessor } from '@/core/storage/backends/openSingleton';
import type { DbAccessor } from '@/core/storage/backends/openSingleton';
import type { IDBPDatabase } from 'idb';
import { useSettingsStore } from '@/core/store/settings';

// The File System Access permission methods and picker are Chromium-only, so
// lib.dom does not declare them.
interface FolderHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'readwrite' }): Promise<PermissionState>;
}

type DirectoryPicker = (options: { id: string; mode: 'readwrite' }) => Promise<FolderHandle>;

export type FolderAccess = 'granted' | 'prompt' | 'missing';
export type FolderSaveOutcome = 'saved' | 'denied' | 'failed';

const STORE = 'handles';
const KEY = 'exportFolder';
const READWRITE = { mode: 'readwrite' } as const;

let folderDb: DbAccessor<IDBPDatabase | null> | undefined;
let cachedHandle: FolderHandle | null | undefined;

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

async function loadHandle(): Promise<FolderHandle | null> {
  if (cachedHandle === undefined) {
    const db = await getFolderDb();
    cachedHandle = ((await db?.get(STORE, KEY)) as FolderHandle | undefined) ?? null;
  }
  return cachedHandle;
}

async function requestAccess(handle: FolderHandle): Promise<boolean> {
  try {
    return (await handle.requestPermission(READWRITE)) === 'granted';
  } catch {
    // SecurityError once the click that started the export is too far back.
    return false;
  }
}

export function canPickFolder(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'showDirectoryPicker' in window;
}

/** Resolves the chosen folder's name, or null when the picker was dismissed. */
export async function pickExportFolder(): Promise<string | null> {
  const picker = (window as unknown as { showDirectoryPicker: DirectoryPicker })
    .showDirectoryPicker;
  let handle: FolderHandle;
  try {
    handle = await picker({ id: 'gridfinity-exports', mode: 'readwrite' });
  } catch {
    return null;
  }
  cachedHandle = handle;
  useSettingsStore.getState().updateSetting('exportFolderName', handle.name);
  const db = await getFolderDb();
  await db?.put(STORE, handle, KEY).catch(() => undefined);
  return handle.name;
}

export async function forgetExportFolder(): Promise<void> {
  cachedHandle = null;
  useSettingsStore.getState().updateSetting('exportFolderName', null);
  const db = await getFolderDb();
  await db?.delete(STORE, KEY).catch(() => undefined);
}

export async function getFolderAccess(): Promise<FolderAccess> {
  const handle = await loadHandle();
  if (!handle) return 'missing';
  return (await handle.queryPermission(READWRITE)) === 'granted' ? 'granted' : 'prompt';
}

/** Call from a click: the browser shows its permission prompt only during a user gesture. */
export async function allowExportFolder(): Promise<boolean> {
  const handle = await loadHandle();
  return handle !== null && (await requestAccess(handle));
}

export async function saveToExportFolder(blob: Blob, fileName: string): Promise<FolderSaveOutcome> {
  try {
    const handle = await loadHandle();
    if (!handle) return 'failed';
    const granted =
      (await handle.queryPermission(READWRITE)) === 'granted' || (await requestAccess(handle));
    if (!granted) return 'denied';
    const file = await handle.getFileHandle(fileName, { create: true });
    await blob.stream().pipeTo(await file.createWritable());
    return 'saved';
  } catch {
    return 'failed';
  }
}

/** Test-only: drop the in-memory handle so the next call reads IndexedDB again. */
export function resetExportFolderCacheForTests(): void {
  cachedHandle = undefined;
  folderDb = undefined;
}
