import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { err, ok, type ErrorCode } from '@/core/result';
import {
  __resetShareUploadsForTests,
  dropWaitingUpload,
  keepShareLayout,
  queueShareUpload,
  UPLOAD_RETRY_DELAYS_MS,
  type ShareUpload,
  type UploadAnswer,
} from './shareUploads';

const SHARE = 'share-1';

/**
 * Uploads whose result the test gives. `runs` lists the keys in send order,
 * and `records` the name of each request that recorded a save.
 */
function uploads() {
  const runs: string[] = [];
  const records: string[] = [];
  const finishers: ((answer: UploadAnswer) => void)[] = [];
  const make = (key: string, name = key): ShareUpload => ({
    key,
    send: () =>
      new Promise<UploadAnswer>((resolve) => {
        runs.push(key);
        finishers.push(resolve);
      }),
    record: () => {
      records.push(name);
    },
  });
  const answerNext = async (answer: UploadAnswer): Promise<void> => {
    finishers.shift()?.(answer);
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  /** A save, or an answer that a retry cannot change. */
  const finishNext = (saved: boolean): Promise<void> =>
    answerNext(
      saved ? ok({ lastUpdatedAt: '2026-11-01T10:00:00.000Z' }) : err({ code: 'API_UNAUTHORIZED' })
    );
  const failNext = (code: ErrorCode = 'API_SERVER_ERROR'): Promise<void> =>
    answerNext(err({ code }));
  return { runs, records, make, finishNext, failNext };
}

describe('shareUploads', () => {
  beforeEach(() => {
    __resetShareUploadsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  describe('an upload that failed with a retryable error', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('runs again after a wait, and records the save', async () => {
      const { runs, records, make, failNext, finishNext } = uploads();
      queueShareUpload(SHARE, make('a'));
      await failNext('API_SERVER_ERROR');
      await vi.advanceTimersByTimeAsync(UPLOAD_RETRY_DELAYS_MS[0] - 1);
      expect(runs).toEqual(['a']);

      await vi.advanceTimersByTimeAsync(1);
      expect(runs).toEqual(['a', 'a']);
      await finishNext(true);
      expect(records).toEqual(['a']);
    });

    it.each<ErrorCode>(['API_NETWORK_ERROR', 'API_RATE_LIMITED', 'API_TIMEOUT'])(
      'runs again after %s',
      async (code) => {
        const { runs, make, failNext } = uploads();
        queueShareUpload(SHARE, make('a'));
        await failNext(code);
        await vi.advanceTimersByTimeAsync(UPLOAD_RETRY_DELAYS_MS[0]);
        expect(runs).toEqual(['a', 'a']);
      }
    );

    it('stops after the last wait', async () => {
      const { runs, make, failNext } = uploads();
      queueShareUpload(SHARE, make('a'));
      for (const delay of UPLOAD_RETRY_DELAYS_MS) {
        await failNext();
        await vi.advanceTimersByTimeAsync(delay);
      }
      await failNext();
      await vi.runAllTimersAsync();
      expect(runs).toHaveLength(UPLOAD_RETRY_DELAYS_MS.length + 1);
    });

    it('gives way to a newer upload', async () => {
      const { runs, make, failNext } = uploads();
      queueShareUpload(SHARE, make('a'));
      await failNext();
      queueShareUpload(SHARE, make('b'));
      await vi.runAllTimersAsync();
      expect(runs).toEqual(['a', 'b']);
    });

    it('stops when the link holds the layout, or a newer one replaces it', async () => {
      const { runs, make, failNext } = uploads();
      queueShareUpload(SHARE, make('a'));
      await failNext();
      keepShareLayout(SHARE, make('saved'));
      await vi.runAllTimersAsync();
      expect(runs).toEqual(['a']);

      queueShareUpload(SHARE, make('b'));
      await failNext();
      dropWaitingUpload(SHARE);
      await vi.runAllTimersAsync();
      expect(runs).toEqual(['a', 'b']);
    });
  });

  it('does not run again when the link refused the upload, or the send threw', async () => {
    vi.useFakeTimers();
    const { runs, make, finishNext } = uploads();
    queueShareUpload(SHARE, make('a'));
    await finishNext(false);
    queueShareUpload(SHARE, {
      key: 'b',
      send: () => {
        runs.push('b');
        return Promise.reject(new Error('bug'));
      },
      record: () => undefined,
    });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    await vi.runAllTimersAsync();
    expect(runs).toEqual(['a', 'b']);
  });
});
