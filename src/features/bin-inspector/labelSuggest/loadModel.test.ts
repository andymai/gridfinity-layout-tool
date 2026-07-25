import { describe, it, expect } from 'vitest';
import { loadLabelSuggesterModel } from './loadModel';

describe('loadLabelSuggesterModel', () => {
  it('loads the committed model and caches the promise', async () => {
    const first = loadLabelSuggesterModel();
    const second = loadLabelSuggesterModel();
    expect(first).toBe(second); // cached

    const model = await first;
    expect(model.schemaVersion).toBe(1);
    // A valid model regardless of whether it's the inert placeholder or trained.
    expect(model.sampleCount).toBeGreaterThanOrEqual(0);
    expect(typeof model.popularity).toBe('object');
    expect(typeof model.cooccur).toBe('object');
  });
});
