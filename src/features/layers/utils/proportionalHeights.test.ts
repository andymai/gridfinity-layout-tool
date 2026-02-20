import { describe, it, expect } from 'vitest';
import { computeProportionalHeights } from './proportionalHeights';

describe('computeProportionalHeights', () => {
  const CONTAINER = 200;
  const MIN = 40;

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
    expect(result.layerPxHeights[0]).toBeLessThan(result.layerPxHeights[1]);
    expect(result.layerPxHeights[0] + result.layerPxHeights[1]).toBe(CONTAINER);
  });

  it('handles zero unused space without adding segment', () => {
    const result = computeProportionalHeights([6, 6], 0, CONTAINER, MIN);
    expect(result.unusedPx).toBe(0);
    expect(result.layerPxHeights).toHaveLength(2);
  });

  it('guarantees minimum height when many layers overflow', () => {
    // 6 layers at minPx=40 need 240px but container is only 200px
    const result = computeProportionalHeights([1, 1, 1, 1, 1, 1], 0, CONTAINER, MIN);
    for (const px of result.layerPxHeights) {
      expect(px).toBeGreaterThanOrEqual(MIN);
    }
  });

  it('handles all-zero heights gracefully', () => {
    // totalUnits = 0, so no surplus distribution — just minimum heights
    const result = computeProportionalHeights([0, 0], 0, CONTAINER, MIN);
    expect(result.layerPxHeights).toEqual([MIN, MIN]);
  });

  describe('unused space', () => {
    it('gives unused space a compact fixed size, not proportional', () => {
      // 6u unused vs 6u layers — unused should NOT get 50% of space
      const result = computeProportionalHeights([3, 3], 6, CONTAINER, MIN);
      expect(result.unusedPx).toBe(MIN); // capped at minPx
      // Layers get the rest
      const layerTotal = result.layerPxHeights.reduce((s, h) => s + h, 0);
      expect(layerTotal + result.unusedPx).toBeLessThanOrEqual(CONTAINER);
    });

    it('layers dominate the space even with large unused height', () => {
      const result = computeProportionalHeights([3], 9, CONTAINER, MIN);
      // Unused should be compact, not 75% of the container
      expect(result.unusedPx).toBeLessThanOrEqual(MIN);
      expect(result.layerPxHeights[0]).toBeGreaterThan(result.unusedPx);
    });

    it('unused space is zero when no unused height', () => {
      const result = computeProportionalHeights([6, 6], 0, CONTAINER, MIN);
      expect(result.unusedPx).toBe(0);
    });
  });

  describe('with gap', () => {
    const GAP = 4;

    it('subtracts gap space from available pixels', () => {
      // 2 layers, 1 gap = 4px reserved
      const result = computeProportionalHeights([3, 3], 0, CONTAINER, MIN, GAP);
      const total = result.layerPxHeights.reduce((s, h) => s + h, 0);
      expect(total).toBe(CONTAINER - GAP); // 200 - 4 = 196
    });

    it('subtracts multiple gaps for segments including unused', () => {
      // 2 layers + unused = 3 segments, 2 gaps = 8px
      const result = computeProportionalHeights([3, 3], 6, CONTAINER, MIN, GAP);
      const total = result.layerPxHeights.reduce((s, h) => s + h, 0) + result.unusedPx;
      expect(total).toBe(CONTAINER - 2 * GAP); // 200 - 8 = 192
    });

    it('single segment has no gap', () => {
      const result = computeProportionalHeights([6], 0, CONTAINER, MIN, GAP);
      expect(result.layerPxHeights).toEqual([CONTAINER]); // no gaps to subtract
    });
  });

  it('layer pixel total is consistent across configurations', () => {
    const configs = [
      { layers: [1], unused: 0 },
      { layers: [3, 6], unused: 0 },
      { layers: [2, 4, 6], unused: 0 },
    ];
    for (const { layers, unused } of configs) {
      const result = computeProportionalHeights(layers, unused, CONTAINER, MIN);
      const total = result.layerPxHeights.reduce((s, h) => s + h, 0) + result.unusedPx;
      expect(total).toBe(CONTAINER);
    }
  });
});
