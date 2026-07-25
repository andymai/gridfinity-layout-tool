import { describe, it, expect } from 'vitest';
import { loadLabelSuggesterModel } from './loadModel';

describe('loadLabelSuggesterModel', () => {
  it('loads the committed model and caches the promise', async () => {
    const first = loadLabelSuggesterModel();
    const second = loadLabelSuggesterModel();
    expect(first).toBe(second); // cached

    const model = await first;
    expect(model.schemaVersion).toBe(1);
    // The committed placeholder is inert until a trained model replaces it.
    expect(model.sampleCount).toBe(0);
  });
});
