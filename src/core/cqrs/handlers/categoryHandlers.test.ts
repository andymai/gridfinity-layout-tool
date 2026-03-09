import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isOk, isErr } from '@/core/result';
import { createCommand } from '../commands';
import { categoryId, binId, layerId } from '@/core/types';
import type { Bin, Category } from '@/core/types';
import { resetVersionCounters } from './index';

// --- Mocks ---

const testCategory: Category = { id: categoryId('cat_1'), name: 'General', color: '#3b82f6' };
const categories: Category[] = [testCategory];
const bins: Bin[] = [];

const mockStore = {
  layout: {
    bins,
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: 3 }],
    categories,
    drawer: { width: 6, depth: 4, height: 7 },
    name: 'Test',
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    version: '1.0',
  },
  addCategory: vi.fn(() => ({ ok: true, value: categoryId('cat_new') })),
  updateCategory: vi.fn(() => ({ ok: true, value: undefined })),
  deleteCategory: vi.fn(() => ({ ok: true, value: undefined })),
};

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: { getState: () => mockStore },
}));

vi.mock('@/core/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ library: { activeLayoutId: 'layout_1' } }),
  },
}));

const { handleAddCategory, handleUpdateCategory, handleDeleteCategory } =
  await import('./categoryHandlers');

describe('Category Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetVersionCounters();
    categories.length = 0;
    categories.push({ ...testCategory });
    bins.length = 0;
  });

  describe('handleAddCategory', () => {
    it('produces category.added event', () => {
      const newCat: Category = { id: categoryId('cat_new'), name: 'Tools', color: '#ff0000' };
      categories.push(newCat);

      const cmd = createCommand('category.add', { name: 'Tools', color: '#ff0000' });
      const result = handleAddCategory(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.value).toBe(categoryId('cat_new'));
        expect(result.value.events).toHaveLength(1);
        expect(result.value.events[0].type).toBe('category.added');
      }
    });

    it('returns error when store fails', () => {
      mockStore.addCategory.mockReturnValueOnce({
        ok: false,
        error: { code: 'LAYOUT_MAX_CATEGORIES' },
      });

      const result = handleAddCategory(createCommand('category.add', { name: 'X', color: '#000' }));
      expect(isErr(result)).toBe(true);
    });
  });

  describe('handleUpdateCategory', () => {
    it('captures previous values and produces category.updated event', () => {
      const cmd = createCommand('category.update', {
        id: categoryId('cat_1'),
        updates: { name: 'Renamed', color: '#00ff00' },
      });

      const result = handleUpdateCategory(cmd);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('category.updated');
        if (event.type === 'category.updated') {
          expect(event.payload.previous).toEqual({ name: 'General', color: '#3b82f6' });
          expect(event.payload.changes).toEqual({ name: 'Renamed', color: '#00ff00' });
        }
      }
    });
  });

  describe('handleDeleteCategory', () => {
    it('captures category and reassigned bin count', () => {
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

      const cmd = createCommand('category.delete', { id: categoryId('cat_1') });
      const result = handleDeleteCategory(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        expect(event.type).toBe('category.deleted');
        if (event.type === 'category.deleted') {
          expect(event.payload.category.id).toBe(categoryId('cat_1'));
          expect(event.payload.reassignedBinCount).toBe(1);
        }
      }
    });

    it('reports zero reassigned bins when none exist', () => {
      const cmd = createCommand('category.delete', { id: categoryId('cat_1') });
      const result = handleDeleteCategory(cmd);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const event = result.value.events[0];
        if (event.type === 'category.deleted') {
          expect(event.payload.reassignedBinCount).toBe(0);
        }
      }
    });
  });
});
