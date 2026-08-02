import { describe, it, expect } from 'vitest';
import { findBinById, findBinsByIds } from '@/shared/utils/entity';
import type { Layout } from '@/core/types';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';
import { createTestLayout as baseCreateTestLayout } from '@/test/testUtils';

const createTestLayout = (): Layout =>
  baseCreateTestLayout({
    name: 'Test',
    categories: [
      { id: categoryId('cat1'), name: 'Category 1', color: '#ff0000' },
      { id: categoryId('cat2'), name: 'Category 2', color: '#00ff00' },
    ],
    layers: [
      { id: layerId('layer1'), name: 'Layer 1', height: heightUnits(3) },
      { id: layerId('layer2'), name: 'Layer 2', height: heightUnits(3) },
    ],
    bins: [
      {
        id: binId('bin1'),
        layerId: layerId('layer1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: 'Bin 1',
        notes: '',
      },
      {
        id: binId('bin2'),
        layerId: layerId('layer1'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat2'),
        label: 'Bin 2',
        notes: '',
      },
      {
        id: binId('bin3'),
        layerId: layerId('layer2'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        category: categoryId('cat1'),
        label: 'Bin 3',
        notes: '',
      },
    ],
  });

describe('findBinById', () => {
  it('returns bin when found', () => {
    const layout = createTestLayout();
    const bin = findBinById(layout, binId('bin1'));
    expect(bin).toBeDefined();
    expect(bin?.label).toBe('Bin 1');
  });

  it('returns undefined when not found', () => {
    const layout = createTestLayout();
    const bin = findBinById(layout, binId('nonexistent'));
    expect(bin).toBeUndefined();
  });

  it('handles empty bins array', () => {
    const layout = createTestLayout();
    layout.bins = [];
    const bin = findBinById(layout, binId('bin1'));
    expect(bin).toBeUndefined();
  });
});

describe('findBinsByIds', () => {
  it('returns all bins when all IDs exist', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, [binId('bin1'), binId('bin2')]);
    expect(bins).toHaveLength(2);
    expect(bins.map((b) => b.id)).toEqual(['bin1', 'bin2']);
  });

  it('filters out nonexistent IDs', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, [binId('bin1'), binId('nonexistent'), binId('bin3')]);
    expect(bins).toHaveLength(2);
    expect(bins.map((b) => b.id)).toEqual(['bin1', 'bin3']);
  });

  it('returns empty array when no IDs match', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, [binId('nonexistent1'), binId('nonexistent2')]);
    expect(bins).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, []);
    expect(bins).toHaveLength(0);
  });

  it('preserves order of input IDs', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, [binId('bin3'), binId('bin1'), binId('bin2')]);
    expect(bins.map((b) => b.id)).toEqual(['bin3', 'bin1', 'bin2']);
  });
});
