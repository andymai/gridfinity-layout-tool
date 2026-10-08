import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MESH_SWEEP_GRACE_MS,
  __resetMeshStoreForTests,
  getMeshFile,
  hasMeshFile,
  putMeshFile,
  refreshMeshFileUse,
  subscribeMeshFileArrivals,
  sweepMeshFiles,
} from './meshStore';

const DB_NAME = 'gridfinity-mesh-files';

function deleteDb(): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function bytesOf(seed: number, length = 256): Uint8Array<ArrayBuffer> {
  return Uint8Array.from({ length }, (_, i) => (i * 31 + seed) & 0xff);
}

function sha(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

beforeEach(async () => {
  __resetMeshStoreForTests();
  await deleteDb();
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetMeshStoreForTests();
});

describe('putMeshFile', () => {
  it('stores the bytes under their SHA-256', async () => {
    const bytes = bytesOf(1);
    const hash = await putMeshFile(bytes);
    expect(hash).toBe(sha(bytes));
    expect(await hasMeshFile(sha(bytes))).toBe(true);
    expect(await getMeshFile(sha(bytes))).toEqual(bytes);
  });

  it('announces a file the first time it arrives', async () => {
    const heard = vi.fn();
    const stop = subscribeMeshFileArrivals(heard);
    const hash = await putMeshFile(bytesOf(9));
    await putMeshFile(bytesOf(9));
    stop();
    await putMeshFile(bytesOf(10));
    expect(heard.mock.calls).toEqual([[hash]]);
  });

  it('is idempotent: the same bytes keep one file', async () => {
    const first = await putMeshFile(bytesOf(2));
    const second = await putMeshFile(bytesOf(2));
    expect(second).toBe(first);
    expect(await sweepMeshFiles(new Set(), Date.now() + MESH_SWEEP_GRACE_MS + 1)).toEqual([first]);
  });
});

describe('getMeshFile', () => {
  it('reads a stored file back after the in-memory copy is gone', async () => {
    const bytes = bytesOf(3, 4096);
    const hash = await putMeshFile(bytes);
    __resetMeshStoreForTests();
    expect(await getMeshFile(hash ?? '')).toEqual(bytes);
  });

  it('answers null and false for a file this device does not have', async () => {
    const hash = sha(bytesOf(4));
    expect(await getMeshFile(hash)).toBeNull();
    expect(await hasMeshFile(hash)).toBe(false);
  });
});

describe('sweepMeshFiles', () => {
  const day = 24 * 60 * 60 * 1000;

  it('deletes only files that nothing references and nothing used within the grace period', async () => {
    const start = 1_000_000_000_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    const kept = await putMeshFile(bytesOf(5));
    const orphan = await putMeshFile(bytesOf(6));
    now.mockReturnValue(start + MESH_SWEEP_GRACE_MS - day);
    const recent = await putMeshFile(bytesOf(7));

    const swept = await sweepMeshFiles(new Set([kept ?? '']), start + MESH_SWEEP_GRACE_MS + day);

    expect(swept).toEqual([orphan]);
    expect(await hasMeshFile(kept ?? '')).toBe(true);
    expect(await hasMeshFile(recent ?? '')).toBe(true);
    expect(await hasMeshFile(orphan ?? '')).toBe(false);
    expect(await getMeshFile(orphan ?? '')).toBeNull();
  });

  it('treats reading a file as using it', async () => {
    const start = 1_000_000_000_000;
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    const hash = await putMeshFile(bytesOf(8));
    __resetMeshStoreForTests();

    now.mockReturnValue(start + MESH_SWEEP_GRACE_MS + day);
    await getMeshFile(hash ?? '');

    const swept = await sweepMeshFiles(new Set(), start + MESH_SWEEP_GRACE_MS + 2 * day);
    expect(swept).toEqual([]);
    expect(await hasMeshFile(hash ?? '')).toBe(true);
  });

  it('is a no-op on an empty store', async () => {
    expect(await sweepMeshFiles(new Set())).toEqual([]);
  });
});

describe('a long-open page keeps the files it uses', () => {
  const day = 24 * 60 * 60 * 1000;
  const start = 1_000_000_000_000;

  /** Delete a file the way another tab's sweep would, behind this page's back. */
  function deleteElsewhere(hash: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => {
        const tx = req.result.transaction(['files', 'meta'], 'readwrite');
        tx.objectStore('files').delete(hash);
        tx.objectStore('meta').delete(hash);
        tx.oncomplete = () => {
          req.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error ?? new Error('delete failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('open failed'));
    });
  }

  it('marks a cached file used again when read a day or more later', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(start);
    const hash = (await putMeshFile(bytesOf(11))) ?? '';

    now.mockReturnValue(start + 6 * day);
    await getMeshFile(hash);

    expect(await sweepMeshFiles(new Set(), start + 8 * day)).toEqual([]);
    expect(await sweepMeshFiles(new Set(), start + 13 * day + 1)).toEqual([hash]);
  });

  it('renews every file it used when refreshed, read or not', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(start);
    const hash = (await putMeshFile(bytesOf(12))) ?? '';

    await refreshMeshFileUse(start + day / 2);
    expect(await sweepMeshFiles(new Set(), start + 7 * day + 1)).toEqual([hash]);

    const kept = (await putMeshFile(bytesOf(13))) ?? '';
    await refreshMeshFileUse(start + 2 * day);
    expect(await sweepMeshFiles(new Set(), start + 8 * day)).toEqual([]);
    expect(await hasMeshFile(kept)).toBe(true);
  });

  it('stores again a file another tab swept while this page still holds it', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(start);
    const bytes = bytesOf(14);
    const hash = (await putMeshFile(bytes)) ?? '';
    await deleteElsewhere(hash);

    await refreshMeshFileUse(start + 2 * day);
    __resetMeshStoreForTests();

    expect(await getMeshFile(hash)).toEqual(bytes);
  });

  it('keeps a file another tab sweeps while the refresh is reading it', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(start);
    const bytes = bytesOf(15);
    const hash = (await putMeshFile(bytes)) ?? '';
    const elsewhere = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('open failed'));
    });
    const sweepAt = start + 8 * day;
    // Queued the moment the refresh reads, so it commits before any
    // transaction the refresh opens after that read.
    const sweepElsewhere = (): Promise<void> =>
      new Promise((resolve) => {
        const tx = elsewhere.transaction(['files', 'meta'], 'readwrite');
        const meta = tx.objectStore('meta').get(hash);
        meta.onsuccess = () => {
          const touchedAt = (meta.result as { touchedAt: number } | undefined)?.touchedAt ?? 0;
          if (sweepAt - touchedAt <= MESH_SWEEP_GRACE_MS) return;
          tx.objectStore('files').delete(hash);
          tx.objectStore('meta').delete(hash);
        };
        tx.oncomplete = () => resolve();
      });
    const sweeps: Promise<void>[] = [];
    const getKey = IDBObjectStore.prototype.getKey;
    vi.spyOn(IDBObjectStore.prototype, 'getKey').mockImplementation(function (
      this: IDBObjectStore,
      query: IDBValidKey | IDBKeyRange
    ) {
      const request = getKey.call(this, query);
      if (sweeps.length === 0) sweeps.push(sweepElsewhere());
      return request;
    });

    await refreshMeshFileUse(sweepAt);
    await Promise.all(sweeps);
    expect(sweeps).toHaveLength(1);
    elsewhere.close();
    __resetMeshStoreForTests();

    expect(await getMeshFile(hash)).toEqual(bytes);
  });
});
