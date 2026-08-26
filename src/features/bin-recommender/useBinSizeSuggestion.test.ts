// @vitest-environment jsdom
import { renderHook, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinSizePrediction } from './types';

vi.mock('./loadModel', () => ({ loadBinRecommenderModel: vi.fn() }));
vi.mock('./recommender', () => ({ recommendBinSize: vi.fn() }));

import { loadBinRecommenderModel } from './loadModel';
import { recommendBinSize } from './recommender';
import { useBinSizeSuggestion } from './useBinSizeSuggestion';

const reco = vi.mocked(recommendBinSize);
const load = vi.mocked(loadBinRecommenderModel);

const MODEL = {
  schemaVersion: 1,
  vocabVersion: 'v1',
  source: 'label_hash_high',
  trainedAt: '',
  sampleCount: 0,
  byLabelHash: {},
  byEmbedBucket: {},
  byDrawer: {},
} as const;

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
    reco.mockReset();
    load.mockReset();
    load.mockResolvedValue(MODEL);
  });

  it('returns a label-tier prediction that differs from the current size', async () => {
    reco.mockReturnValue(pred({}));
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.size).toEqual({ width: 2, depth: 2, height: 3 });
  });

  it('recovers when connectivity returns after a failed model fetch', async () => {
    reco.mockReturnValue(pred({}));
    load.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(MODEL);

    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    // Flush the rejection handler and the resulting state change so the
    // reconnect listener is attached before the event fires.
    await act(async () => {});
    expect(result.current).toBeNull();

    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('suppresses the drawer-prior tier', async () => {
    reco.mockReturnValue(pred({ source: 'drawer' }));
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    // Give the model load + memo a chance to run, then assert it stays null.
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });

  it('returns null when the suggestion equals the current size', async () => {
    reco.mockReturnValue(
      pred({ size: { width: gridUnits(1), depth: gridUnits(1), height: heightUnits(3) } })
    );
    const { result } = renderHook(() => useBinSizeSuggestion('screws', drawer, current));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
  });

  it('returns null for a blank label', async () => {
    reco.mockReturnValue(pred({}));
    const { result } = renderHook(() => useBinSizeSuggestion('   ', drawer, current));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current).toBeNull();
    expect(reco).not.toHaveBeenCalled();
  });
});
