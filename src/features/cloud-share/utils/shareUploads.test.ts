import { describe, it, expect, beforeEach } from 'vitest';
import {
  __resetShareUploadsForTests,
  dropWaitingUpload,
  keepShareLayout,
  queueShareUpload,
  type ShareUpload,
} from './shareUploads';

const SHARE = 'share-1';

/** An upload whose result the test gives; `runs` lists the keys in run order. */
function uploads() {
  const runs: string[] = [];
  const finishers: ((saved: boolean) => void)[] = [];
  const make = (key: string): ShareUpload => ({
    key,
    run: () =>
      new Promise<boolean>((resolve) => {
        runs.push(key);
        finishers.push(resolve);
      }),
  });
  const finishNext = async (saved: boolean): Promise<void> => {
    finishers.shift()?.(saved);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { runs, make, finishNext };
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

  it('skips a waiting request for the layout that the link just took', async () => {
    const { runs, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a'));
    queueShareUpload(SHARE, make('a'));
    await finishNext(true);
    expect(runs).toEqual(['a']);
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
