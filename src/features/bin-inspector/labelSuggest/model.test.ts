import { describe, it, expect } from 'vitest';
import { EMPTY_MODEL, isModelUsable, modelScore, type LabelSuggesterModel } from './model';

describe('isModelUsable', () => {
  it('rejects null, empty, and wrong-schema models', () => {
    expect(isModelUsable(null)).toBe(false);
    expect(isModelUsable(undefined)).toBe(false);
    expect(isModelUsable(EMPTY_MODEL)).toBe(false); // sampleCount 0
    expect(isModelUsable({ ...EMPTY_MODEL, sampleCount: 10, schemaVersion: 999 })).toBe(false);
  });

  it('accepts a populated model at the current schema', () => {
    expect(isModelUsable({ ...EMPTY_MODEL, sampleCount: 10 })).toBe(true);
  });
});

describe('modelScore', () => {
  const model: LabelSuggesterModel = {
    ...EMPTY_MODEL,
    sampleCount: 100,
    popularity: { cand: 1.0 },
    cooccur: { nbr: { cand: 1.0 } },
  };

  it('adds a popularity prior for a known candidate', () => {
    expect(modelScore(model, 'cand', [])).toBeGreaterThan(0);
  });

  it('adds neighbor co-occurrence on top of popularity', () => {
    expect(modelScore(model, 'cand', ['nbr'])).toBeGreaterThan(modelScore(model, 'cand', []));
  });

  it('is zero for an unknown candidate with unrelated neighbors', () => {
    expect(modelScore(model, 'unknown', ['nbr'])).toBe(0);
  });

  it('caps co-occurrence so it cannot dominate arbitrarily', () => {
    const many: LabelSuggesterModel = {
      ...EMPTY_MODEL,
      sampleCount: 100,
      popularity: {},
      cooccur: { a: { cand: 1 }, b: { cand: 1 }, c: { cand: 1 } },
    };
    // Three neighbors each fully co-occurring — still capped at the single-hit weight.
    expect(modelScore(many, 'cand', ['a', 'b', 'c'])).toBe(modelScore(many, 'cand', ['a']));
  });
});
