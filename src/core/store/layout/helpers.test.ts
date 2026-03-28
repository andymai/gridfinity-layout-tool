import { describe, it, expect } from 'vitest';
import type { Bin, Layer, Category } from '@/core/types';
import { binId, layerId, categoryId } from '@/core/types';
import { isOk, isErr } from '@/core/result';
import { findBin, requireBin, requireLayer, requireCategory, toPlacementError } from './helpers';

const makeBin = (id: string): Bin => ({
  id: binId(id),
  layerId: layerId('layer1'),
  x: 0,
  y: 0,
  width: 1,
  depth: 1,
  height: 3,
  category: categoryId('cat1'),
  label: '',
  notes: '',
});

const makeLayer = (id: string): Layer => ({
  id: layerId(id),
  name: `Layer ${id}`,
  height: 3,
});

const makeCategory = (id: string): Category => ({
  id: categoryId(id),
  name: `Category ${id}`,
  color: '#ff0000',
});

describe('helpers', () => {
  describe('findBin', () => {
    it('returns the bin when found', () => {
      const bins = [makeBin('a'), makeBin('b')];
      expect(findBin(bins, binId('b'))).toBe(bins[1]);
    });

    it('returns undefined when not found', () => {
      expect(findBin([makeBin('a')], binId('missing'))).toBeUndefined();
    });

    it('returns undefined for empty array', () => {
      expect(findBin([], binId('any'))).toBeUndefined();
    });
  });

  describe('requireBin', () => {
    it('returns Ok with the bin when found', () => {
      const bins = [makeBin('a')];
      const result = requireBin(bins, binId('a'), 'test');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(bins[0]);
    });

    it('returns Err when bin not found', () => {
      const result = requireBin([], binId('missing'), 'deleteBin');
      expect(isErr(result)).toBe(true);
    });

    it('includes operation and bin id in error fields', () => {
      const result = requireBin([], binId('xyz'), 'updateBin');
      expect(isErr(result)).toBe(true);
      if (isErr(result)) {
        expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
        const error = result.error as unknown as { operation: string; reason: string };
        expect(error.operation).toBe('updateBin');
        expect(error.reason).toContain('xyz');
      }
    });
  });

  describe('requireLayer', () => {
    it('returns Ok with the layer when found', () => {
      const layers = [makeLayer('l1')];
      const result = requireLayer(layers, layerId('l1'), 'test');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(layers[0]);
    });

    it('returns Err when layer not found', () => {
      const result = requireLayer([], layerId('missing'), 'deleteLayer');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('requireCategory', () => {
    it('returns Ok with the category when found', () => {
      const cats = [makeCategory('c1')];
      const result = requireCategory(cats, categoryId('c1'), 'test');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) expect(result.value).toBe(cats[0]);
    });

    it('returns Err when category not found', () => {
      const result = requireCategory([], categoryId('missing'), 'deleteCategory');
      expect(isErr(result)).toBe(true);
    });
  });

  describe('toPlacementError', () => {
    const rect = { x: 1, y: 2, width: 3, depth: 4 };

    it('returns collision error for collision reason', () => {
      const error = toPlacementError('collision', rect);
      expect(error.code).toBe('VALIDATION_COLLISION');
    });

    it('returns out of bounds error for non-collision reasons', () => {
      const error = toPlacementError('out_of_bounds', rect);
      expect(error.code).toBe('VALIDATION_OUT_OF_BOUNDS');
    });
  });
});
