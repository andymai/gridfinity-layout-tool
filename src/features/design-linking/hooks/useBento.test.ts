import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBento } from './useBento';
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
const addBin = vi.fn();
const deleteBins = vi.fn();

// Partial: the domain module imports normalizeIdsWithRemap / validateBinParams
// from this same barrel, so replacing it wholesale breaks planMergedBin.
vi.mock('@/features/bin-designer', async (importOriginal) => {
  const actual = await importOriginal<typeof BinDesignerModule>();
  return { ...actual, saveDesign: (...args: unknown[]) => saveDesign(...args) };
});

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/shared/contexts', () => ({
  useMutations: () => ({ addBin, deleteBins }),
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

describe('useBento', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
    saveDesign.mockResolvedValue(ok({ id: 'design_bento' }));
    window.history.pushState(null, '', '/');
  });

  describe('scope', () => {
    it('uses the whole active layer under layer scope', () => {
      seed([bin('a', 0), bin('b', 1)]);

      const { result } = renderHook(() => useBento('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('b')]);
    });

    it("ignores the selection under 'layer' scope, so a stray selection cannot hijack it", () => {
      seed([bin('a', 0), bin('b', 1), bin('c', 2)], ['a']);

      const { result } = renderHook(() => useBento('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([
        binId('a'),
        binId('b'),
        binId('c'),
      ]);
    });

    it('uses the selection under selection scope', () => {
      seed([bin('a', 0), bin('b', 1), bin('c', 2)], ['a', 'c']);

      const { result } = renderHook(() => useBento('selection'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('c')]);
    });

    it('drops bins on other layers, since height is measured per layer', () => {
      seed([bin('a', 0), bin('b', 1), bin('other', 2, 'layer2')]);

      const { result } = renderHook(() => useBento('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('b')]);
    });

    it('drops staged bins, which have no place on the grid', () => {
      seed([bin('a', 0), bin('b', 1), bin('stashed', 2, STAGING_ID)]);

      const { result } = renderHook(() => useBento('layer'));

      expect(result.current.mergeableBins.map((b) => b.id)).toEqual([binId('a'), binId('b')]);
    });

    it('cannot make a bento from a single bin', () => {
      seed([bin('a', 0)]);

      const { result } = renderHook(() => useBento('layer'));

      expect(result.current.canMerge).toBe(false);
    });
  });

  describe('commit', () => {
    async function commit(overrides: { name?: string; replaceBins?: boolean } = {}) {
      const { result } = renderHook(() => useBento('layer'));
      const preview = result.current.previewBento();
      if (!preview.ok) throw new Error('expected a plan');

      let outcome: boolean | undefined;
      await act(async () => {
        outcome = await result.current.commitBento({
          plan: preview.value,
          name: overrides.name ?? 'My bento',
          replaceBins: overrides.replaceBins ?? false,
        });
      });
      return { outcome, plan: preview.value };
    }

    it('saves the design and navigates to it in the designer', async () => {
      seed([bin('a', 0), bin('b', 1)]);

      const { outcome, plan } = await commit();

      expect(outcome).toBe(true);
      expect(saveDesign).toHaveBeenCalledWith(
        expect.objectContaining({ params: plan.params, name: 'My bento' })
      );
      expect(window.location.pathname + window.location.search).toBe('/designer?id=design_bento');
    });

    it('falls back to the default name when the field was cleared', async () => {
      seed([bin('a', 0), bin('b', 1)]);

      await commit({ name: '   ' });

      expect(saveDesign).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'designLinking.bento.designName' })
      );
    });

    it('reports a save failure instead of navigating to a design that does not exist', async () => {
      seed([bin('a', 0), bin('b', 1)]);
      saveDesign.mockResolvedValue(err({ kind: 'storage' }));

      const { outcome } = await commit();

      // The caller needs this to keep its dialog open.
      expect(outcome).toBe(false);
      expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
      expect(window.location.pathname).toBe('/');
    });

    it('leaves the layout untouched unless asked to replace', async () => {
      seed([bin('a', 0), bin('b', 1)]);

      await commit({ replaceBins: false });

      expect(deleteBins).not.toHaveBeenCalled();
      expect(addBin).not.toHaveBeenCalled();
    });

    it('swaps the source bins for one linked bin over the footprint', async () => {
      seed([bin('a', 0), bin('b', 1)]);

      await commit({ name: 'Screwdrivers', replaceBins: true });

      expect(deleteBins).toHaveBeenCalledWith([binId('a'), binId('b')]);
      expect(addBin).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 0,
          y: 0,
          width: 2,
          depth: 1,
          label: 'Screwdrivers',
          linkedDesignId: 'design_bento',
          layerId: layerId('layer1'),
        })
      );
    });

    it('anchors the replacement at the selection origin, not the drawer origin', async () => {
      seed([bin('a', 3), bin('b', 4)]);

      await commit({ replaceBins: true });

      expect(addBin).toHaveBeenCalledWith(expect.objectContaining({ x: 3, width: 2 }));
    });

    it('does not replace when the save failed, so the bins are never stranded', async () => {
      seed([bin('a', 0), bin('b', 1)]);
      saveDesign.mockResolvedValue(err({ kind: 'storage' }));

      await commit({ replaceBins: true });

      expect(deleteBins).not.toHaveBeenCalled();
      expect(addBin).not.toHaveBeenCalled();
    });
  });
});
