import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBinsToRender } from './useBinsToRender';
import { createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { binId, categoryId, designId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Layer, Category } from '@/core/types';

function makeBin(overrides: Partial<Bin> = {}): Bin {
  return createTestBin({
    id: binId('bin-1'),
    layerId: layerId('layer-1'),
    category: categoryId('cat-1'),
    clearanceHeight: heightUnits(0),
    ...overrides,
  });
}

const defaultLayers: Layer[] = [
  { id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) },
  { id: layerId('layer-2'), name: 'Layer 2', height: heightUnits(3) },
];

const defaultCategories: Category[] = [
  { id: categoryId('cat-1'), name: 'Category 1', color: '#ff0000' },
];

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
    const linkedDesign = designId('design-1');
    const bins = [
      makeBin({ id: binId('bin-1'), linkedDesignId: linkedDesign }),
      makeBin({ id: binId('bin-2') }),
    ];
    const spec = {
      sig: 'design-1:2026',
      segments: [{ x: 0.5, y: 0, length: 1, orientation: 'vertical' as const }],
      thickness: 0.03,
      height: null,
    };
    const designDividers = new Map([[linkedDesign, spec]]);

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

    const linked = result.current.find((b) => b.bin.id === binId('bin-1'));
    const unlinked = result.current.find((b) => b.bin.id === binId('bin-2'));
    expect(linked?.dividers).toBe(spec);
    expect(unlinked?.dividers).toBeUndefined();
  });

  it('filters out staging bins', () => {
    const bins = [makeBin({ layerId: STAGING_ID })];

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
      makeBin({ id: binId('bin-1'), layerId: layerId('layer-1') }),
      makeBin({ id: binId('bin-2'), layerId: layerId('layer-2') }),
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
      makeBin({ id: binId('bin-1'), layerId: layerId('layer-1') }),
      makeBin({ id: binId('bin-2'), layerId: layerId('layer-2') }),
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
      makeBin({ id: binId('bin-1'), layerId: layerId('layer-1') }),
      makeBin({ id: binId('bin-2'), layerId: layerId('layer-2') }),
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
    const bins = [makeBin({ category: categoryId('cat-1') })];

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
    const layers: Layer[] = [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }];
    const bins = [
      makeBin({ id: binId('far'), x: gridUnits(0), y: gridUnits(5), layerId: layerId('layer-1') }),
      makeBin({
        id: binId('close'),
        x: gridUnits(5),
        y: gridUnits(0),
        layerId: layerId('layer-1'),
      }),
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
      makeBin({
        id: binId('bin-1'),
        x: gridUnits(0),
        y: gridUnits(0),
        layerId: layerId('layer-1'),
      }),
      makeBin({
        id: binId('bin-2'),
        x: gridUnits(1),
        y: gridUnits(0),
        layerId: layerId('layer-1'),
      }),
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
