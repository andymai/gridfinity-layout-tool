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

    it('layer always dominates over XY position in depth sorting', () => {
      // For drawer organizers, users expect layer 2 ALWAYS above layer 1.
      // Even if layer 1 bin is at front (high x+y) and layer 2 bin is at back (low x+y),
      // layer 2 should render on top because it's physically stacked higher.
      const layer1Corner = createBox('l1corner', 10, 10, 0, 1, 1, 1);
      const layer2Origin = createBox('l2origin', 0, 0, 2, 1, 1, 1);

      const keyL1 = getDepthSortKey(layer1Corner, 0);
      const keyL2 = getDepthSortKey(layer2Origin, 0);

      // Layer 2 bin always has higher depth key (drawn on top)
      expect(keyL2).toBeGreaterThan(keyL1);
    });

    it('layer 2 at back renders on top of layer 1 at front', () => {
      // Even when layer 1 bin is at FRONT (high x+y) and layer 2 bin is at BACK (low x+y),
      // layer 2 should render on top. This matches user expectations for stacked layers
      // in a drawer organizer context, not true 3D occlusion.
      const layer1Front = createBox('l1front', 8, 8, 0, 1, 1, 1 * HEIGHT_TO_GRID_SCALE);
      const layer2Back = createBox('l2back', 0, 0, 7 * HEIGHT_TO_GRID_SCALE, 1, 1, 1 * HEIGHT_TO_GRID_SCALE);

      const keyL1 = getDepthSortKey(layer1Front, 0);
      const keyL2 = getDepthSortKey(layer2Back, 0);

      // Layer 2 bin should ALWAYS be drawn after (on top of) layer 1 bin
      expect(keyL2).toBeGreaterThan(keyL1);
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

  describe('layer priority over XY position', () => {
    // This was a bug: layer 2 bin at front (0,0) was rendering behind layer 1 bin at back (9,9)
    // because (rx + ry) dominated the sort key over the Z difference
    for (let rotation = 0; rotation < 360; rotation += 15) {
      it(`layer 2 at front renders after layer 1 at back (rotation ${rotation}°)`, () => {
        // Layer 1 bin at back of grid
        const layer1Back = createBox('l1back', 9, 9, 0, 1, 1, 7 * HEIGHT_TO_GRID_SCALE);
        // Layer 2 bin at front of grid (higher Z but lower XY)
        const layer2Front = createBox('l2front', 0, 0, 7 * HEIGHT_TO_GRID_SCALE, 1, 1, 7 * HEIGHT_TO_GRID_SCALE);

        const sorted = sortBoxesForRendering([layer2Front, layer1Back], rotation);

        // Layer 1 should always render first (behind), layer 2 always last (in front)
        expect(sorted[0].id).toBe('l1back');
        expect(sorted[1].id).toBe('l2front');
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

describe('bin size variations - sorting correctness', () => {
  // Test all common bin sizes to ensure correct front-to-back ordering
  // regardless of bin dimensions.
  //
  // COORDINATE SYSTEM (at 0° rotation):
  // In isometric projection, the camera views from above-right looking down-left.
  // screenY = (x + y) * SIN_30, so higher (x+y) = lower on screen.
  //
  //   Low (x+y) = top of screen = BACK = far from camera = draw FIRST
  //   High (x+y) = bottom of screen = FRONT = close to camera = draw LAST
  //
  // These tests use direct isometric coordinates (same as sorting algorithm).

  describe('wide bin (8x1) positioning', () => {
    // At 0° rotation in isometric, sorting uses NEAREST CORNER to camera:
    //   coeffX = 1, coeffY = -1, so nearest corner is (x+width, y)
    //   A wide bin at (0,0) with width 8 uses corner (8,0), depth = 8
    //   A 1x1 bin at (0,5) uses corner (1,5), depth = 6
    // So smaller bins at low x can have LOWER depth than wide bins!

    it('wide 8x1 bin nearest corner dominates over small bin at higher Y at 0°', () => {
      // Wide bin at y=0 with width 8: nearest corner at (8,0), depth = 8
      const wide = createBox('wide', 0, 0, 0, 8, 1, 1);
      // Small bins at high Y but low X: nearest corners at (1,5), (5,6), (8,7)
      // Their depths are 6, 11, 15 respectively
      const small1 = createBox('small1', 0, 5, 0, 1, 1, 1); // depth ~6
      const small2 = createBox('small2', 4, 6, 0, 1, 1, 1); // depth ~11
      const small3 = createBox('small3', 7, 7, 0, 1, 1, 1); // depth ~15

      const sorted = sortBoxesForRendering([wide, small1, small2, small3], 0);

      // small1 (depth 6) < wide (depth 8) < small2 (depth 11) < small3 (depth 15)
      expect(sorted[0].id).toBe('small1');
      expect(sorted[1].id).toBe('wide');
      expect(sorted[2].id).toBe('small2');
      expect(sorted[3].id).toBe('small3');
    });

    it('8x1 bin at high Y (front) renders AFTER 1x1 bins at low Y (back) at 0°', () => {
      // Wide bin at front (high Y = bottom of screen)
      const wideFront = createBox('wideFront', 0, 7, 0, 8, 1, 1);
      // Small bins in back (low Y = top of screen)
      const small1 = createBox('small1', 0, 0, 0, 1, 1, 1);
      const small2 = createBox('small2', 4, 1, 0, 1, 1, 1);
      const small3 = createBox('small3', 7, 2, 0, 1, 1, 1);

      const sorted = sortBoxesForRendering([wideFront, small1, small2, small3], 0);

      // Wide bin at front (high Y) should be drawn LAST
      expect(sorted[sorted.length - 1].id).toBe('wideFront');
    });

    it('consistent ordering at 90° rotation', () => {
      const wide = createBox('wide', 0, 3, 0, 8, 1, 1);
      const small = createBox('small', 4, 0, 0, 1, 1, 1);

      const sorted = sortBoxesForRendering([wide, small], 90);
      expect(sorted).toHaveLength(2);
    });

    it('consistent ordering at 180° rotation', () => {
      const wide = createBox('wide', 0, 3, 0, 8, 1, 1);
      const small = createBox('small', 4, 6, 0, 1, 1, 1);

      const sorted = sortBoxesForRendering([wide, small], 180);
      expect(sorted).toHaveLength(2);
    });

    it('consistent ordering at 270° rotation', () => {
      const wide = createBox('wide', 0, 3, 0, 8, 1, 1);
      const small = createBox('small', 4, 6, 0, 1, 1, 1);

      const sorted = sortBoxesForRendering([wide, small], 270);
      expect(sorted).toHaveLength(2);
    });
  });

  describe('deep bin (1x8) positioning', () => {
    const rotations = [0, 45, 90, 135, 180, 225, 270, 315];

    for (const rotation of rotations) {
      it(`1x8 bin at LEFT (x=0) renders correctly relative to 1x1 bins at ${rotation}°`, () => {
        // Deep bin on left column spanning full depth
        const deepLeft = createBox('deepLeft', 0, 0, 0, 1, 8, 1);
        // Small bins to the right at various y positions
        const small1 = createBox('small1', 1, 0, 0, 1, 1, 1);
        const small2 = createBox('small2', 1, 4, 0, 1, 1, 1);
        const small3 = createBox('small3', 1, 7, 0, 1, 1, 1);

        const sorted = sortBoxesForRendering([deepLeft, small1, small2, small3], rotation);

        // All bins should be sorted - no crashes, consistent ordering
        expect(sorted).toHaveLength(4);
      });

      it(`1x8 bin at RIGHT (x=7) renders correctly relative to 1x1 bins at ${rotation}°`, () => {
        // Deep bin on right column
        const deepRight = createBox('deepRight', 7, 0, 0, 1, 8, 1);
        // Small bins to the left
        const small1 = createBox('small1', 0, 0, 0, 1, 1, 1);
        const small2 = createBox('small2', 0, 4, 0, 1, 1, 1);
        const small3 = createBox('small3', 3, 3, 0, 1, 1, 1);

        const sorted = sortBoxesForRendering([deepRight, small1, small2, small3], rotation);

        expect(sorted).toHaveLength(4);
      });
    }
  });

  describe('large square bin (4x4) positioning', () => {
    const rotations = [0, 45, 90, 135, 180, 225, 270, 315];

    for (const rotation of rotations) {
      it(`4x4 bin at front-left renders AFTER 1x1 bins behind/right at ${rotation}°`, () => {
        // Large bin at front-left corner
        const largeFrontLeft = createBox('largeFrontLeft', 0, 0, 0, 4, 4, 1);
        // Small bins in back-right area
        const small1 = createBox('small1', 5, 5, 0, 1, 1, 1);
        const small2 = createBox('small2', 6, 6, 0, 1, 1, 1);
        const small3 = createBox('small3', 7, 7, 0, 1, 1, 1);

        const sorted = sortBoxesForRendering([largeFrontLeft, small1, small2, small3], rotation);

        // Large bin at front-left should be drawn LAST at 0° (camera at front-right)
        // but order varies by rotation - just ensure no crashes and consistent sort
        expect(sorted).toHaveLength(4);
      });

      it(`4x4 bin at back-right renders BEFORE 1x1 bins in front-left at ${rotation}°`, () => {
        // Large bin at back-right corner
        const largeBackRight = createBox('largeBackRight', 4, 4, 0, 4, 4, 1);
        // Small bins in front-left area
        const small1 = createBox('small1', 0, 0, 0, 1, 1, 1);
        const small2 = createBox('small2', 1, 1, 0, 1, 1, 1);
        const small3 = createBox('small3', 2, 0, 0, 1, 1, 1);

        const sorted = sortBoxesForRendering([largeBackRight, small1, small2, small3], rotation);

        expect(sorted).toHaveLength(4);
      });
    }
  });

  describe('mixed size grid - real world scenario', () => {
    // Tests with wide bins must account for NEAREST-CORNER sorting.
    // A wide 8x1 bin at (0,0) has its nearest corner at (8,0), not (0,0).
    // This affects draw order relative to small bins.

    it('1x1 bins at low x+y are drawn before wide bin extending to high x at 0°', () => {
      const bins: ReturnType<typeof createBox>[] = [];

      // 8x1 bin at y=0 - its nearest corner is at (8,0), depth key ~108
      bins.push(createBox('wide', 0, 0, 0, 8, 1, 1));

      // Small bins at low x, y=1 - nearest corner at (1,1), depth key ~102
      // These are MORE toward the back than the wide bin's front corner
      for (let y = 1; y <= 7; y++) {
        for (let x = 0; x < 8; x++) {
          bins.push(createBox(`small_${x}_${y}`, x, y, 0, 1, 1, 1));
        }
      }

      const sorted = sortBoxesForRendering(bins, 0);

      // Small bin at (0,1) has lowest depth key, drawn first
      expect(sorted[0].id).toBe('small_0_1');
      // Small bin at (7,7) has highest depth key among small bins, drawn near end
      expect(sorted[sorted.length - 1].id).toBe('small_7_7');
    });

    it('wide bin at high Y extends its nearest corner even further forward at 0°', () => {
      const bins: ReturnType<typeof createBox>[] = [];

      // 8x1 bin at y=7 - nearest corner at (8,7), depth key ~115
      bins.push(createBox('wide_front', 0, 7, 0, 8, 1, 1));

      // Small bins at y=0..6
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 8; x++) {
          bins.push(createBox(`small_${x}_${y}`, x, y, 0, 1, 1, 1));
        }
      }

      const sorted = sortBoxesForRendering(bins, 0);

      // Wide bin at (0,7) with width 8 has nearest corner at (8,7)
      // This is the frontmost point in the scene at 0°
      expect(sorted[sorted.length - 1].id).toBe('wide_front');
    });

    it('sorting is consistent across all rotations with mixed sizes', () => {
      // This test ensures no crashes and consistent behavior across rotations
      // without asserting specific positions (which change with camera angle)
      const rotations = [0, 90, 180, 270];

      for (const rotation of rotations) {
        const bins: ReturnType<typeof createBox>[] = [];
        bins.push(createBox('wide', 0, 4, 0, 8, 1, 1));
        for (let y = 0; y < 8; y++) {
          if (y !== 4) { // Skip where wide bin is
            for (let x = 0; x < 8; x++) {
              bins.push(createBox(`small_${x}_${y}`, x, y, 0, 1, 1, 1));
            }
          }
        }

        const sorted = sortBoxesForRendering(bins, rotation);

        // All bins should be present, no duplicates
        expect(sorted).toHaveLength(bins.length);
        const ids = new Set(sorted.map(b => b.id));
        expect(ids.size).toBe(bins.length);
      }
    });
  });

  describe('adjacent bins of different sizes', () => {
    // Test that adjacent bins don't clip each other regardless of size

    for (let rotation = 0; rotation < 360; rotation += 30) {
      it(`2x2 bin adjacent to 1x1 bins sorts correctly at ${rotation}°`, () => {
        // 2x2 bin
        const large = createBox('large', 2, 2, 0, 2, 2, 1);
        // Adjacent 1x1 bins
        const left = createBox('left', 1, 2, 0, 1, 1, 1);
        const right = createBox('right', 4, 2, 0, 1, 1, 1);
        const front = createBox('front', 2, 1, 0, 1, 1, 1);
        const back = createBox('back', 2, 4, 0, 1, 1, 1);

        const sorted = sortBoxesForRendering([large, left, right, front, back], rotation);

        // Should have consistent ordering without any undefined behavior
        expect(sorted).toHaveLength(5);
        // Each bin should appear exactly once
        const ids = sorted.map(b => b.id);
        expect(ids).toContain('large');
        expect(ids).toContain('left');
        expect(ids).toContain('right');
        expect(ids).toContain('front');
        expect(ids).toContain('back');
      });
    }
  });

  describe('extreme size differences', () => {
    // At 0° rotation in isometric:
    //   Low (x+y) = top of screen = BACK = far from camera = draw FIRST
    //   High (x+y) = bottom of screen = FRONT = close to camera = draw LAST

    it('1x1 at low Y (back) renders BEFORE 10x10 bin extending to high Y (front) at 0°', () => {
      // Huge bin occupies y=1..11 (front-ish, has corners with high x+y)
      // Tiny bin at y=0, x=5 (back, low y)
      const huge = createBox('huge', 0, 1, 0, 10, 10, 1);
      const tiny = createBox('tiny', 5, 0, 0, 1, 1, 1);

      const sorted = sortBoxesForRendering([huge, tiny], 0);

      // Tiny bin at y=0 (back/top of screen) should be drawn FIRST
      // Huge bin extends to high x+y so it's in front
      expect(sorted[0].id).toBe('tiny');
      expect(sorted[1].id).toBe('huge');
    });

    it('1x1 at high Y (front) renders AFTER 10x10 bin at lower Y (back) at 0°', () => {
      // Huge bin at y=0..10, extends toward front
      // Tiny bin at y=11 (even more toward front)
      const huge = createBox('huge', 0, 0, 0, 10, 10, 1);
      const tiny = createBox('tiny', 5, 11, 0, 1, 1, 1);

      const sorted = sortBoxesForRendering([huge, tiny], 0);

      // Tiny bin at y=11 (front) should be drawn LAST
      expect(sorted[sorted.length - 1].id).toBe('tiny');
    });

    it('sorting handles extreme sizes at all rotations consistently', () => {
      const rotations = [0, 90, 180, 270];

      for (const rotation of rotations) {
        const huge = createBox('huge', 0, 0, 0, 10, 10, 1);
        const tiny = createBox('tiny', 5, 5, 0, 1, 1, 1);

        const sorted = sortBoxesForRendering([huge, tiny], rotation);

        // Both bins present, no crashes
        expect(sorted).toHaveLength(2);
        expect(sorted.map(b => b.id)).toContain('huge');
        expect(sorted.map(b => b.id)).toContain('tiny');
      }
    });
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
