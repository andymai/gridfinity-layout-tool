import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk } from '@/core/result';
import { createCommand } from '../commands';
import { resetVersionCounters } from './index';
import type { Layout } from '@/core/types';
import { binId, layerId, categoryId } from '@/core/types';

const mockRestoreLayout = vi.fn();
const mockRestoreSelection = vi.fn();

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: { getState: () => ({ restoreLayout: mockRestoreLayout }) },
}));

vi.mock('@/core/store/selection', () => ({
  useSelectionStore: {
    getState: () => ({
      selectedBinIds: [binId('bin_1')],
      focusedBinId: null,
      quickLabelBinId: null,
      activeLayerId: layerId('layer_1'),
      activeCategoryId: categoryId('cat_1'),
      restoreSelection: mockRestoreSelection,
    }),
  },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

const { handleRestoreLayout } = await import('./restoreHandlers');

const testLayout: Layout = {
  bins: [
    {
      id: binId('bin_1'),
      layerId: layerId('layer_1'),
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      category: categoryId('cat_1'),
      label: '',
      notes: '',
    },
  ],
  layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }],
  categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
  drawer: { width: 6, depth: 4, height: 7 },
  name: 'Test',
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  version: '1.0',
};

describe('Restore Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
  });

  describe('handleRestoreLayout', () => {
    it('calls restoreLayout on store and produces layout.restored event', () => {
      const cmd = createCommand('layout.restore', {
        layout: testLayout,
        direction: 'undo' as const,
      });
      const result = handleRestoreLayout(cmd);

      expect(mockRestoreLayout).toHaveBeenCalledWith(testLayout);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('layout.restored');
        expect(result.value.events[0].payload).toEqual({ direction: 'undo' });
      }
    });

    it('prunes stale selections when bins are removed', () => {
      const layoutWithoutBins: Layout = { ...testLayout, bins: [] };
      const cmd = createCommand('layout.restore', {
        layout: layoutWithoutBins,
        direction: 'undo' as const,
      });
      handleRestoreLayout(cmd);

      expect(mockRestoreSelection).toHaveBeenCalledWith(
        expect.objectContaining({ selectedBinIds: [] })
      );
    });

    it('applies only the snapshot fields that differ from current selection', () => {
      // Mock current selection: selectedBinIds=[bin_1], focusedBinId=null,
      // quickLabelBinId=null, activeLayerId=layer_1, activeCategoryId=cat_1.
      // Snapshot wants focusedBinId=bin_1; everything else matches current.
      // Sparse output: only the focusedBinId field should be restored.
      const cmd = createCommand('layout.restore', {
        layout: testLayout,
        direction: 'undo' as const,
        selection: {
          activeLayerId: layerId('layer_1'),
          activeCategoryId: categoryId('cat_1'),
          selectedBinIds: [binId('bin_1')],
          focusedBinId: binId('bin_1'),
          quickLabelBinId: null,
        },
      });
      handleRestoreLayout(cmd);

      expect(mockRestoreSelection).toHaveBeenCalledTimes(1);
      expect(mockRestoreSelection).toHaveBeenCalledWith({ focusedBinId: binId('bin_1') });
    });

    it('reconciles snapshot ids that no longer exist in the restored layout', () => {
      // Snapshot references missing IDs. Reconciliation drops the missing
      // bin, falls back to last layer + first category. After reconciliation
      // the resolved values happen to match current selection — sparse
      // output produces an empty diff, so restoreSelection is NOT called.
      const cmd = createCommand('layout.restore', {
        layout: { ...testLayout, bins: [] },
        direction: 'undo' as const,
        selection: {
          activeLayerId: layerId('layer_gone'),
          activeCategoryId: categoryId('cat_gone'),
          selectedBinIds: [binId('bin_1'), binId('bin_gone')],
          focusedBinId: binId('bin_gone'),
          quickLabelBinId: null,
        },
      });
      handleRestoreLayout(cmd);

      // Note: the FALLBACK active-layer (last layer = 'layer_1') matches
      // current; the FALLBACK active-category ('cat_1') matches current;
      // selectedBinIds reconciles to [] (current is [bin_1] — that IS a
      // diff). Only selectedBinIds should be in the call payload.
      expect(mockRestoreSelection).toHaveBeenCalledTimes(1);
      expect(mockRestoreSelection).toHaveBeenCalledWith({ selectedBinIds: [] });
    });

    it('does not call restoreSelection when nothing changes', () => {
      // Snapshot exactly matches the current selection mock — sparse output
      // is {} and restoreSelection should be skipped entirely.
      const cmd = createCommand('layout.restore', {
        layout: testLayout,
        direction: 'undo' as const,
        selection: {
          activeLayerId: layerId('layer_1'),
          activeCategoryId: categoryId('cat_1'),
          selectedBinIds: [binId('bin_1')],
          focusedBinId: null,
          quickLabelBinId: null,
        },
      });
      handleRestoreLayout(cmd);

      expect(mockRestoreSelection).not.toHaveBeenCalled();
    });
  });
});
