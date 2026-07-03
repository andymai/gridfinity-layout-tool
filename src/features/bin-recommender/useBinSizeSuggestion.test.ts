// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinSizePrediction } from './types';

vi.mock('@/shared/hooks/useFeatureFlag', () => ({ useFeatureFlag: vi.fn() }));
vi.mock('./model.json', () => ({
  default: {
    schemaVersion: 1,
    vocabVersion: 'v1',
    source: 'label_hash_high',
    trainedAt: '',
    sampleCount: 0,
    byLabelHash: {},
    byEmbedBucket: {},
    byDrawer: {},
  },
}));
vi.mock('./recommender', () => ({ recommendBinSize: vi.fn() }));

import { useFeatureFlag } from '@/shared/hooks/useFeatureFlag';
import { recommendBinSize } from './recommender';
import { useBinSizeSuggestion } from './useBinSizeSuggestion';

const flag = vi.mocked(useFeatureFlag);
const reco = vi.mocked(recommendBinSize);

const drawer = { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) };
const current = { width: gridUnits(1), depth: gridUnits(1), height: heightUnits(3) };
const pred = (over: Partial<BinSizePrediction>): BinSizePrediction => ({
  size: { width: gridUnits(2), depth: gridUnits(2), height: heightUnits(3) },
  p: 0.6,
  n: 40,
  source: 'label',
  ...over,
});

describe('useBinSizeSuggestion', () => {
  beforeEach(() => {
    flag.mockReset();
    reco.mockReset();
  });

  it('returns null when the flag is off (and never loads the model)', () => {
    flag.mockReturnValue(false);
    reco.mockReturnValue(pred({}));
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    expect(result.current).toBeNull();
    expect(reco).not.toHaveBeenCalled();
  });

  it('returns a label-tier prediction that differs from the current size', async () => {
    flag.mockReturnValue(true);
    reco.mockReturnValue(pred({}));
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.size).toEqual({ width: 2, depth: 2, height: 3 });
  });

  it('suppresses the drawer-prior tier', async () => {
    flag.mockReturnValue(true);
    reco.mockReturnValue(pred({ source: 'drawer' }));
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    // Give the model load + memo a chance to run, then assert it stays null.
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });

  it('returns null when the suggestion equals the current size', async () => {
    flag.mockReturnValue(true);
    reco.mockReturnValue(
      pred({ size: { width: gridUnits(1), depth: gridUnits(1), height: heightUnits(3) } })
    );
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });

  it('returns null for a blank label', async () => {
    flag.mockReturnValue(true);
    reco.mockReturnValue(pred({}));
    const { result } = renderHook(() => useBinSizeSuggestion('   ', drawer, current));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
    expect(reco).not.toHaveBeenCalled();
  });
});
