import { isOk } from '@/core/result';
import type { Result } from '@/core/result';
import type { LayoutLibrary } from '@/core/types';
import { useLibraryStore } from './library';

let tail: Promise<void> | null = null;

const settle = (): void => undefined;

/**
 * Runs `write` after every library write queued before it settles, and gives
 * it the library as it is then. When nothing is queued, `write` starts at once.
 *
 * A write that reads the library, awaits storage, and then stores a library
 * made from what it read drops every change that lands during the await. Each
 * write of that kind goes through this queue, and stores its library before it
 * resolves.
 *
 * A write must not await another queued write: the other write waits for this
 * one, so neither finishes.
 */
export function queueLibraryWrite<T>(
  write: (library: LayoutLibrary) => T | Promise<T>
): Promise<T> {
  const run = (): T | Promise<T> => write(useLibraryStore.getState().library);
  const turn = tail
    ? tail.then(run)
    : new Promise<T>((resolve) => {
        resolve(run());
      });
  const settled = turn.then(settle, settle);
  tail = settled;
  void settled.then(() => {
    if (tail === settled) tail = null;
  });
  return turn;
}

/**
 * {@link queueLibraryWrite} for the atomic storage operations, which return the
 * library they saved: a success puts that library in the store.
 */
export function writeLibrary<T extends { library: LayoutLibrary }, E>(
  write: (library: LayoutLibrary) => Promise<Result<T, E>>
): Promise<Result<T, E>> {
  return queueLibraryWrite(async (library) => {
    const result = await write(library);
    if (isOk(result)) useLibraryStore.getState().setLibrary(result.value.library);
    return result;
  });
}
