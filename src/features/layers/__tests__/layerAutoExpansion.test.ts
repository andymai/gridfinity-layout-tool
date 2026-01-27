import { describe, it, expect } from 'vitest';
import { calculateLayerAutoExpansion } from '../utils/layerAutoExpansion';
import type { Layer, Bin } from '@/core/types';

// Helper to create a test bin with required fields
const createBin = (id: string, layerId: string, height: number): Bin => ({
  id,
  layerId,
  x: 0,
  y: 0,
  width: 1,
  depth: 1,
  height,
  category: 'default',
  label: '',
  notes: '',
});

describe('calculateLayerAutoExpansion', () => {
  describe('no expansion needed', () => {
    it('returns needsExpansion: false when no bins on layer', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [];

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 10);

      expect(result.needsExpansion).toBe(false);
      expect(result.wouldExceedCapacity).toBe(false);
    });

    it('returns needsExpansion: false when all bins fit within layer height', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 3 };
      const bins: Bin[] = [
        createBin('bin1', 'layer1', 2),
        createBin('bin2', 'layer1', 3),
        createBin('bin3', 'layer1', 1),
      ];

      const result = calculateLayerAutoExpansion(topLayer, bins, 3, 10);

      expect(result.needsExpansion).toBe(false);
      expect(result.wouldExceedCapacity).toBe(false);
    });

    it('ignores bins on other layers', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [
        createBin('bin1', 'layer1', 2), // fits
        createBin('bin2', 'layer2', 5), // on different layer, ignored
      ];

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 10);

      expect(result.needsExpansion).toBe(false);
    });
  });

  describe('expansion needed and fits', () => {
    it('expands to smallest exceeding bin height when all bins exceed', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [
        createBin('bin1', 'layer1', 4), // exceeds by 2
        createBin('bin2', 'layer1', 5), // exceeds by 3
        createBin('bin3', 'layer1', 3), // exceeds by 1 (smallest!)
      ];

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 10);

      expect(result.needsExpansion).toBe(true);
      expect(result.newHeight).toBe(3); // smallest exceeding height
      expect(result.wouldExceedCapacity).toBe(false);
      expect(result.smallestExceedingHeight).toBe(3);
    });

    it('expands to smallest exceeding bin height, preserving intentionally tall bins', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [
        createBin('bin1', 'layer1', 2), // fits exactly
        createBin('bin2', 'layer1', 3), // exceeds by 1 (smallest exceeding)
        createBin('bin3', 'layer1', 6), // intentionally tall, spans layers
      ];

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 10);

      expect(result.needsExpansion).toBe(true);
      expect(result.newHeight).toBe(3); // NOT 6 - preserves the tall bin's protrusion
      expect(result.wouldExceedCapacity).toBe(false);
    });

    it('handles single exceeding bin', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [createBin('bin1', 'layer1', 4)];

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 10);

      expect(result.needsExpansion).toBe(true);
      expect(result.newHeight).toBe(4);
      expect(result.wouldExceedCapacity).toBe(false);
    });
  });

  describe('expansion would exceed capacity', () => {
    it('returns wouldExceedCapacity: true when expansion + new layer exceeds drawer', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [createBin('bin1', 'layer1', 4)]; // needs 2 more units
      // totalLayerHeight=2, expansion=2, new layer needs at least 1
      // 2 + 2 + 1 = 5, but drawer is only 4

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 4);

      expect(result.needsExpansion).toBe(true);
      expect(result.wouldExceedCapacity).toBe(true);
      expect(result.newHeight).toBe(4);
      expect(result.smallestExceedingHeight).toBe(4);
    });

    it('fits exactly when expansion + new layer equals drawer height', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [createBin('bin1', 'layer1', 4)]; // needs 2 more units
      // totalLayerHeight=2, expansion=2, new layer=1
      // 2 + 2 + 1 = 5 = drawer height

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 5);

      expect(result.needsExpansion).toBe(true);
      expect(result.wouldExceedCapacity).toBe(false);
      expect(result.newHeight).toBe(4);
    });

    it('accounts for multiple existing layers in totalLayerHeight', () => {
      const topLayer: Layer = { id: 'layer2', name: 'Layer 2', height: 2 };
      const bins: Bin[] = [createBin('bin1', 'layer2', 3)]; // needs 1 more unit
      // totalLayerHeight=5 (layer1=3 + layer2=2), expansion=1, new layer=1
      // 5 + 1 + 1 = 7, drawer=8

      const result = calculateLayerAutoExpansion(topLayer, bins, 5, 8);

      expect(result.needsExpansion).toBe(true);
      expect(result.wouldExceedCapacity).toBe(false);
      expect(result.newHeight).toBe(3);
    });

    it('fails when multiple layers leave no room for expansion', () => {
      const topLayer: Layer = { id: 'layer2', name: 'Layer 2', height: 2 };
      const bins: Bin[] = [createBin('bin1', 'layer2', 4)]; // needs 2 more units
      // totalLayerHeight=6, expansion=2, new layer=1
      // 6 + 2 + 1 = 9 > drawer=8

      const result = calculateLayerAutoExpansion(topLayer, bins, 6, 8);

      expect(result.needsExpansion).toBe(true);
      expect(result.wouldExceedCapacity).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles bins with height exactly equal to layer height', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 3 };
      const bins: Bin[] = [
        createBin('bin1', 'layer1', 3), // exactly equal, does NOT exceed
      ];

      const result = calculateLayerAutoExpansion(topLayer, bins, 3, 10);

      expect(result.needsExpansion).toBe(false);
    });

    it('handles mixed bins - some fit, some exceed', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [
        createBin('bin1', 'layer1', 1), // fits
        createBin('bin2', 'layer1', 2), // fits exactly
        createBin('bin3', 'layer1', 3), // exceeds (only one)
      ];

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 10);

      expect(result.needsExpansion).toBe(true);
      expect(result.newHeight).toBe(3);
    });

    it('handles layer height of 1 (minimum)', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 1 };
      const bins: Bin[] = [createBin('bin1', 'layer1', 2)];

      const result = calculateLayerAutoExpansion(topLayer, bins, 1, 10);

      expect(result.needsExpansion).toBe(true);
      expect(result.newHeight).toBe(2);
    });

    it('handles drawer at exact capacity (no room for any layer)', () => {
      const topLayer: Layer = { id: 'layer1', name: 'Layer 1', height: 2 };
      const bins: Bin[] = [createBin('bin1', 'layer1', 3)];
      // totalLayerHeight=2, expansion=1, new layer=1
      // 2 + 1 + 1 = 4, drawer=3 (already over capacity just from layers)

      const result = calculateLayerAutoExpansion(topLayer, bins, 2, 3);

      expect(result.wouldExceedCapacity).toBe(true);
    });
  });
});
