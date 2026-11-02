import { vi } from 'vitest';

export interface FolderDoubleOptions {
  permission?: PermissionState;
  request?: PermissionState | Error;
  failWrites?: boolean;
}

export function folderHandleDouble(name: string, options: FolderDoubleOptions = {}) {
  const files = new Map<string, Uint8Array>();
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
          files.set(fileName, new Uint8Array(Buffer.concat(chunks)));
        },
      });
      return Promise.resolve({ createWritable: () => Promise.resolve(writable) });
    }),
  };
  return { handle, files, state };
}

export function inMemoryDb() {
  const rows = new Map<string, unknown>();
  return {
    rows,
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
}

export const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
