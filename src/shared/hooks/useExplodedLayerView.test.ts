import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useExplodedLayerView } from './useExplodedLayerView';
import type { Bin, BinId, Layer, LayerId, Category } from '@/core/types';
import { layerId, categoryId, binId, gridUnits, heightUnits } from '@/core/types';
import { STAGING_ID } from '@/core/constants';

function makeLayer(id: string, name: string, height: number): Layer {
  return { id: layerId(id), name, height: heightUnits(height) };
}

function makeCategory(id: string, color: string): Category {
  return { id: categoryId(id), name: id, color };
}

function makeBin(overrides: Partial<Bin> & { id: BinId; layerId: LayerId }): Bin {
  return {
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId('cat1'),
    label: '',
    notes: '',
    ...overrides,
  };
}

const defaultLayers = [makeLayer('layer0', 'Bottom', 3), makeLayer('layer1', 'Top', 3)];
const defaultCategories = [makeCategory('cat1', '#ff0000')];
const defaultBins = [
  makeBin({ id: binId('bin1'), layerId: layerId('layer0'), x: gridUnits(0), y: gridUnits(0) }),
  makeBin({ id: binId('bin2'), layerId: layerId('layer1'), x: gridUnits(1), y: gridUnits(0) }),
  makeBin({ id: binId('bin3'), layerId: layerId('layer1'), x: gridUnits(2), y: gridUnits(1) }),
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
    const bins = [...defaultBins, makeBin({ id: binId('staged'), layerId: STAGING_ID })];

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
