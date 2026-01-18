import { describe, it, expect } from 'vitest';
import {
  findBinById,
  findLayerById,
  findCategoryById,
  findLayerIndex,
  getBinsByLayerId,
  getBinsByCategoryId,
} from '@/utils/entity';
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

describe('findLayerById', () => {
  it('returns layer when found', () => {
    const layout = createTestLayout();
    const layer = findLayerById(layout, 'layer1');
    expect(layer).toBeDefined();
    expect(layer?.name).toBe('Layer 1');
  });

  it('returns undefined when not found', () => {
    const layout = createTestLayout();
    const layer = findLayerById(layout, 'nonexistent');
    expect(layer).toBeUndefined();
  });
});

describe('findCategoryById', () => {
  it('returns category when found', () => {
    const layout = createTestLayout();
    const category = findCategoryById(layout, 'cat1');
    expect(category).toBeDefined();
    expect(category?.name).toBe('Category 1');
  });

  it('returns undefined when not found', () => {
    const layout = createTestLayout();
    const category = findCategoryById(layout, 'nonexistent');
    expect(category).toBeUndefined();
  });
});

describe('findLayerIndex', () => {
  it('returns correct index for first layer', () => {
    const layout = createTestLayout();
    expect(findLayerIndex(layout, 'layer1')).toBe(0);
  });

  it('returns correct index for second layer', () => {
    const layout = createTestLayout();
    expect(findLayerIndex(layout, 'layer2')).toBe(1);
  });

  it('returns -1 when not found', () => {
    const layout = createTestLayout();
    expect(findLayerIndex(layout, 'nonexistent')).toBe(-1);
  });
});

describe('getBinsByLayerId', () => {
  it('returns all bins on layer', () => {
    const layout = createTestLayout();
    const bins = getBinsByLayerId(layout, 'layer1');
    expect(bins).toHaveLength(2);
    expect(bins.map(b => b.id)).toEqual(['bin1', 'bin2']);
  });

  it('returns single bin when only one exists', () => {
    const layout = createTestLayout();
    const bins = getBinsByLayerId(layout, 'layer2');
    expect(bins).toHaveLength(1);
    expect(bins[0].id).toBe('bin3');
  });

  it('returns empty array for layer with no bins', () => {
    const layout = createTestLayout();
    layout.layers.push({ id: 'layer3', name: 'Layer 3', height: 3 });
    const bins = getBinsByLayerId(layout, 'layer3');
    expect(bins).toHaveLength(0);
  });

  it('returns empty array for nonexistent layer', () => {
    const layout = createTestLayout();
    const bins = getBinsByLayerId(layout, 'nonexistent');
    expect(bins).toHaveLength(0);
  });
});

describe('getBinsByCategoryId', () => {
  it('returns all bins with category', () => {
    const layout = createTestLayout();
    const bins = getBinsByCategoryId(layout, 'cat1');
    expect(bins).toHaveLength(2);
    expect(bins.map(b => b.id)).toEqual(['bin1', 'bin3']);
  });

  it('returns single bin when only one has category', () => {
    const layout = createTestLayout();
    const bins = getBinsByCategoryId(layout, 'cat2');
    expect(bins).toHaveLength(1);
    expect(bins[0].id).toBe('bin2');
  });

  it('returns empty array for unused category', () => {
    const layout = createTestLayout();
    layout.categories.push({ id: 'cat3', name: 'Category 3', color: '#0000ff' });
    const bins = getBinsByCategoryId(layout, 'cat3');
    expect(bins).toHaveLength(0);
  });

  it('returns empty array for nonexistent category', () => {
    const layout = createTestLayout();
    const bins = getBinsByCategoryId(layout, 'nonexistent');
    expect(bins).toHaveLength(0);
  });
});
