import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExplodedLayerView } from './useExplodedLayerView';
import type { Bin, Layer, Category } from '@/core/types';
import { layerId, categoryId, binId } from '@/core/types';
import type { GridUnits, HeightUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

function makeLayer(id: string, name: string, height: number): Layer {
  return { id: layerId(id), name, height: height as HeightUnits };
}

function makeCategory(id: string, color: string): Category {
  return { id: categoryId(id), name: id, color };
}

function makeBin(overrides: Partial<Bin> & { id: string; layerId: string }): Bin {
  return {
    id: binId(overrides.id),
    layerId: layerId(overrides.layerId),
    x: 0 as GridUnits,
    y: 0 as GridUnits,
    width: 1 as GridUnits,
    depth: 1 as GridUnits,
    height: 3 as HeightUnits,
    category: categoryId('cat1'),
    label: '',
    notes: '',
    ...overrides,
  } as Bin;
}

const defaultLayers = [makeLayer('layer0', 'Bottom', 3), makeLayer('layer1', 'Top', 3)];
const defaultCategories = [makeCategory('cat1', '#ff0000')];
const defaultBins = [
  makeBin({ id: 'bin1', layerId: 'layer0', x: 0 as GridUnits, y: 0 as GridUnits }),
  makeBin({ id: 'bin2', layerId: 'layer1', x: 1 as GridUnits, y: 0 as GridUnits }),
  makeBin({ id: 'bin3', layerId: 'layer1', x: 2 as GridUnits, y: 1 as GridUnits }),
];

const heightToGridScale = 7 / 42; // 0.1667
const heightUnitMm = 7;

describe('useExplodedLayerView', () => {
  it('returns null when not in exploded mode', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: false,
      })
    );

    expect(result.current).toBeNull();
  });

  it('returns one group per layer when exploded', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    expect(result.current).not.toBeNull();
    expect(result.current).toHaveLength(2);
    expect(result.current![0].layer.id).toBe(layerId('layer0'));
    expect(result.current![1].layer.id).toBe(layerId('layer1'));
  });

  it('partitions bins into correct layer groups', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    expect(result.current![0].bins).toHaveLength(1);
    expect(result.current![0].bins[0].bin.id).toBe(binId('bin1'));

    expect(result.current![1].bins).toHaveLength(2);
    const layer1BinIds = result.current![1].bins.map((b) => b.bin.id);
    expect(layer1BinIds).toContain(binId('bin2'));
    expect(layer1BinIds).toContain(binId('bin3'));
  });

  it('computes incremental explodedZOffset per layer', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    expect(result.current![0].explodedZOffset).toBe(0);
    expect(result.current![1].explodedZOffset).toBe(2.5); // EXPLODE_GAP = 2.5
  });

  it('sets active layer to full opacity and others dimmed', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    expect(result.current![0].isActive).toBe(true);
    expect(result.current![0].opacity).toBe(1);

    expect(result.current![1].isActive).toBe(false);
    expect(result.current![1].opacity).toBe(0.35);
  });

  it('bins inherit layer opacity', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    // Active layer bins get opacity 1
    expect(result.current![0].bins[0].opacity).toBe(1);
    // Inactive layer bins get dimmed opacity
    expect(result.current![1].bins[0].opacity).toBe(0.35);
  });

  it('excludes staging bins', () => {
    const bins = [...defaultBins, makeBin({ id: 'staged', layerId: STAGING_ID })];

    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    const allBins = result.current!.flatMap((g) => g.bins);
    expect(allBins).toHaveLength(3); // excludes the staged bin
  });

  it('computes labelHeightMm from layer height and heightUnitMm', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    // layer0 height = 3 height units * 7mm = 21mm
    expect(result.current![0].labelHeightMm).toBe(21);
  });

  it('applies category colors to bins', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    expect(result.current![0].bins[0].color).toBe('#ff0000');
  });

  it('handles empty layers gracefully', () => {
    const threeLayers = [...defaultLayers, makeLayer('layer2', 'Empty', 2)];

    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: threeLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: true,
      })
    );

    expect(result.current).toHaveLength(3);
    expect(result.current![2].bins).toHaveLength(0);
    expect(result.current![2].explodedZOffset).toBe(5); // 2 * 2.5
  });

  it('returns groups with zero offsets during exit animation', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: false,
        isExitAnimating: true,
      })
    );

    expect(result.current).not.toBeNull();
    expect(result.current).toHaveLength(2);
    // Offsets should be 0 (layers animate back to stacked position)
    expect(result.current![0].explodedZOffset).toBe(0);
    expect(result.current![1].explodedZOffset).toBe(0);
    // Opacity should be full (no dimming during exit)
    expect(result.current![0].opacity).toBe(1);
    expect(result.current![1].opacity).toBe(1);
  });

  it('returns null when not exploded and not exit-animating', () => {
    const { result } = renderHook(() =>
      useExplodedLayerView({
        bins: defaultBins,
        layers: defaultLayers,
        categories: defaultCategories,
        heightToGridScale,
        heightUnitMm,
        activeLayerId: layerId('layer0'),
        isExplodedView: false,
        isExitAnimating: false,
      })
    );

    expect(result.current).toBeNull();
  });
});
