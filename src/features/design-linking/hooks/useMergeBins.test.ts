import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMergeBins } from './useMergeBins';
import { createTestBin, createTestLayout, resetAllStores } from '@/test/testUtils';
import { useLayoutStore, useSelectionStore } from '@/core/store';
import { ok, err } from '@/core/result';
import { binId, layerId, gridUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import type { Bin } from '@/core/types';
import type * as BinDesignerModule from '@/features/bin-designer';
import type * as CoreStoreModule from '@/core/store';

const saveDesign = vi.fn();
const addToast = vi.fn();

// Partial: the domain module imports normalizeIdsWithRemap / validateBinParams
// from this same barrel, so replacing it wholesale breaks planMergedBin.
vi.mock('@/features/bin-designer', async (importOriginal) => {
  const actual = await importOriginal<typeof BinDesignerModule>();
  return { ...actual, saveDesign: (...args: unknown[]) => saveDesign(...args) };
});

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/core/store', async (importOriginal) => {
  const actual = await importOriginal<typeof CoreStoreModule>();
  return {
    ...actual,
    useToastStore: (selector: (s: { addToast: typeof addToast }) => unknown) =>
      selector({ addToast }),
  };
});

function bin(id: string, x: number, layer = 'layer1'): Bin {
  return createTestBin({
    id: binId(id),
    layerId: layerId(layer),
    x: gridUnits(x),
    width: gridUnits(1),
    depth: gridUnits(1),
  });
}

function seed(bins: Bin[], selected: string[] = []): void {
  useLayoutStore.setState({ layout: createTestLayout({ bins }) });
  useSelectionStore.setState({
    activeLayerId: layerId('layer1'),
    selectedBinIds: selected.map(binId),
  });
}

describe('useMergeBins', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    saveDesign.mockResolvedValue(ok({ id: 'design_merged' }));
    window.history.pushState(null, '', '/');
  });

  describe('scope', () => {
    it('falls back to the whole active layer when nothing is selected', () => {
      seed([bin('a', 0), bin('b', 1)]);

      const { result } = renderHook(() => useMergeBins('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('b')]);
    });

    it("ignores the selection under 'layer' scope, so a stray selection cannot hijack it", () => {
      seed([bin('a', 0), bin('b', 1), bin('c', 2)], ['a']);

      const { result } = renderHook(() => useMergeBins('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([
        binId('a'),
        binId('b'),
        binId('c'),
      ]);
    });

    it('uses the selection when there is one', () => {
      seed([bin('a', 0), bin('b', 1), bin('c', 2)], ['a', 'c']);

      const { result } = renderHook(() => useMergeBins('selection'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('c')]);
    });

    it('drops bins on other layers, since height is measured per layer', () => {
      seed([bin('a', 0), bin('b', 1), bin('other', 2, 'layer2')]);

      const { result } = renderHook(() => useMergeBins('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('b')]);
    });

    it('drops staged bins, which have no place on the grid', () => {
      seed([bin('a', 0), bin('b', 1), bin('stashed', 2, STAGING_ID)]);

      const { result } = renderHook(() => useMergeBins('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('b')]);
    });

    it('cannot merge a single bin', () => {
      seed([bin('a', 0)]);

      const { result } = renderHook(() => useMergeBins('layer'));

      expect(result.current.canMerge).toBe(false);
    });
  });

  describe('commit', () => {
    it('saves the design and navigates to it in the designer', async () => {
      seed([bin('a', 0), bin('b', 1)]);
      const { result } = renderHook(() => useMergeBins('layer'));
      const plan = result.current.previewMerge();
      expect(plan.ok).toBe(true);
      if (!plan.ok) return;

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.commitMerge(plan.value);
      });

      expect(outcome).toBe(true);
      expect(saveDesign).toHaveBeenCalledWith(
        expect.objectContaining({ params: plan.value.params })
      );
      expect(window.location.pathname + window.location.search).toBe('/designer?id=design_merged');
    });

    it('reports a save failure instead of navigating to a design that does not exist', async () => {
      seed([bin('a', 0), bin('b', 1)]);
      saveDesign.mockResolvedValue(err({ kind: 'storage' }));
      const { result } = renderHook(() => useMergeBins('layer'));
      const plan = result.current.previewMerge();
      if (!plan.ok) throw new Error('expected a plan');

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.commitMerge(plan.value);
      });

      // The caller needs this to keep its dialog open.
      expect(outcome).toBe(false);
      expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
      expect(window.location.pathname).toBe('/');
    });
  });
});
