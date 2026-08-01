import { describe, it, expect } from 'vitest';
import { validateOutline } from '@/shared/utils/drawerOutline';
import {
  bulgeThroughPoint,
  clampToDrawer,
  hitSegmentMidpoint,
  hitVertex,
  insertVertex,
  isClockwise,
  moveVertex,
  rectangleSketch,
  removeVertex,
  reverseWinding,
  setBulge,
  segmentHandle,
  sketchPathD,
  sketchToOutline,
  snapMm,
} from './penShape';

const U = 42;
const W = 6 * U;
const D = 4 * U;

describe('snapMm', () => {
  it('snaps to whole, half and quarter units', () => {
    expect(snapMm(50, U, 1)).toBe(42);
    // Half-unit step is 21mm: 50 lands nearer 42 than 63.
    expect(snapMm(50, U, 0.5)).toBe(42);
    expect(snapMm(55, U, 0.5)).toBe(63);
    expect(snapMm(50, U, 0.25)).toBe(52.5);
  });

  it('rounds to 2dp rather than snapping when snapping is off', () => {
    expect(snapMm(50.123, U, 0)).toBe(50.12);
  });
});

describe('clampToDrawer', () => {
  it('keeps a point inside the drawer extent', () => {
    expect(clampToDrawer(-5, D + 5, W, D)).toEqual({ x: 0, y: D });
  });

  it('leaves an interior point alone', () => {
    expect(clampToDrawer(10, 20, W, D)).toEqual({ x: 10, y: 20 });
  });
});

describe('winding', () => {
  it('reads the rectangle sketch as counter-clockwise', () => {
    expect(isClockwise(rectangleSketch(W, D))).toBe(false);
  });

  it('detects a clockwise loop', () => {
    expect(isClockwise([...rectangleSketch(W, D)].reverse())).toBe(true);
  });

  // A bulge belongs to the segment leaving its vertex, so reversing has to hand
  // it to that segment's new owner and flip its sign. Without both, an outward
  // bow becomes an inward bite the moment the loop is drawn the other way.
  it('keeps an arc on the same side of the perimeter when reversed', () => {
    const drawn = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: D, bulge: 0.4 },
      { x: 0, y: D },
    ];
    const flipped = reverseWinding(drawn);
    const area = (vs: typeof drawn): number =>
      sketchToOutline(vs).vertices.length > 0
        ? Math.abs(
            vs.reduce((acc, v, i) => {
              const n = vs[(i + 1) % vs.length];
              return acc + (v.x * n.y - n.x * v.y) / 2;
            }, 0)
          )
        : 0;
    // Same chord polygon either way; the bulge moved and negated.
    expect(area(flipped)).toBeCloseTo(area(drawn), 6);
    const bowed = flipped.filter((v) => v.bulge !== undefined);
    expect(bowed).toHaveLength(1);
    expect(bowed[0].bulge).toBeCloseTo(-0.4, 9);
  });
});

describe('sketchToOutline', () => {
  it('stores counter-clockwise and marks the pen authoring surface', () => {
    const outline = sketchToOutline([...rectangleSketch(W, D)].reverse());
    expect(outline.authoring).toEqual({ kind: 'pen' });
    expect(isClockwise(outline.vertices)).toBe(false);
  });

  it('produces an outline the shared validator accepts', () => {
    const outline = sketchToOutline([
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: D / 2 },
      { x: W / 2, y: D },
      { x: 0, y: D },
    ]);
    expect(validateOutline(outline, W, D, U)).toBeNull();
  });
});

describe('hit testing', () => {
  const verts = rectangleSketch(W, D);

  it('finds a vertex within the radius and misses beyond it', () => {
    expect(hitVertex(verts, 2, 2, 6)).toBe(0);
    expect(hitVertex(verts, 30, 30, 6)).toBe(-1);
  });

  it('finds the segment whose midpoint is nearest', () => {
    expect(hitSegmentMidpoint(verts, W / 2, 1, 6)).toBe(0);
    expect(hitSegmentMidpoint(verts, W / 2, D / 2, 6)).toBe(-1);
  });
});

describe('bulgeThroughPoint', () => {
  const verts = rectangleSketch(W, D);

  it('is zero on the chord', () => {
    expect(bulgeThroughPoint(verts, 0, W / 2, 0)).toBeCloseTo(0, 9);
  });

  it('bows away from the interior for a point outside the loop', () => {
    // Segment 0 runs left to right along y=0; the interior is above it.
    expect(bulgeThroughPoint(verts, 0, W / 2, -10)).toBeGreaterThan(0);
    expect(bulgeThroughPoint(verts, 0, W / 2, 10)).toBeLessThan(0);
  });

  it('caps at a half circle', () => {
    expect(bulgeThroughPoint(verts, 0, W / 2, -10_000)).toBe(1);
    expect(bulgeThroughPoint(verts, 0, W / 2, 10_000)).toBe(-1);
  });
});

describe('editing', () => {
  const verts = rectangleSketch(W, D);

  it('moves one vertex without touching the others', () => {
    const moved = moveVertex(verts, 2, 10, 20);
    expect(moved[2]).toEqual({ x: 10, y: 20 });
    expect(moved[0]).toEqual(verts[0]);
    expect(verts[2]).toEqual({ x: W, y: D });
  });

  it('drops the bulge field entirely when a segment straightens', () => {
    const bowed = setBulge(verts, 1, 0.5);
    expect(bowed[1].bulge).toBe(0.5);
    expect(setBulge(bowed, 1, 0)[1]).not.toHaveProperty('bulge');
  });

  it('inserts a midpoint on a straight segment', () => {
    const split = insertVertex(verts, 0);
    expect(split).toHaveLength(5);
    expect(split[1]).toEqual({ x: W / 2, y: 0 });
  });

  // Splitting an arc has to halve the sweep on both halves, or the curve jumps
  // the moment a point is added mid-arc.
  it('keeps an arc on its path when split', () => {
    const bowed = setBulge(verts, 0, 0.5);
    const split = insertVertex(bowed, 0);
    expect(split).toHaveLength(5);
    const half = Math.tan(Math.atan(0.5) / 2);
    expect(split[0].bulge).toBeCloseTo(half, 9);
    expect(split[1].bulge).toBeCloseTo(half, 9);
    // The new point sits off the chord, on the arc itself.
    expect(split[1].y).toBeLessThan(0);
  });

  it('removes a vertex but never below a triangle', () => {
    expect(removeVertex(verts, 0)).toHaveLength(3);
    expect(removeVertex(rectangleSketch(W, D).slice(0, 3), 0)).toHaveLength(3);
  });
});

describe('sketchPathD', () => {
  it('emits straight segments as lines and closes the loop', () => {
    const d = sketchPathD(rectangleSketch(W, D));
    // `Z` draws the straight closing segment, so it is not also emitted as a line.
    expect(d).toBe(`M 0 0 L ${W} 0 L ${W} ${D} L 0 ${D} Z`);
  });

  it('still emits the closing segment when it is bowed', () => {
    // Segment 3 is the one `Z` would otherwise straight-line.
    const d = sketchPathD(setBulge(rectangleSketch(W, D), 3, 0.4));
    expect(d.split('A ')).toHaveLength(2);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('emits a bowed segment as a real arc, not a flattened polyline', () => {
    const d = sketchPathD(setBulge(rectangleSketch(W, D), 0, 0.5));
    expect(d).toContain('A ');
    // Half circle at most, so the large-arc flag is never set.
    expect(d).not.toMatch(/A [^ ]+ [^ ]+ 0 1 /);
  });

  it('returns nothing for a sketch too short to draw', () => {
    expect(sketchPathD([{ x: 0, y: 0 }])).toBe('');
  });
});

describe('segmentHandle', () => {
  it('sits on the chord midpoint for a straight segment', () => {
    expect(segmentHandle(rectangleSketch(W, D), 0)).toEqual({ x: W / 2, y: 0 });
  });

  // The handle has to render where it can be grabbed, so it rides the arc.
  it('rides the arc for a bowed segment, and hit testing follows it', () => {
    const bowed = setBulge(rectangleSketch(W, D), 0, 0.5);
    const h = segmentHandle(bowed, 0);
    expect(h.y).toBeLessThan(0);
    expect(hitSegmentMidpoint(bowed, h.x, h.y, 6)).toBe(0);
    // The chord midpoint is now far from the handle, so it must not hit.
    expect(hitSegmentMidpoint(bowed, W / 2, 0, 6)).toBe(-1);
  });
});
