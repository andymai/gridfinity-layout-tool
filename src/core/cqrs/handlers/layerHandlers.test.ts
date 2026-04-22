import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { createCommand } from '../commands';
import { layerId, categoryId, binId } from '@/core/types';
import type { Bin, Layer } from '@/core/types';
import { resetVersionCounters } from './index';

// --- Mocks ---

const testLayer: Layer = { id: layerId('layer_1'), name: 'Layer 1', height: 3 };
const layers: Layer[] = [testLayer];
const bins: Bin[] = [];

const mockStore = {
  layout: {
    bins,
    layers,
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    drawer: { width: 6, depth: 4, height: 7 },
    name: 'Test',
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    version: '1.0',
  },
  addLayer: vi.fn(() => ({ ok: true, value: layerId('layer_new') })),
  updateLayer: vi.fn(() => ({ ok: true, value: undefined })),
  deleteLayer: vi.fn(() => ({ ok: true, value: undefined })),
  reorderLayers: vi.fn(() => ({ ok: true, value: undefined })),
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: { getState: () => mockStore },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

const { handleAddLayer, handleUpdateLayer, handleDeleteLayer, handleReorderLayers } =
  await import('./layerHandlers');

describe('Layer Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
    layers.length = 0;
    layers.push({ ...testLayer });
    bins.length = 0;
  });

  describe('handleAddLayer', () => {
    it('produces layer.added event', () => {
      const newLayer: Layer = { id: layerId('layer_new'), name: 'Layer 2', height: 3 };
      layers.push(newLayer);

      const cmd = createCommand('layer.add', {});
      const result = handleAddLayer(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(layerId('layer_new'));
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('layer.added');
      }
    });

    it('returns error when store fails', () => {
      mockStore.addLayer.mockReturnValueOnce({
        ok: false,
        error: { code: 'LAYOUT_MAX_LAYERS' },
      });

      const result = handleAddLayer(createCommand('layer.add', {}));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('handleUpdateLayer', () => {
    it('captures previous values and produces layer.updated event', () => {
      const cmd = createCommand('layer.update', {
        id: layerId('layer_1'),
        updates: { name: 'Renamed', height: 5 },
      });

      const result = handleUpdateLayer(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layer.updated');
        if (event.type === 'layer.updated') {
          expect(event.payload.previous).toEqual({ name: 'Layer 1', height: 3 });
          expect(event.payload.changes).toEqual({ name: 'Renamed', height: 5 });
        }
      }
    });

    it('returns error when layer not found without touching the store', () => {
      const cmd = createCommand('layer.update', {
        id: layerId('nonexistent'),
        updates: { name: 'X' },
      });

      const result = handleUpdateLayer(cmd);

      expect(isErr(result)).toBe(true);
      expect(mockStore.updateLayer).not.toHaveBeenCalled();
    });
  });

  describe('handleDeleteLayer', () => {
    it('captures the deleted layer and displaced bin count', () => {
      bins.push({
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
      });

      const cmd = createCommand('layer.delete', { id: layerId('layer_1') });
      const result = handleDeleteLayer(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layer.deleted');
        if (event.type === 'layer.deleted') {
          expect(event.payload.layer.id).toBe(layerId('layer_1'));
          expect(event.payload.deletedBinCount).toBe(1);
        }
      }
    });
  });

  describe('handleReorderLayers', () => {
    it('produces layer.reordered event with indices', () => {
      const cmd = createCommand('layer.reorder', { fromIndex: 0, toIndex: 1 });
      const result = handleReorderLayers(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('layer.reordered');
        if (event.type === 'layer.reordered') {
          expect(event.payload).toEqual({ fromIndex: 0, toIndex: 1 });
        }
      }
    });
  });
});
