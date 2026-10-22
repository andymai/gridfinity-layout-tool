import { describe, it, expect } from 'vitest';
import { STAGING_ID } from '@/core/constants';
import { binId, categoryId, designId } from '@/core/types';
import type { Category } from '@/core/types';
import { createTestBin } from '@/test/testUtils';
import type { CustomBinRef } from '../../store/customBinRegistry';
import { layoutDesigns } from './layoutDesigns';

function design(id: string, name: string): CustomBinRef {
  return { id: designId(id), name, width: 2, depth: 3, height: 6, updatedAt: '2026-10-01' };
}

const categories: Category[] = [
  { id: categoryId('red'), name: 'Red', color: '#ff0000' },
  { id: categoryId('blue'), name: 'Blue', color: '#0000ff' },
];

describe('layoutDesigns', () => {
  it('lists each linked design once, sorted by name with numbers in order', () => {
    const registry = [design('a', 'Bin 10'), design('b', 'Bin 2'), design('c', 'Unused')];
    const bins = [
      createTestBin({ id: binId('b1'), linkedDesignId: designId('a') }),
      createTestBin({ id: binId('b2'), linkedDesignId: designId('b') }),
      createTestBin({ id: binId('b3'), linkedDesignId: designId('a') }),
      createTestBin({ id: binId('b4') }),
    ];

    const entries = layoutDesigns(bins, categories, registry);

    expect(entries.map((e) => [e.design.name, e.binId])).toEqual([
      ['Bin 2', 'b2'],
      ['Bin 10', 'b1'],
    ]);
  });

  it('opens a design from a grid placement before a stashed one', () => {
    const bins = [
      createTestBin({ id: binId('stashed'), layerId: STAGING_ID, linkedDesignId: designId('a') }),
      createTestBin({ id: binId('placed'), linkedDesignId: designId('a') }),
    ];

    expect(layoutDesigns(bins, categories, [design('a', 'A')])[0]?.binId).toBe('placed');
  });

  it('still lists a design whose only placement is stashed', () => {
    const bins = [
      createTestBin({ id: binId('stashed'), layerId: STAGING_ID, linkedDesignId: designId('a') }),
    ];

    expect(layoutDesigns(bins, categories, [design('a', 'A')])[0]?.binId).toBe('stashed');
  });

  it("takes the colour from the opening placement's category", () => {
    const bins = [
      createTestBin({
        id: binId('stashed'),
        layerId: STAGING_ID,
        category: categoryId('red'),
        linkedDesignId: designId('a'),
      }),
      createTestBin({
        id: binId('placed'),
        category: categoryId('blue'),
        linkedDesignId: designId('a'),
      }),
    ];

    expect(layoutDesigns(bins, categories, [design('a', 'A')])[0]?.color).toBe('#0000ff');
  });

  it('drops a link to a design that is no longer saved', () => {
    const bins = [createTestBin({ linkedDesignId: designId('gone') })];

    expect(layoutDesigns(bins, categories, [design('a', 'A')])).toEqual([]);
  });
});
