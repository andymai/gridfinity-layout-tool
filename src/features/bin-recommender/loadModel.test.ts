import { describe, it, expect, vi, afterEach } from 'vitest';
import type * as LoadModelModule from './loadModel';

const MODEL = {
  schemaVersion: 1,
  vocabVersion: 'v1',
  source: 'label_hash_high',
  trainedAt: '2026-01-01T00:00:00Z',
  sampleCount: 10,
  byLabelHash: { abc: [{ n: 5, p: 0.5, size: '1x1x3' }] },
  byEmbedBucket: {},
  byDrawer: {},
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

/** The module caches its promise, so every case needs a fresh module registry. */
async function freshLoader(): Promise<typeof LoadModelModule> {
  vi.resetModules();
  return import('./loadModel');
}

describe('loadBinRecommenderModel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the model once and shares the promise across callers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(MODEL));
    vi.stubGlobal('fetch', fetchMock);
    const { loadBinRecommenderModel } = await freshLoader();

    const first = loadBinRecommenderModel();
    const second = loadBinRecommenderModel();
    expect(first).toBe(second);
    await expect(first).resolves.toEqual(MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // Unlike the label suggester there is no inert fallback — the hook swallows the
  // rejection and simply shows no suggestion.
  it('rejects on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 500)));
    const { loadBinRecommenderModel } = await freshLoader();

    await expect(loadBinRecommenderModel()).rejects.toThrow(/500/);
  });

  it('rejects a payload missing the lookup tables', async () => {
    const partial = { schemaVersion: 1, byLabelHash: {} };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(partial)));
    const { loadBinRecommenderModel } = await freshLoader();

    await expect(loadBinRecommenderModel()).rejects.toThrow(/malformed/);
  });

  it('rejects lookup tables that are arrays, not records', async () => {
    const arrayTables = { ...MODEL, byLabelHash: [], byEmbedBucket: [], byDrawer: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(arrayTables)));
    const { loadBinRecommenderModel } = await freshLoader();

    await expect(loadBinRecommenderModel()).rejects.toThrow(/malformed/);
  });

  it('does not cache a rejection — a transient failure can retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse(MODEL));
    vi.stubGlobal('fetch', fetchMock);
    const { loadBinRecommenderModel } = await freshLoader();

    await expect(loadBinRecommenderModel()).rejects.toThrow('offline');
    await expect(loadBinRecommenderModel()).resolves.toEqual(MODEL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('accepts an unsupported schemaVersion — recommendBinSize owns that check', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ ...MODEL, schemaVersion: 99 }))
    );
    const { loadBinRecommenderModel } = await freshLoader();

    await expect(loadBinRecommenderModel()).resolves.toMatchObject({ schemaVersion: 99 });
  });
});
