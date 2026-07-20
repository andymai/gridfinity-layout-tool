import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBinsToRender } from './useBinsToRender';
import type { Bin, Layer, Category } from '@/core/types';

function createTestBin(overrides: Partial<Bin> = {}): Bin {
  return {
    id: 'bin-1',
    x: 0,
    y: 0,
    width: 1,
    depth: 1,
    height: 3,
    layerId: 'layer-1',
    category: 'cat-1',
    clearanceHeight: 0,
    ...overrides,
  } as Bin;
}

const defaultLayers: Layer[] = [
  { id: 'layer-1', name: 'Layer 1', height: 3 },
  { id: 'layer-2', name: 'Layer 2', height: 3 },
];

const defaultCategories: Category[] = [
  { id: 'cat-1', name: 'Category 1', color: '#ff0000' },
] as Category[];

describe('useBinsToRender', () => {
  it('returns empty array when no bins', () => {
    const { result } = renderHook(() =>
      useBinsToRender({
        bins: [],
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
      })
    );

    expect(result.current).toEqual([]);
  });

  it('attaches divider specs for bins linked to designs', () => {
    const bins = [
      createTestBin({ id: 'bin-1', linkedDesignId: 'design-1' } as Partial<Bin>),
      createTestBin({ id: 'bin-2' }),
    ];
    const spec = {
      sig: 'design-1:2026',
      segments: [{ x: 0.5, y: 0, length: 1, orientation: 'vertical' as const }],
      thickness: 0.03,
      height: null,
    };
    const designDividers = new Map([
      [bins[0].linkedDesignId as NonNullable<Bin['linkedDesignId']>, spec],
    ]);

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
        designDividers,
      })
    );

    const linked = result.current.find((b) => b.bin.id === 'bin-1');
    const unlinked = result.current.find((b) => b.bin.id === 'bin-2');
    expect(linked?.dividers).toBe(spec);
    expect(unlinked?.dividers).toBeUndefined();
  });

  it('filters out staging bins', () => {
    const bins = [createTestBin({ layerId: '__staging__' })];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
      })
    );

    expect(result.current).toEqual([]);
  });

  it('includes bins on active layer in focus mode', () => {
    const bins = [
      createTestBin({ id: 'bin-1', layerId: 'layer-1' }),
      createTestBin({ id: 'bin-2', layerId: 'layer-2' }),
    ];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'focus',
        heightToGridScale: 7 / 42,
      })
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].bin.id).toBe('bin-1');
  });

  it('includes bins on active layer and below in stack mode', () => {
    const bins = [
      createTestBin({ id: 'bin-1', layerId: 'layer-1' }),
      createTestBin({ id: 'bin-2', layerId: 'layer-2' }),
    ];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 1,
        layerViewMode: 'stack',
        heightToGridScale: 7 / 42,
      })
    );

    expect(result.current).toHaveLength(2);
  });

  it('includes all bins in all mode', () => {
    const bins = [
      createTestBin({ id: 'bin-1', layerId: 'layer-1' }),
      createTestBin({ id: 'bin-2', layerId: 'layer-2' }),
    ];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
      })
    );

    expect(result.current).toHaveLength(2);
  });

  it('applies category color to bins', () => {
    const bins = [createTestBin({ category: 'cat-1' })];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
      })
    );

    expect(result.current[0].color).toBe('#ff0000');
  });

  it('sorts bins by z then depth ordering', () => {
    const layers: Layer[] = [{ id: 'layer-1', name: 'Layer 1', height: 3 }];
    const bins = [
      createTestBin({ id: 'far', x: 0, y: 5, layerId: 'layer-1' }),
      createTestBin({ id: 'close', x: 5, y: 0, layerId: 'layer-1' }),
    ];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
      })
    );

    // Far bins (low x-y) should come first
    expect(result.current[0].bin.id).toBe('far');
    expect(result.current[1].bin.id).toBe('close');
  });

  it('adds z-fighting prevention offsets', () => {
    const bins = [
      createTestBin({ id: 'bin-1', x: 0, y: 0, layerId: 'layer-1' }),
      createTestBin({ id: 'bin-2', x: 1, y: 0, layerId: 'layer-1' }),
    ];

    const { result } = renderHook(() =>
      useBinsToRender({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        activeLayerIndex: 0,
        layerViewMode: 'all',
        heightToGridScale: 7 / 42,
      })
    );

    // Second bin should have a slightly higher z than first
    expect(result.current[1].z).toBeGreaterThan(result.current[0].z);
    // Difference should be ~0.0002
    const zDiff = result.current[1].z - result.current[0].z;
    expect(zDiff).toBeCloseTo(0.0002, 6);
  });
});
