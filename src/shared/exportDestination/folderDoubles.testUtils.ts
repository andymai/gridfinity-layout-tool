import { vi } from 'vitest';

export interface FolderDoubleOptions {
  permission?: PermissionState;
  /** What `requestPermission` resolves; an Error makes it reject instead. */
  request?: PermissionState | Error;
  failWrites?: boolean;
}

/** Stands in for a FileSystemDirectoryHandle and records the files written into it. */
export function folderHandleDouble(name: string, options: FolderDoubleOptions = {}) {
  const files = new Map<string, string>();
  const state = { permission: options.permission ?? 'granted', request: options.request };
  const handle = {
    kind: 'directory',
    name,
    queryPermission: vi.fn(() => Promise.resolve(state.permission)),
    requestPermission: vi.fn(() => {
      if (state.request instanceof Error) return Promise.reject(state.request);
      state.permission = state.request ?? 'granted';
      return Promise.resolve(state.permission);
    }),
    getFileHandle: vi.fn((fileName: string) => {
      if (options.failWrites) {
        return Promise.reject(new DOMException('The folder is gone.', 'NotFoundError'));
      }
      const chunks: Uint8Array[] = [];
      const writable = new WritableStream<Uint8Array>({
        write(chunk) {
          chunks.push(chunk);
        },
        close() {
          files.set(fileName, Buffer.concat(chunks).toString('utf8'));
        },
      });
      return Promise.resolve({ createWritable: () => Promise.resolve(writable) });
    }),
  };
  return { handle, files, state };
}

/** In-memory replacement for the IndexedDB accessor the folder module opens. */
export function inMemoryDbAccessor() {
  const rows = new Map<string, unknown>();
  const db = {
    get: vi.fn((_store: string, key: string) => Promise.resolve(rows.get(key))),
    put: vi.fn((_store: string, value: unknown, key: string) => {
      rows.set(key, value);
      return Promise.resolve(key);
    }),
    delete: vi.fn((_store: string, key: string) => {
      rows.delete(key);
      return Promise.resolve();
    }),
  };
  return {
    rows,
    accessor: { get: () => Promise.resolve(db), invalidate: vi.fn(), close: vi.fn() },
  };
}
