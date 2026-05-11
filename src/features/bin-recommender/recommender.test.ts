import { describe, it, expect } from 'vitest';
import { processLabel } from '@/shared/analytics/labelVocabulary';
import { gridUnits, heightUnits } from '@/core/types';
import { recommendBinSize } from './recommender';
import type { BinRecommenderModel } from './types';

const DRAWER = { width: gridUnits(8), depth: gridUnits(12), height: heightUnits(4) };

function emptyModel(overrides: Partial<BinRecommenderModel> = {}): BinRecommenderModel {
  return {
    schemaVersion: 1,
    vocabVersion: 'v1',
    source: 'label_hash_high',
    trainedAt: '2026-05-11T00:00:00+00:00',
    sampleCount: 0,
    byLabelHash: {},
    byEmbedBucket: {},
    byDrawer: {},
    ...overrides,
  };
}

describe('recommendBinSize', () => {
  it('returns null when the label has no support and there is no drawer prior', () => {
    const result = recommendBinSize({
      label: 'screws',
      drawer: DRAWER,
      model: emptyModel(),
    });
    expect(result).toBeNull();
  });

  it('hits PRIMARY on an exact label-hash match', () => {
    const { hash } = processLabel('screws');
    const model = emptyModel({
      byLabelHash: {
        [hash]: [{ size: '2x3x6', p: 0.6, n: 40 }],
      },
    });
    const result = recommendBinSize({ label: 'screws', drawer: DRAWER, model });
    expect(result).toEqual({
      size: { width: 2, depth: 3, height: 6 },
      p: 0.6,
      n: 40,
      source: 'label',
    });
  });

  it('skips PRIMARY when sample count is below the floor', () => {
    const { hash } = processLabel('rare');
    const model = emptyModel({
      byLabelHash: { [hash]: [{ size: '1x1x3', p: 1.0, n: 5 }] },
    });
    expect(recommendBinSize({ label: 'rare', drawer: DRAWER, model })).toBeNull();
  });

  it('falls back to ENRICHMENT via the embedding bucket', () => {
    const { embedding_bucket } = processLabel('uncatalogued_item_xyz');
    const model = emptyModel({
      byEmbedBucket: {
        [embedding_bucket]: [{ size: '1x2x3', p: 0.4, n: 25 }],
      },
    });
    const result = recommendBinSize({
      label: 'uncatalogued_item_xyz',
      drawer: DRAWER,
      model,
    });
    expect(result?.source).toBe('embed');
    expect(result?.size).toEqual({ width: 1, depth: 2, height: 3 });
  });

  it('falls back to the drawer prior when nothing else hits', () => {
    const model = emptyModel({
      byDrawer: {
        '8x12x4': [{ size: '2x2x4', p: 0.3, n: 80 }],
      },
    });
    const result = recommendBinSize({ label: 'mystery', drawer: DRAWER, model });
    expect(result?.source).toBe('drawer');
    expect(result?.size).toEqual({ width: 2, depth: 2, height: 4 });
  });

  it('returns null when the drawer prior is below threshold', () => {
    const model = emptyModel({
      byDrawer: { '8x12x4': [{ size: '2x2x4', p: 0.3, n: 10 }] },
    });
    expect(recommendBinSize({ label: '', drawer: DRAWER, model })).toBeNull();
  });

  it('returns null on schemaVersion mismatch', () => {
    const { hash } = processLabel('screws');
    const model = emptyModel({
      schemaVersion: 999,
      byLabelHash: { [hash]: [{ size: '2x3x6', p: 0.6, n: 40 }] },
    });
    expect(recommendBinSize({ label: 'screws', drawer: DRAWER, model })).toBeNull();
  });

  it('returns null on vocabVersion mismatch (silent — diagnostic is the caller’s job)', () => {
    const { hash } = processLabel('screws');
    const model = emptyModel({
      vocabVersion: 'v_stale',
      byLabelHash: { [hash]: [{ size: '2x3x6', p: 0.6, n: 40 }] },
    });
    expect(recommendBinSize({ label: 'screws', drawer: DRAWER, model })).toBeNull();
  });

  it('prefers PRIMARY over ENRICHMENT when both have support', () => {
    const { hash, embedding_bucket } = processLabel('screws');
    const model = emptyModel({
      byLabelHash: { [hash]: [{ size: '2x3x6', p: 0.6, n: 40 }] },
      byEmbedBucket: { [embedding_bucket]: [{ size: '5x5x5', p: 0.9, n: 50 }] },
    });
    const result = recommendBinSize({ label: 'screws', drawer: DRAWER, model });
    expect(result?.source).toBe('label');
  });

  it('rejects malformed size strings in the model', () => {
    const { hash } = processLabel('broken');
    const model = emptyModel({
      byLabelHash: { [hash]: [{ size: '0x0x0', p: 1.0, n: 100 }] },
    });
    expect(recommendBinSize({ label: 'broken', drawer: DRAWER, model })).toBeNull();
  });

  it('scans past a malformed top entry to the next valid one', () => {
    const { hash } = processLabel('mixed');
    const model = emptyModel({
      byLabelHash: {
        [hash]: [
          { size: 'not-a-size', p: 0.7, n: 50 },
          { size: '2x2x4', p: 0.2, n: 30 },
        ],
      },
    });
    const result = recommendBinSize({ label: 'mixed', drawer: DRAWER, model });
    expect(result?.size).toEqual({ width: 2, depth: 2, height: 4 });
    expect(result?.n).toBe(30);
  });

  it('stops scanning once samples drop below the threshold', () => {
    const { hash } = processLabel('borderline');
    const model = emptyModel({
      byLabelHash: {
        [hash]: [
          { size: 'bad', p: 0.7, n: 50 },
          { size: '1x1x3', p: 0.2, n: 5 }, // below MIN_SAMPLES_FOR_LABEL (10)
        ],
      },
    });
    expect(recommendBinSize({ label: 'borderline', drawer: DRAWER, model })).toBeNull();
  });

  it('skips PRIMARY for whitespace-only labels and tries the drawer prior', () => {
    const model = emptyModel({
      byDrawer: { '8x12x4': [{ size: '1x1x3', p: 0.5, n: 60 }] },
    });
    const result = recommendBinSize({ label: '   ', drawer: DRAWER, model });
    expect(result?.source).toBe('drawer');
  });
});
