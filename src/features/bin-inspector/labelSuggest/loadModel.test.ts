import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MODEL_SCHEMA_VERSION } from './model';
import type * as LoadModelModule from './loadModel';

const TRAINED = {
  schemaVersion: MODEL_SCHEMA_VERSION,
  vocabVersion: 'v1',
  trainedAt: '2026-01-01T00:00:00Z',
  sampleCount: 42,
  popularity: { abc: 0.5 },
  cooccur: { abc: { def: 0.25 } },
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

/** The module caches its promise, so every case needs a fresh module registry. */
async function freshLoader(): Promise<typeof LoadModelModule> {
  vi.resetModules();
  return import('./loadModel');
}

describe('loadLabelSuggesterModel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the model and caches the promise across calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(TRAINED));
    vi.stubGlobal('fetch', fetchMock);
    const { loadLabelSuggesterModel } = await freshLoader();

    const first = loadLabelSuggesterModel();
    const second = loadLabelSuggesterModel();
    expect(first).toBe(second);
    await expect(first).resolves.toEqual(TRAINED);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to EMPTY_MODEL on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(null, false, 404)));
    const { loadLabelSuggesterModel } = await freshLoader();

    const model = await loadLabelSuggesterModel();
    expect(model.sampleCount).toBe(0);
    expect(model.schemaVersion).toBe(MODEL_SCHEMA_VERSION);
  });

  it('falls back to EMPTY_MODEL on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { loadLabelSuggesterModel } = await freshLoader();

    await expect(loadLabelSuggesterModel()).resolves.toMatchObject({ sampleCount: 0 });
  });

  it('rejects a malformed payload rather than trusting it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ schemaVersion: 1 })));
    const { loadLabelSuggesterModel } = await freshLoader();

    await expect(loadLabelSuggesterModel()).resolves.toMatchObject({ sampleCount: 0 });
  });

  it('rejects a payload from an unsupported schema version', async () => {
    const future = { ...TRAINED, schemaVersion: MODEL_SCHEMA_VERSION + 1 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(future)));
    const { loadLabelSuggesterModel } = await freshLoader();

    await expect(loadLabelSuggesterModel()).resolves.toMatchObject({ sampleCount: 0 });
  });

  it('retries after a failure instead of caching the rejection', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(jsonResponse(TRAINED));
    vi.stubGlobal('fetch', fetchMock);
    const { loadLabelSuggesterModel } = await freshLoader();

    await expect(loadLabelSuggesterModel()).resolves.toMatchObject({ sampleCount: 0 });
    await expect(loadLabelSuggesterModel()).resolves.toEqual(TRAINED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
