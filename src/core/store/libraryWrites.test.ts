import { describe, it, expect, beforeEach } from 'vitest';
import { queueLibraryWrite, writeLibrary } from './libraryWrites';
import { useLibraryStore } from './library';
import { err, ok, storageUnavailable } from '@/core/result';
import { expectOk, resetAllStores } from '@/test/testUtils';
import type { LayoutLibrary } from '@/core/types';

function withAuthor(library: LayoutLibrary, authorName: string): LayoutLibrary {
  return { ...library, settings: { ...library.settings, authorName } };
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('queueLibraryWrite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('runs a write at once when nothing is queued', () => {
    const before = useLibraryStore.getState().library;
    let seen: LayoutLibrary | null = null;

    void queueLibraryWrite((library) => {
      seen = library;
      useLibraryStore.getState().setLibrary(withAuthor(library, 'Now'));
    });

    expect(seen).toBe(before);
    expect(useLibraryStore.getState().library.settings.authorName).toBe('Now');
  });

  it('gives a write the library the earlier write stored, not the one at its call', async () => {
    const gate = deferred();
    const first = queueLibraryWrite(async (library) => {
      await gate.promise;
      useLibraryStore.getState().setLibrary(withAuthor(library, 'First'));
    });
    let seen: LayoutLibrary | null = null;
    const second = queueLibraryWrite((library) => {
      seen = library;
    });

    await Promise.resolve();
    expect(seen).toBeNull();

    gate.resolve();
    await Promise.all([first, second]);

    expect(seen).not.toBeNull();
    expect(seen).toBe(useLibraryStore.getState().library);
    expect(useLibraryStore.getState().library.settings.authorName).toBe('First');
  });

  it('runs the next write after one that throws, and rejects only the one that threw', async () => {
    const failure = new Error('disk');
    const failed = queueLibraryWrite(() => Promise.reject(failure));
    const next = queueLibraryWrite((library) => library.entries.length);

    await expect(failed).rejects.toBe(failure);
    await expect(next).resolves.toBe(useLibraryStore.getState().library.entries.length);
  });

  it('rejects a write that throws before it awaits', async () => {
    const failure = new Error('sync');

    await expect(
      queueLibraryWrite(() => {
        throw failure;
      })
    ).rejects.toBe(failure);
  });
});

describe('writeLibrary', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('stores the library a successful write returns', async () => {
    const result = await writeLibrary((library) =>
      Promise.resolve(ok({ library: withAuthor(library, 'Saved') }))
    );

    expectOk(result);
    expect(useLibraryStore.getState().library.settings.authorName).toBe('Saved');
  });

  it('leaves the store as it is when the write fails', async () => {
    const before = useLibraryStore.getState().library;

    await writeLibrary<{ library: LayoutLibrary }, ReturnType<typeof storageUnavailable>>(() =>
      Promise.resolve(err(storageUnavailable('indexedDB', new Error('full'))))
    );

    expect(useLibraryStore.getState().library).toBe(before);
  });
});
