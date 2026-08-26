// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import { createDbAccessor } from './openSingleton';

let dbCounter = 0;
const createdDbs: string[] = [];

function nextDbName(): string {
  dbCounter += 1;
  const name = `open-singleton-test-${dbCounter}`;
  createdDbs.push(name);
  return name;
}

/** Resolve on blocked too: a leaked connection must not hang the suite. */
function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

function withStore(db: IDBPDatabase): void {
  if (!db.objectStoreNames.contains('things')) {
    db.createObjectStore('things');
  }
}

/**
 * fake-indexeddb dispatches its own event objects and reads `initialized` /
 * `eventPath` off whatever it is handed, so a DOM `Event` throws. This is the
 * minimal shape its FakeEventTarget accepts.
 */
function fireCloseEvent(db: IDBPDatabase): void {
  const event = {
    type: 'close',
    eventPath: [],
    initialized: true,
    dispatched: false,
    bubbles: false,
    cancelable: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    canceled: false,
    eventPhase: 0,
    NONE: 0,
    CAPTURING_PHASE: 1,
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
    target: null,
    currentTarget: null,
  };
  db.dispatchEvent(event as unknown as Event);
}

/** Make `version` unopenable: a higher version already exists on disk. */
async function blockVersion(name: string, version: number): Promise<void> {
  const blocker = await openDB(name, version, { upgrade: withStore });
  blocker.close();
}

afterEach(async () => {
  const names = createdDbs.splice(0);
  await Promise.all(names.map((name) => deleteDb(name)));
});

describe('createDbAccessor', () => {
  it('runs the upgrade callback and caches the connection', async () => {
    const accessor = createDbAccessor({ name: nextDbName(), version: 1, upgrade: withStore });

    const db = await accessor.get();
    expect(db.objectStoreNames.contains('things')).toBe(true);
    expect(await accessor.get()).toBe(db);

    accessor.close();
  });

  it('shares one connection between concurrent get() calls', async () => {
    const accessor = createDbAccessor({ name: nextDbName(), version: 1, upgrade: withStore });

    const [first, second, third] = await Promise.all([
      accessor.get(),
      accessor.get(),
      accessor.get(),
    ]);

    expect(second).toBe(first);
    expect(third).toBe(first);

    accessor.close();
  });

  it('reopens after the browser closes the connection', async () => {
    const accessor = createDbAccessor({ name: nextDbName(), version: 1, upgrade: withStore });

    const first = await accessor.get();
    fireCloseEvent(first);
    const second = await accessor.get();

    expect(second).not.toBe(first);
    await second.put('things', 'value', 'key');
    expect(await second.get('things', 'key')).toBe('value');

    first.close();
    accessor.close();
  });

  it('reopens after close()', async () => {
    const accessor = createDbAccessor({ name: nextDbName(), version: 1, upgrade: withStore });

    const first = await accessor.get();
    accessor.close();
    const second = await accessor.get();

    expect(second).not.toBe(first);

    accessor.close();
  });

  it('invalidate() drops only the connection it is given', async () => {
    const accessor = createDbAccessor({ name: nextDbName(), version: 1, upgrade: withStore });

    const first = await accessor.get();
    accessor.invalidate(first);
    const second = await accessor.get();
    expect(second).not.toBe(first);

    // `first` is no longer cached, so invalidating it again must not evict `second`.
    accessor.invalidate(first);
    expect(await accessor.get()).toBe(second);

    accessor.close();
  });

  it('rejects when the database cannot be opened, and retries on the next get()', async () => {
    const name = nextDbName();
    await blockVersion(name, 2);
    const accessor = createDbAccessor({ name, version: 1, upgrade: withStore });

    await expect(accessor.get()).rejects.toThrow();

    await deleteDb(name);
    await expect(accessor.get()).resolves.not.toBeNull();

    accessor.close();
  });

  it('degrades to null with onUnavailable, and stays null once it has failed', async () => {
    const name = nextDbName();
    await blockVersion(name, 2);
    const accessor = createDbAccessor({
      name,
      version: 1,
      upgrade: withStore,
      onUnavailable: () => null,
    });

    expect(await accessor.get()).toBeNull();

    // The obstacle is gone, but the failure is remembered: no retry.
    await deleteDb(name);
    expect(await accessor.get()).toBeNull();

    accessor.close();
  });
});
