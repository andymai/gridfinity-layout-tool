import { describe, it, expect, beforeEach } from 'vitest';
import { readAllLocalStorage, readAllIndexedDB } from './wwwMigration';

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
});

// ─── readAllLocalStorage ─────────────────────────────────────────────────────

describe('readAllLocalStorage', () => {
  it('returns empty object when localStorage is empty', () => {
    expect(readAllLocalStorage()).toEqual({});
  });

  it('collects all gridfinity-* keys', () => {
    localStorage.setItem('gridfinity-settings-v1', '{"theme":"dark"}');
    localStorage.setItem('gridfinity-library-v1', '[]');
    localStorage.setItem('gridfinity-user-id', 'abc-123');

    const result = readAllLocalStorage();

    expect(result).toEqual({
      'gridfinity-settings-v1': '{"theme":"dark"}',
      'gridfinity-library-v1': '[]',
      'gridfinity-user-id': 'abc-123',
    });
  });

  it('ignores non-gridfinity keys', () => {
    localStorage.setItem('gridfinity-settings-v1', '{}');
    localStorage.setItem('other-app-key', 'value');
    localStorage.setItem('posthog-data', 'value');

    const result = readAllLocalStorage();

    expect(Object.keys(result)).toEqual(['gridfinity-settings-v1']);
  });

  it('handles all known gridfinity key patterns', () => {
    const knownKeys = [
      'gridfinity-layout-550e8400-e29b-41d4-a716-446655440000',
      'gridfinity-library-v1',
      'gridfinity-library-active-id',
      'gridfinity-settings-v1',
      'gridfinity-labs-v1',
      'gridfinity-half-bin-mode',
      'gridfinity-settings-active-tab',
      'gridfinity-user-id',
      'gridfinity-analytics-v1',
      'gridfinity-ml-user-hash-v1',
      'gridfinity-designer-active-v1',
      'gridfinity-indexeddb-migrated',
      'gridfinity-localstorage-cleaned',
      'gridfinity-shared-with-me-v1',
    ];

    for (const key of knownKeys) {
      localStorage.setItem(key, 'test-value');
    }

    const result = readAllLocalStorage();
    expect(Object.keys(result)).toHaveLength(knownKeys.length);

    for (const key of knownKeys) {
      expect(result[key]).toBe('test-value');
    }
  });
});

// ─── readAllIndexedDB ────────────────────────────────────────────────────────

/** Helper: delete an IDB database and wait for completion. */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Helper: create a database with stores and seed data. */
function seedDatabase(
  name: string,
  version: number,
  setup: (db: IDBDatabase) => void,
  seed: (db: IDBDatabase) => Promise<void>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = () => setup(req.result);
    req.onsuccess = () => {
      void seed(req.result).then(() => {
        req.result.close();
        resolve();
      });
    };
    req.onerror = () => reject(req.error ?? new Error('Failed to open database'));
  });
}

describe('readAllIndexedDB', () => {
  beforeEach(async () => {
    await deleteDatabase('gridfinity-db');
    await deleteDatabase('gridfinity-designer-v1');
  });

  it('returns empty object when no databases exist', async () => {
    const result = await readAllIndexedDB();
    expect(result).toEqual({});
  });

  it('reads records from gridfinity-db stores', async () => {
    await seedDatabase(
      'gridfinity-db',
      3,
      (db) => {
        db.createObjectStore('layouts');
        db.createObjectStore('snapshots', { keyPath: 'id' });
        db.createObjectStore('library');
        db.createObjectStore('ml-data');
        db.createObjectStore('shared-with-me');
      },
      async (db) => {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('layouts', 'readwrite');
          tx.objectStore('layouts').put({ name: 'My Layout' }, 'layout-1');
          tx.oncomplete = () => resolve();
        });
      }
    );

    const result = await readAllIndexedDB();

    expect(result['gridfinity-db']).toBeDefined();
    expect(result['gridfinity-db']['layouts']).toHaveLength(1);
    expect(result['gridfinity-db']['layouts'][0].key).toBe('layout-1');
    expect(result['gridfinity-db']['layouts'][0].value).toEqual({ name: 'My Layout' });
  });

  it('reads records from gridfinity-designer-v1', async () => {
    await seedDatabase(
      'gridfinity-designer-v1',
      1,
      (db) => {
        db.createObjectStore('designs', { keyPath: 'id' });
      },
      async (db) => {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('designs', 'readwrite');
          tx.objectStore('designs').put({ id: 'design-1', name: 'Test Design' });
          tx.oncomplete = () => resolve();
        });
      }
    );

    const result = await readAllIndexedDB();

    expect(result['gridfinity-designer-v1']).toBeDefined();
    expect(result['gridfinity-designer-v1']['designs']).toHaveLength(1);
    expect(result['gridfinity-designer-v1']['designs'][0].value).toEqual({
      id: 'design-1',
      name: 'Test Design',
    });
  });

  it('skips databases with no data', async () => {
    await seedDatabase(
      'gridfinity-db',
      3,
      (db) => {
        db.createObjectStore('layouts');
        db.createObjectStore('snapshots', { keyPath: 'id' });
        db.createObjectStore('library');
        db.createObjectStore('ml-data');
        db.createObjectStore('shared-with-me');
      },
      async () => {
        // No data seeded
      }
    );

    const result = await readAllIndexedDB();
    expect(result['gridfinity-db']).toBeUndefined();
  });

  it('reads from both databases when both have data', async () => {
    await seedDatabase(
      'gridfinity-db',
      3,
      (db) => {
        db.createObjectStore('layouts');
        db.createObjectStore('snapshots', { keyPath: 'id' });
        db.createObjectStore('library');
        db.createObjectStore('ml-data');
        db.createObjectStore('shared-with-me');
      },
      async (db) => {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('layouts', 'readwrite');
          tx.objectStore('layouts').put({ name: 'Layout' }, 'l-1');
          tx.oncomplete = () => resolve();
        });
      }
    );

    await seedDatabase(
      'gridfinity-designer-v1',
      1,
      (db) => {
        db.createObjectStore('designs', { keyPath: 'id' });
      },
      async (db) => {
        await new Promise<void>((resolve) => {
          const tx = db.transaction('designs', 'readwrite');
          tx.objectStore('designs').put({ id: 'd-1', name: 'Design' });
          tx.oncomplete = () => resolve();
        });
      }
    );

    const result = await readAllIndexedDB();

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['gridfinity-db']['layouts']).toHaveLength(1);
    expect(result['gridfinity-designer-v1']['designs']).toHaveLength(1);
  });
});
