import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetShareUploadsForTests,
  dropWaitingUpload,
  keepShareLayout,
  queueShareUpload,
  type SavedUpload,
  type ShareUpload,
} from './shareUploads';

const SHARE = 'share-1';

/**
 * Uploads whose result the test gives. `runs` lists the keys in send order,
 * and `records` the name of each request that recorded a save.
 */
function uploads() {
  const runs: string[] = [];
  const records: string[] = [];
  const finishers: ((saved: SavedUpload | null) => void)[] = [];
  const make = (key: string, name = key): ShareUpload => ({
    key,
    send: () =>
      new Promise<SavedUpload | null>((resolve) => {
        runs.push(key);
        finishers.push(resolve);
      }),
    record: () => {
      records.push(name);
    },
  });
  const finishNext = async (saved: boolean): Promise<void> => {
    finishers.shift()?.(saved ? { lastUpdatedAt: '2026-11-01T10:00:00.000Z' } : null);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { runs, records, make, finishNext };
}

describe('shareUploads', () => {
  beforeEach(() => {
    __resetShareUploadsForTests();
  });

  it('runs one upload at a time, then the latest request that waited', async () => {
    const { runs, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a'));
    queueShareUpload(SHARE, make('b'));
    queueShareUpload(SHARE, make('c'));
    expect(runs).toEqual(['a']);

    await finishNext(true);
    expect(runs).toEqual(['a', 'c']);
  });

  it('runs uploads to other shares at once', () => {
    const { runs, make } = uploads();
    queueShareUpload(SHARE, make('a'));
    queueShareUpload('share-2', make('b'));
    expect(runs).toEqual(['a', 'b']);
  });

  it('records, and does not send, a waiting request for the layout that the link just took', async () => {
    const { runs, records, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a', 'first'));
    queueShareUpload(SHARE, make('a', 'second'));
    await finishNext(true);
    expect(runs).toEqual(['a']);
    expect(records).toEqual(['first', 'second']);
  });

  it('records nothing for an upload that the link did not take', async () => {
    const { records, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a'));
    await finishNext(false);
    expect(records).toEqual([]);
  });

  it('runs a waiting request for the same layout when the upload fails', async () => {
    const { runs, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a'));
    queueShareUpload(SHARE, make('a'));
    await finishNext(false);
    expect(runs).toEqual(['a', 'a']);
  });

  it('keeps a saved layout only behind an upload that can replace it', async () => {
    const { runs, make, finishNext } = uploads();
    keepShareLayout(SHARE, make('saved'));
    expect(runs).toEqual([]);

    queueShareUpload(SHARE, make('a'));
    queueShareUpload(SHARE, make('b'));
    keepShareLayout(SHARE, make('saved'));
    await finishNext(true);
    expect(runs).toEqual(['a', 'saved']);
  });

  it('drops what waits', async () => {
    const { runs, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a'));
    queueShareUpload(SHARE, make('b'));
    dropWaitingUpload(SHARE);
    await finishNext(true);
    expect(runs).toEqual(['a']);
  });
});
