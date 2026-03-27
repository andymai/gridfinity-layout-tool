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
  });
});
