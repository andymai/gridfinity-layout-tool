import { describe, it, expect } from 'vitest';
import {
  toIsometric,
  getDepthSortKey,
  sortBoxesForRendering,
  darkenColor,
  lightenColor,
  type IsometricBox,
} from '../utils/isometric';

// Height units to grid units conversion (same as in IsometricPreview)
const HEIGHT_TO_GRID_SCALE = 7 / 42;

/**
 * Helper to create a test box
 */
function createBox(
  id: string,
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
  height: number
): IsometricBox {
  return { id, x, y, z, width, depth, height, color: '#ffffff', opacity: 1 };
}

describe('toIsometric', () => {
  it('projects origin to screen origin at rotation 0', () => {
    const result = toIsometric({ x: 0, y: 0, z: 0 }, 0, 1);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeCloseTo(0);
  });

  it('z-axis moves points upward on screen (negative y)', () => {
    const result = toIsometric({ x: 0, y: 0, z: 1 }, 0, 1);
    expect(result.x).toBeCloseTo(0);
    expect(result.y).toBeLessThan(0);
  });

  it('x-axis moves points down-right at rotation 0', () => {
    const result = toIsometric({ x: 1, y: 0, z: 0 }, 0, 1);
    expect(result.x).toBeGreaterThan(0); // Right
    expect(result.y).toBeGreaterThan(0); // Down
  });

  it('y-axis moves points down-left at rotation 0', () => {
    const result = toIsometric({ x: 0, y: 1, z: 0 }, 0, 1);
    expect(result.x).toBeLessThan(0); // Left
    expect(result.y).toBeGreaterThan(0); // Down
  });

  it('scale multiplies coordinates', () => {
    const scale1 = toIsometric({ x: 1, y: 0, z: 0 }, 0, 1);
    const scale2 = toIsometric({ x: 1, y: 0, z: 0 }, 0, 2);
    expect(scale2.x).toBeCloseTo(scale1.x * 2);
    expect(scale2.y).toBeCloseTo(scale1.y * 2);
  });

  it('rotation 90 transforms coordinates correctly', () => {
    // At rotation 0: point (1,0,0) projects to some position
    // At rotation 90: point (0,-1,0) should project to the same position
    // because rotation is counter-clockwise around Z
    const pt0 = toIsometric({ x: 1, y: 0, z: 0 }, 0, 1);
    const pt90 = toIsometric({ x: 0, y: -1, z: 0 }, 90, 1);
    expect(pt90.x).toBeCloseTo(pt0.x, 1);
    expect(pt90.y).toBeCloseTo(pt0.y, 1);
  });
});

describe('getDepthSortKey', () => {
  describe('z-ordering (layer stacking)', () => {
    it('higher z produces higher sort key', () => {
      const low = createBox('low', 0, 0, 0, 1, 1, 1);
      const high = createBox('high', 0, 0, 1, 1, 1, 1);

      const keyLow = getDepthSortKey(low, 0);
      const keyHigh = getDepthSortKey(high, 0);

      expect(keyHigh).toBeGreaterThan(keyLow);
    });

    it('uses top of bin (z + height) for sorting, not center', () => {
      // Two bins at same position, one taller
      const short = createBox('short', 0, 0, 0, 1, 1, 1);
      const tall = createBox('tall', 0, 0, 0, 1, 1, 3);

      const keyShort = getDepthSortKey(short, 0);
      const keyTall = getDepthSortKey(tall, 0);

      // Taller bin should have higher key (drawn later/on top)
      expect(keyTall).toBeGreaterThan(keyShort);
    });

    it('position can override layer when bins are far apart (isometric depth)', () => {
      // In true isometric, a bin at the FRONT (high x+y) of layer 1
      // should appear in front of a bin at the BACK (low x+y) of layer 2.
      // This is correct 3D depth sorting.
      const layer1Corner = createBox('l1corner', 10, 10, 0, 1, 1, 1);
      const layer2Origin = createBox('l2origin', 0, 0, 2, 1, 1, 1);

      const keyL1 = getDepthSortKey(layer1Corner, 0);
      const keyL2 = getDepthSortKey(layer2Origin, 0);

      // Layer 1 bin at front has higher depth key (closer to camera)
      expect(keyL1).toBeGreaterThan(keyL2);
    });

    it('front layer 1 bin occludes back layer 2 bin (isometric depth)', () => {
      // In isometric view, a bin at the FRONT of layer 1 should appear
      // in front of a bin at the BACK of layer 2, even though layer 2 is higher.
      // This is because depth = x + y + z, and front bins have higher x+y.
      const layer1Front = createBox('l1front', 8, 8, 0, 1, 1, 1 * HEIGHT_TO_GRID_SCALE);
      const layer2Back = createBox('l2back', 0, 0, 7 * HEIGHT_TO_GRID_SCALE, 1, 1, 1 * HEIGHT_TO_GRID_SCALE);

      const keyL1 = getDepthSortKey(layer1Front, 0);
      const keyL2 = getDepthSortKey(layer2Back, 0);

      // Front layer 1 bin should be drawn AFTER (on top of) back layer 2 bin
      expect(keyL1).toBeGreaterThan(keyL2);
    });

    it('stacked bins at same position still respect layer order', () => {
      // When bins are at the same XY position, Z determines order
      const layer1 = createBox('l1', 5, 5, 0, 1, 1, 7 * HEIGHT_TO_GRID_SCALE);
      const layer2 = createBox('l2', 5, 5, 7 * HEIGHT_TO_GRID_SCALE, 1, 1, 7 * HEIGHT_TO_GRID_SCALE);

      const keyL1 = getDepthSortKey(layer1, 0);
      const keyL2 = getDepthSortKey(layer2, 0);

      // Layer 2 should still be drawn after layer 1 when at same XY
      expect(keyL2).toBeGreaterThan(keyL1);
    });
  });

  describe('multi-layer spanning bins', () => {
    it('tall bin on layer 1 extending through layer 2 draws after short layer 2 bin', () => {
      // Layer 1 starts at z=0, layer 2 starts at z=7 height units
      const layer1ZStart = 0;
      const layer2ZStart = 7 * HEIGHT_TO_GRID_SCALE; // ~1.17

      // Tall bin on layer 1 (21u height, extends from 0 to 3.5 grid units)
      const tallLayer1 = createBox(
        'tallL1',
        5, 5,
        layer1ZStart,
        2, 2,
        21 * HEIGHT_TO_GRID_SCALE // ~3.5
      );

      // Short bin on layer 2 (7u height, extends from 1.17 to 2.33 grid units)
      const shortLayer2 = createBox(
        'shortL2',
        5, 5, // Same x/y position - overlapping
        layer2ZStart,
        2, 2,
        7 * HEIGHT_TO_GRID_SCALE // ~1.17
      );

      const keyTall = getDepthSortKey(tallLayer1, 0);
      const keyShort = getDepthSortKey(shortLayer2, 0);

      // Tall bin (top at 3.5) should draw after short bin (top at 2.33)
      expect(keyTall).toBeGreaterThan(keyShort);
    });

    it('bin height determines draw order when bins overlap in z-space', () => {
      // Two bins starting at same z, different heights
      const shortBin = createBox('short', 0, 0, 0, 1, 1, 1);
      const tallBin = createBox('tall', 0, 0, 0, 1, 1, 5);

      // Sort them
      const sorted = sortBoxesForRendering([tallBin, shortBin], 0);

      // Short bin should be first (drawn behind), tall bin second (drawn on top)
      expect(sorted[0].id).toBe('short');
      expect(sorted[1].id).toBe('tall');
    });

    it('layer 1 bin with 3x height overlaps and covers layer 2 bin correctly', () => {
      // Simulate: layer 1 at z=0 with height 21u, layer 2 at z=7u with height 7u
      const layer1Bin = createBox('l1', 2, 2, 0, 2, 2, 21 * HEIGHT_TO_GRID_SCALE);
      const layer2Bin = createBox('l2', 2, 2, 7 * HEIGHT_TO_GRID_SCALE, 2, 2, 7 * HEIGHT_TO_GRID_SCALE);

      const sorted = sortBoxesForRendering([layer1Bin, layer2Bin], 0);

      // Layer 2 bin (top at ~2.33) should be drawn first
      // Layer 1 tall bin (top at ~3.5) should be drawn last
      expect(sorted[0].id).toBe('l2');
      expect(sorted[1].id).toBe('l1');
    });
  });

  describe('rotation invariance for z-ordering', () => {
    // Test z-order at every single degree of rotation (0-359)
    for (let rotation = 0; rotation < 360; rotation++) {
      it(`z-order is preserved at rotation ${rotation}°`, () => {
        const bottom = createBox('bottom', 5, 5, 0, 1, 1, 1);
        const top = createBox('top', 5, 5, 2, 1, 1, 1);

        const sorted = sortBoxesForRendering([top, bottom], rotation);
        expect(sorted[0].id).toBe('bottom');
        expect(sorted[1].id).toBe('top');
      });
    }
  });

  describe('multi-layer z-order at every rotation', () => {
    // Test that layer 2 bins always render after layer 1 bins at all rotations
    for (let rotation = 0; rotation < 360; rotation++) {
      it(`layer 2 renders after layer 1 at rotation ${rotation}°`, () => {
        const layer1Bin = createBox('layer1', 3, 3, 0, 2, 2, 7 * HEIGHT_TO_GRID_SCALE);
        const layer2Bin = createBox('layer2', 3, 3, 7 * HEIGHT_TO_GRID_SCALE, 2, 2, 7 * HEIGHT_TO_GRID_SCALE);

        const sorted = sortBoxesForRendering([layer2Bin, layer1Bin], rotation);
        expect(sorted[0].id).toBe('layer1');
        expect(sorted[1].id).toBe('layer2');
      });
    }
  });

  describe('tall bin spanning layers at every rotation', () => {
    // Test that a tall bin on layer 1 extending through layer 2 renders correctly
    for (let rotation = 0; rotation < 360; rotation++) {
      it(`tall layer 1 bin renders after short layer 2 bin at rotation ${rotation}°`, () => {
        // Tall bin on layer 1 (21u height, top at ~3.5 grid units)
        const tallLayer1 = createBox(
          'tallL1', 5, 5, 0, 2, 2, 21 * HEIGHT_TO_GRID_SCALE
        );
        // Short bin on layer 2 (7u height, top at ~2.33 grid units)
        const shortLayer2 = createBox(
          'shortL2', 5, 5, 7 * HEIGHT_TO_GRID_SCALE, 2, 2, 7 * HEIGHT_TO_GRID_SCALE
        );

        const sorted = sortBoxesForRendering([tallLayer1, shortLayer2], rotation);
        // Short layer 2 bin (lower top) should be drawn first
        expect(sorted[0].id).toBe('shortL2');
        // Tall layer 1 bin (higher top) should be drawn last
        expect(sorted[1].id).toBe('tallL1');
      });
    }
  });

  describe('x/y painter algorithm within same layer', () => {
    it('at rotation 0, higher (x+y) bins have higher sort key', () => {
      // At rotation 0: rx = x, ry = y, so rx + ry = x + y
      const frontLeft = createBox('frontLeft', 0, 0, 0, 1, 1, 1);
      const backRight = createBox('backRight', 5, 5, 0, 1, 1, 1);

      const keyFront = getDepthSortKey(frontLeft, 0);
      const keyBack = getDepthSortKey(backRight, 0);

      // Higher (x+y) produces higher key, drawn later
      expect(keyBack).toBeGreaterThan(keyFront);

      // Verify sorted order
      const sorted = sortBoxesForRendering([backRight, frontLeft], 0);
      expect(sorted[0].id).toBe('frontLeft'); // Lower key, drawn first
      expect(sorted[1].id).toBe('backRight'); // Higher key, drawn last
    });
  });
});

describe('sortBoxesForRendering', () => {
  it('sorts boxes by depth key ascending (back to front)', () => {
    const boxes: IsometricBox[] = [
      createBox('a', 0, 0, 2, 1, 1, 1),
      createBox('b', 0, 0, 0, 1, 1, 1),
      createBox('c', 0, 0, 1, 1, 1, 1),
    ];

    const sorted = sortBoxesForRendering(boxes, 0);

    expect(sorted[0].id).toBe('b'); // z=0, lowest
    expect(sorted[1].id).toBe('c'); // z=1
    expect(sorted[2].id).toBe('a'); // z=2, highest
  });

  it('does not mutate original array', () => {
    const boxes: IsometricBox[] = [
      createBox('a', 0, 0, 2, 1, 1, 1),
      createBox('b', 0, 0, 0, 1, 1, 1),
    ];

    const sorted = sortBoxesForRendering(boxes, 0);

    expect(boxes[0].id).toBe('a'); // Original unchanged
    expect(sorted[0].id).toBe('b'); // Sorted is different
  });

  it('handles empty array', () => {
    const sorted = sortBoxesForRendering([], 0);
    expect(sorted).toEqual([]);
  });

  it('handles single box', () => {
    const boxes = [createBox('only', 0, 0, 0, 1, 1, 1)];
    const sorted = sortBoxesForRendering(boxes, 0);
    expect(sorted).toHaveLength(1);
    expect(sorted[0].id).toBe('only');
  });
});

describe('color utilities', () => {
  describe('darkenColor', () => {
    it('darkens white to gray', () => {
      const result = darkenColor('#ffffff', 0.5);
      expect(result).toBe('#808080');
    });

    it('returns black when darkening by 100%', () => {
      const result = darkenColor('#ffffff', 1);
      expect(result).toBe('#000000');
    });

    it('returns same color when darkening by 0%', () => {
      const result = darkenColor('#ff8040', 0);
      expect(result).toBe('#ff8040');
    });
  });

  describe('lightenColor', () => {
    it('lightens black to gray', () => {
      const result = lightenColor('#000000', 0.5);
      expect(result).toBe('#808080');
    });

    it('returns white when lightening by 100%', () => {
      const result = lightenColor('#000000', 1);
      expect(result).toBe('#ffffff');
    });

    it('returns same color when lightening by 0%', () => {
      const result = lightenColor('#ff8040', 0);
      expect(result).toBe('#ff8040');
    });
  });
});
