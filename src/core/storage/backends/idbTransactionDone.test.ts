import { afterEach, describe, expect, it, vi } from 'vitest';
import { deleteDB, openDB } from 'idb';
import type { IDBPDatabase } from 'idb';

const DB_NAME = 'idb-transaction-done-test';

async function openWithOneRecord(): Promise<IDBPDatabase> {
  const db = await openDB(DB_NAME, 1, {
    upgrade(upgradeDb) {
      upgradeDb.createObjectStore('things');
    },
  });
  await db.put('things', 'first', 'a');
  return db;
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

describe("idb's transaction done promise", () => {
  let db: IDBPDatabase | null = null;

  afterEach(async () => {
    db?.close();
    db = null;
    await deleteDB(DB_NAME);
  });

  it('raises no unhandled rejection when a request in the transaction fails', async () => {
    db = await openWithOneRecord();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    const tx = db.transaction('things', 'readwrite');
    await expect(tx.store.add('second', 'a')).rejects.toThrow();
    await settle();

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it('still rejects for a caller that awaits it', async () => {
    db = await openWithOneRecord();
    const tx = db.transaction('things', 'readwrite');
    const done = tx.done;

    await expect(tx.store.add('second', 'a')).rejects.toThrow();
    await expect(done).rejects.toThrow();
  });
});
