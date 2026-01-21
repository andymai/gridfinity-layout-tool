import { describe, it, expect } from 'vitest';
import { findBinById, findBinsByIds } from '@/utils/entity';
import type { Layout } from '@/core/types';

const createTestLayout = (): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [
    { id: 'cat1', name: 'Category 1', color: '#ff0000' },
    { id: 'cat2', name: 'Category 2', color: '#00ff00' },
  ],
  layers: [
    { id: 'layer1', name: 'Layer 1', height: 3 },
    { id: 'layer2', name: 'Layer 2', height: 3 },
  ],
  bins: [
    { id: 'bin1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: 'Bin 1', notes: '' },
    { id: 'bin2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'cat2', label: 'Bin 2', notes: '' },
    { id: 'bin3', layerId: 'layer2', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: 'Bin 3', notes: '' },
  ],
});

describe('findBinById', () => {
  it('returns bin when found', () => {
    const layout = createTestLayout();
    const bin = findBinById(layout, 'bin1');
    expect(bin).toBeDefined();
    expect(bin?.label).toBe('Bin 1');
  });

  it('returns undefined when not found', () => {
    const layout = createTestLayout();
    const bin = findBinById(layout, 'nonexistent');
    expect(bin).toBeUndefined();
  });

  it('handles empty bins array', () => {
    const layout = createTestLayout();
    layout.bins = [];
    const bin = findBinById(layout, 'bin1');
    expect(bin).toBeUndefined();
  });
});

describe('findBinsByIds', () => {
  it('returns all bins when all IDs exist', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, ['bin1', 'bin2']);
    expect(bins).toHaveLength(2);
    expect(bins.map(b => b.id)).toEqual(['bin1', 'bin2']);
  });

  it('filters out nonexistent IDs', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, ['bin1', 'nonexistent', 'bin3']);
    expect(bins).toHaveLength(2);
    expect(bins.map(b => b.id)).toEqual(['bin1', 'bin3']);
  });

  it('returns empty array when no IDs match', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, ['nonexistent1', 'nonexistent2']);
    expect(bins).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, []);
    expect(bins).toHaveLength(0);
  });

  it('preserves order of input IDs', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, ['bin3', 'bin1', 'bin2']);
    expect(bins.map(b => b.id)).toEqual(['bin3', 'bin1', 'bin2']);
  });
});
