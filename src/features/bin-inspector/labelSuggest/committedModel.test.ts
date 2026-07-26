import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { MODEL_SCHEMA_VERSION, isModelUsable, modelScore } from './model';
import type { LabelSuggesterModel } from './model';

// Guards the committed artifact itself. `loadModel.test.ts` stubs fetch to cover
// transport, so without this nothing would notice a retrain committing a model
// the running code cannot use.
const committed = JSON.parse(
  readFileSync(new URL('./labelSuggester.model.json', import.meta.url), 'utf8')
) as LabelSuggesterModel;

describe('committed labelSuggester.model.json', () => {
  it('declares the schema version the client supports', () => {
    expect(committed.schemaVersion).toBe(MODEL_SCHEMA_VERSION);
  });

  it('is usable — a retrain that emptied it would silently disable the prior', () => {
    expect(isModelUsable(committed)).toBe(true);
  });

  it('carries the maps modelScore reads', () => {
    expect(committed.popularity).toBeTypeOf('object');
    expect(committed.cooccur).toBeTypeOf('object');
    expect(Object.keys(committed.popularity).length).toBeGreaterThan(0);
  });

  it('stores only normalized weights in 0..1', () => {
    const bad = Object.entries(committed.popularity).filter(
      ([, p]) => !Number.isFinite(p) || p < 0 || p > 1
    );
    expect(bad).toEqual([]);
  });

  it('scores a real key above an absent one', () => {
    const [hash] = Object.keys(committed.popularity);
    expect(modelScore(committed, hash, [])).toBeGreaterThan(
      modelScore(committed, '__not_a_real_hash__', [])
    );
  });
});
