import { describe, it, expect } from 'vitest';
import { computeProportionalHeights } from './proportionalHeights';

describe('computeProportionalHeights', () => {
  const CONTAINER = 160;
  const MIN = 32;

  it('returns empty for no layers', () => {
    const result = computeProportionalHeights([], 0, CONTAINER, MIN);
    expect(result).toEqual({ layerPxHeights: [], unusedPx: 0 });
  });

  it('gives single layer full container height', () => {
    const result = computeProportionalHeights([6], 0, CONTAINER, MIN);
    expect(result.layerPxHeights).toEqual([CONTAINER]);
    expect(result.unusedPx).toBe(0);
  });

  it('distributes equal layers equally', () => {
    const result = computeProportionalHeights([3, 3], 0, CONTAINER, MIN);
    expect(result.layerPxHeights[0]).toBe(result.layerPxHeights[1]);
    expect(result.layerPxHeights[0] + result.layerPxHeights[1]).toBe(CONTAINER);
  });

  it('distributes unequal layers proportionally', () => {
    // 3u and 6u — 1:2 ratio
    const result = computeProportionalHeights([3, 6], 0, CONTAINER, MIN);
    // Both get min (32) + surplus distributed 1:2
    // surplus = 160 - 64 = 96, layer1 gets 32, layer2 gets 64
    expect(result.layerPxHeights[0]).toBeLessThan(result.layerPxHeights[1]);
    expect(result.layerPxHeights[0] + result.layerPxHeights[1]).toBe(CONTAINER);
  });

  it('includes unused space as last segment', () => {
    const result = computeProportionalHeights([3], 3, CONTAINER, MIN);
    // 2 equal segments — should split evenly
    expect(result.layerPxHeights).toHaveLength(1);
    expect(result.unusedPx).toBeGreaterThan(0);
    expect(result.layerPxHeights[0] + result.unusedPx).toBe(CONTAINER);
  });

  it('handles zero unused space without adding segment', () => {
    const result = computeProportionalHeights([6, 6], 0, CONTAINER, MIN);
    expect(result.unusedPx).toBe(0);
    expect(result.layerPxHeights).toHaveLength(2);
  });

  it('guarantees minimum height when many layers overflow', () => {
    // 6 layers at minPx=32 need 192px but container is only 160px
    const result = computeProportionalHeights([1, 1, 1, 1, 1, 1], 0, CONTAINER, MIN);
    // Every segment should get at least minPx
    for (const px of result.layerPxHeights) {
      expect(px).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('handles all-zero heights gracefully', () => {
    // totalUnits = 0, so no surplus distribution — just minimum heights
    const result = computeProportionalHeights([0, 0], 0, CONTAINER, MIN);
    expect(result.layerPxHeights).toEqual([MIN, MIN]);
  });

  it('handles single layer with unused space', () => {
    const result = computeProportionalHeights([3], 9, CONTAINER, MIN);
    // 3u layer + 9u unused — 1:3 ratio
    expect(result.unusedPx).toBeGreaterThan(result.layerPxHeights[0]);
    expect(result.layerPxHeights[0] + result.unusedPx).toBe(CONTAINER);
  });

  it('total pixels always equal container when segments fit', () => {
    // Various configurations
    const configs = [
      { layers: [1], unused: 0 },
      { layers: [3, 6], unused: 3 },
      { layers: [2, 4, 6], unused: 0 },
      { layers: [1, 1, 1, 1], unused: 8 },
    ];
    for (const { layers, unused } of configs) {
      const result = computeProportionalHeights(layers, unused, CONTAINER, MIN);
      const total = result.layerPxHeights.reduce((s, h) => s + h, 0) + result.unusedPx;
      expect(total).toBe(CONTAINER);
    }
  });

  describe('with gap', () => {
    const GAP = 2;

    it('subtracts gap space from available pixels', () => {
      // 2 segments with 2px gap = 2px reserved for gaps
      const result = computeProportionalHeights([3, 3], 0, CONTAINER, MIN, GAP);
      const total = result.layerPxHeights.reduce((s, h) => s + h, 0);
      // Row heights should sum to container minus gap space
      expect(total).toBe(CONTAINER - GAP); // 160 - 2 = 158
    });

    it('subtracts multiple gaps for multiple segments', () => {
      // 3 layers + unused = 4 segments, 3 gaps = 6px
      const result = computeProportionalHeights([2, 2, 2], 6, CONTAINER, MIN, GAP);
      const total = result.layerPxHeights.reduce((s, h) => s + h, 0) + result.unusedPx;
      expect(total).toBe(CONTAINER - 3 * GAP); // 160 - 6 = 154
    });

    it('single segment has no gap', () => {
      const result = computeProportionalHeights([6], 0, CONTAINER, MIN, GAP);
      expect(result.layerPxHeights).toEqual([CONTAINER]); // no gaps to subtract
    });
  });
});
