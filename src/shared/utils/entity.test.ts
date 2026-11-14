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

  it('returns a bin once for each time its ID is asked for', () => {
    const layout = createTestLayout();
    const bins = findBinsByIds(layout, [binId('bin2'), binId('bin1'), binId('bin2')]);
    expect(bins.map((b) => b.id)).toEqual(['bin2', 'bin1', 'bin2']);
  });

  it('returns the first bin when two bins share an ID', () => {
    const layout = createTestLayout();
    const first = layout.bins[0];
    layout.bins = [first, { ...first, label: 'second copy' }];
    expect(findBinsByIds(layout, [first.id])).toEqual([first]);
  });

  it('reads each bin a fixed number of times, however many IDs it looks up', () => {
    const template = createTestLayout().bins[0];
    const bins = Array.from({ length: 500 }, (_, i) => ({ ...template, id: binId(`b${i}`) }));
    let reads = 0;
    const counted = new Proxy(bins, {
      get(target, key, receiver) {
        if (typeof key === 'string' && /^\d+$/.test(key)) reads++;
        return Reflect.get(target, key, receiver) as unknown;
      },
    });
    const layout = { ...createTestLayout(), bins: counted };
    const ids = [...bins].reverse().map((b) => b.id);

    const found = findBinsByIds(layout, ids);

    expect(found.map((b) => b.id)).toEqual(ids);
    expect(reads).toBeLessThanOrEqual(bins.length * 2);
  });
});
