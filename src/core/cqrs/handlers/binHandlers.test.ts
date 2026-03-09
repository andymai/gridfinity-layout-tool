import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { createCommand } from '../commands';
import { binId, layerId, categoryId } from '@/core/types';
import type { Bin } from '@/core/types';
import { resetVersionCounters } from './index';

// --- Mocks ---

const testBin: Bin = {
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
};

const bins: Bin[] = [testBin];

const mockStore = {
  layout: {
    bins,
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }],
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    drawer: { width: 6, depth: 4, height: 7 },
    name: 'Test',
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    version: '1.0',
  },
  addBin: vi.fn(() => ({ ok: true, value: binId('bin_new') })),
  updateBin: vi.fn(() => ({ ok: true, value: undefined })),
  deleteBin: vi.fn(() => ({ ok: true, value: undefined })),
  deleteBins: vi.fn(() => ({ ok: true, value: undefined })),
  duplicateBin: vi.fn(() => ({ ok: true, value: binId('bin_dup') })),
  moveBinToStaging: vi.fn(() => ({ ok: true, value: undefined })),
  moveBinFromStaging: vi.fn(() => ({ ok: true, value: undefined })),
  fillLayer: vi.fn(() => 2),
  clearLayer: vi.fn(() => 1),
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: { getState: () => mockStore },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

// Lazy-import handlers after mocks
const {
  handleAddBin,
  handleUpdateBin,
  handleDeleteBin,
  handleDeleteBins,
  handleDuplicateBin,
  handleMoveBinToStaging,
  handleMoveBinFromStaging,
  handleFillLayer,
  handleClearLayer,
} = await import('./binHandlers');

describe('Bin Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
    // Reset bins array
    bins.length = 0;
    bins.push({ ...testBin });
  });

  describe('handleAddBin', () => {
    it('calls store.addBin and produces bin.added event', () => {
      // After addBin, the store should contain the new bin
      const newBin: Bin = { ...testBin, id: binId('bin_new'), x: 2, y: 3 };
      bins.push(newBin);

      const cmd = createCommand('bin.add', {
        layerId: layerId('layer_1'),
        x: 2,
        y: 3,
        width: 1,
        depth: 1,
        height: 3,
        category: categoryId('cat_1'),
        label: '',
        notes: '',
      });

      const result = handleAddBin(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(binId('bin_new'));
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('bin.added');
      }
    });

    it('returns error when store fails', () => {
      mockStore.addBin.mockReturnValueOnce({
        ok: false,
        error: { code: 'LAYOUT_INVALID_OPERATION' },
      });
      const cmd = createCommand('bin.add', {
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

      const result = handleAddBin(cmd);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('handleUpdateBin', () => {
    it('captures previous values and produces bin.updated event', () => {
      const cmd = createCommand('bin.update', {
        id: binId('bin_1'),
        updates: { x: 5, width: 2 },
      });

      const result = handleUpdateBin(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        const event = result.value.events[0];
        expect(event.type).toBe('bin.updated');
        if (event.type === 'bin.updated') {
          expect(event.payload.changes).toEqual({ x: 5, width: 2 });
          expect(event.payload.previous).toEqual({ x: 0, width: 1 });
        }
      }
    });

    it('returns error when bin not found', () => {
      mockStore.updateBin.mockReturnValueOnce({
        ok: false,
        error: { code: 'LAYOUT_INVALID_OPERATION' },
      });
      const cmd = createCommand('bin.update', {
        id: binId('nonexistent'),
        updates: { x: 1 },
      });

      const result = handleUpdateBin(cmd);
      expect(isErr(result)).toBe(true);
    });
  });

  describe('handleDeleteBin', () => {
    it('captures bin before deletion and produces bin.deleted event', () => {
      const cmd = createCommand('bin.delete', { id: binId('bin_1') });
      const result = handleDeleteBin(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        const event = result.value.events[0];
        expect(event.type).toBe('bin.deleted');
        if (event.type === 'bin.deleted') {
          expect(event.payload.bin.id).toBe(binId('bin_1'));
        }
      }
    });

    it('returns empty events when bin not found', () => {
      bins.length = 0;
      const cmd = createCommand('bin.delete', { id: binId('nonexistent') });
      const result = handleDeleteBin(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(0);
      }
    });
  });

  describe('handleDeleteBins', () => {
    it('captures all bins before batch deletion', () => {
      const bin2: Bin = { ...testBin, id: binId('bin_2'), x: 1 };
      bins.push(bin2);

      const cmd = createCommand('bin.deleteBatch', {
        ids: [binId('bin_1'), binId('bin_2')],
      });

      const result = handleDeleteBins(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        const event = result.value.events[0];
        expect(event.type).toBe('bin.batchDeleted');
        if (event.type === 'bin.batchDeleted') {
          expect(event.payload.bins).toHaveLength(2);
        }
      }
    });
  });

  describe('handleDuplicateBin', () => {
    it('produces bin.duplicated event with source and new bin', () => {
      const dupBin: Bin = { ...testBin, id: binId('bin_dup'), x: 1 };
      bins.push(dupBin);

      const cmd = createCommand('bin.duplicate', { id: binId('bin_1') });
      const result = handleDuplicateBin(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(binId('bin_dup'));
        expect(result.value.events).toHaveLength(1);
        const event = result.value.events[0];
        expect(event.type).toBe('bin.duplicated');
        if (event.type === 'bin.duplicated') {
          expect(event.payload.sourceId).toBe(binId('bin_1'));
        }
      }
    });
  });

  describe('handleMoveBinToStaging', () => {
    it('captures previous layerId and produces bin.movedToStaging event', () => {
      const cmd = createCommand('bin.moveToStaging', { id: binId('bin_1') });
      const result = handleMoveBinToStaging(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(1);
        const event = result.value.events[0];
        expect(event.type).toBe('bin.movedToStaging');
        if (event.type === 'bin.movedToStaging') {
          expect(event.payload.previousLayerId).toBe(layerId('layer_1'));
        }
      }
    });
  });

  describe('handleMoveBinFromStaging', () => {
    it('produces bin.movedFromStaging event with target position', () => {
      const cmd = createCommand('bin.moveFromStaging', {
        id: binId('bin_1'),
        layerId: layerId('layer_1'),
        x: 3,
        y: 4,
      });

      const result = handleMoveBinFromStaging(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('bin.movedFromStaging');
        if (event.type === 'bin.movedFromStaging') {
          expect(event.payload).toMatchObject({ x: 3, y: 4, layerId: layerId('layer_1') });
        }
      }
    });
  });

  describe('handleFillLayer', () => {
    it('captures newly created bins and produces bin.layerFilled event', () => {
      // Simulate fillLayer creating 2 bins
      const newBin1: Bin = { ...testBin, id: binId('fill_1'), x: 0, y: 0 };
      const newBin2: Bin = { ...testBin, id: binId('fill_2'), x: 1, y: 0 };
      mockStore.fillLayer.mockImplementationOnce(() => {
        bins.push(newBin1, newBin2);
        return 2;
      });

      const cmd = createCommand('bin.fillLayer', {
        layerId: layerId('layer_1'),
        width: 1,
        depth: 1,
        categoryId: categoryId('cat_1'),
      });

      const result = handleFillLayer(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(2);
        expect(result.value.events).toHaveLength(1);
        const event = result.value.events[0];
        expect(event.type).toBe('bin.layerFilled');
        if (event.type === 'bin.layerFilled') {
          expect(event.payload.binsCreated).toBe(2);
          expect(event.payload.bins).toHaveLength(2);
        }
      }
    });

    it('produces no events when no bins created', () => {
      mockStore.fillLayer.mockReturnValueOnce(0);
      const cmd = createCommand('bin.fillLayer', {
        layerId: layerId('layer_1'),
        width: 1,
        depth: 1,
        categoryId: categoryId('cat_1'),
      });

      const result = handleFillLayer(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(0);
      }
    });
  });

  describe('handleClearLayer', () => {
    it('captures bins before clearing and produces bin.layerCleared event', () => {
      mockStore.clearLayer.mockReturnValueOnce(1);
      const cmd = createCommand('bin.clearLayer', { layerId: layerId('layer_1') });
      const result = handleClearLayer(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(1);
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('bin.layerCleared');
      }
    });

    it('produces no events when layer was empty', () => {
      bins.length = 0;
      mockStore.clearLayer.mockReturnValueOnce(0);
      const cmd = createCommand('bin.clearLayer', { layerId: layerId('layer_1') });
      const result = handleClearLayer(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.events).toHaveLength(0);
      }
    });
  });

  describe('Event metadata', () => {
    it('includes correlationId from the command', () => {
      const cmd = createCommand('bin.delete', { id: binId('bin_1') });
      const result = handleDeleteBin(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result) && result.value.events.length > 0) {
        expect(result.value.events[0].meta.correlationId).toBe(cmd.meta.correlationId);
      }
    });

    it('assigns monotonically increasing versions', () => {
      const cmd1 = createCommand('bin.delete', { id: binId('bin_1') });
      const result1 = handleDeleteBin(cmd1);

      // Re-add bin for second command
      bins.push({ ...testBin });
      const cmd2 = createCommand('bin.delete', { id: binId('bin_1') });
      const result2 = handleDeleteBin(cmd2);

      if (isOk(result1) && isOk(result2)) {
        const v1 = result1.value.events[0]?.meta.version ?? 0;
        const v2 = result2.value.events[0]?.meta.version ?? 0;
        expect(v2).toBeGreaterThan(v1);
      }
    });
  });
});
