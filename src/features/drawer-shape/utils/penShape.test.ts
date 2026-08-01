import { describe, it, expect } from 'vitest';
import { validateOutline } from '@/shared/utils/drawerOutline';
import { arcGeometry } from '@/shared/utils/drawerOutlineGeometry';
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
  alignmentGuides,
  moveVertices,
  removeVertices,
  segmentHandle,
  sketchPathD,
  verticesInRect,
  clampGroupDelta,
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

  // The whole point of the handle: the curve must land under the cursor. An
  // offset-only formula ignores where along the chord the pointer sits, so a
  // sideways drag produced a curve that missed it.
  it('produces an arc that passes through the dragged point', () => {
    for (const p of [
      { x: W / 2, y: -20 },
      { x: W / 4, y: -30 },
      { x: (3 * W) / 4, y: 25 },
    ]) {
      const bulge = bulgeThroughPoint(verts, 0, p.x, p.y);
      const arc = arcGeometry(verts[0], verts[1], bulge);
      expect(arc).not.toBeNull();
      if (arc === null) continue;
      // On the circle: distance from the centre equals the radius.
      expect(Math.hypot(p.x - arc.cx, p.y - arc.cy)).toBeCloseTo(arc.r, 6);
    }
  });

  it('stays zero for a point on the chord', () => {
    expect(bulgeThroughPoint(verts, 0, W / 4, 0)).toBe(0);
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

describe('alignmentGuides', () => {
  const verts = rectangleSketch(W, D);

  it('reports no guide when nothing is near', () => {
    const g = alignmentGuides(verts, new Set([0]), { x: 100, y: 100 }, 5);
    expect(g.x).toBeNull();
    expect(g.y).toBeNull();
    expect(g.point).toEqual({ x: 100, y: 100 });
  });

  it('snaps to a neighbour on each axis independently', () => {
    // Near vertex 1's x (=W) and vertex 3's y (=D), which are different corners.
    const g = alignmentGuides(verts, new Set([2]), { x: W - 2, y: D - 2 }, 5);
    expect(g.x).toBe(W);
    expect(g.y).toBe(D);
    expect(g.point).toEqual({ x: W, y: D });
  });

  // A dragged corner aligning to itself would pin it in place.
  it('ignores the corners being dragged', () => {
    const g = alignmentGuides(verts, new Set([0, 1, 2, 3]), { x: 1, y: 1 }, 5);
    expect(g.x).toBeNull();
    expect(g.y).toBeNull();
  });

  it('respects the tolerance', () => {
    expect(alignmentGuides(verts, new Set([2]), { x: W - 9, y: 0 }, 5).x).toBeNull();
    expect(alignmentGuides(verts, new Set([2]), { x: W - 4, y: 0 }, 5).x).toBe(W);
  });
});

describe('verticesInRect', () => {
  const verts = rectangleSketch(W, D);

  it('finds the corners a sweep encloses, in any drag direction', () => {
    expect(verticesInRect(verts, -10, -10, W + 10, 10)).toEqual([0, 1]);
    // Dragged the other way, the same rectangle selects the same corners.
    expect(verticesInRect(verts, W + 10, 10, -10, -10)).toEqual([0, 1]);
  });

  it('returns nothing for an empty sweep', () => {
    expect(verticesInRect(verts, 100, 100, 120, 120)).toEqual([]);
  });
});

describe('multi-vertex edits', () => {
  const verts = rectangleSketch(W, D);

  it('translates only the given corners, leaving arcs alone', () => {
    const bowed = setBulge(verts, 0, 0.3);
    const moved = moveVertices(bowed, new Set([0, 1]), 5, -5);
    expect(moved[0]).toMatchObject({ x: 5, y: -5, bulge: 0.3 });
    expect(moved[1]).toMatchObject({ x: W + 5, y: -5 });
    expect(moved[2]).toEqual(verts[2]);
  });

  it('removes several corners but never below a triangle', () => {
    expect(removeVertices(verts, new Set([0]))).toHaveLength(3);
    expect(removeVertices(verts, new Set([0, 1]))).toHaveLength(4);
  });
});

describe('degenerate and arc-adjacent edits', () => {
  const verts = rectangleSketch(W, D);

  // Two corners dragged onto each other leave a zero-length segment. Splitting
  // it would divide by the chord and write NaN into the live sketch, which no
  // further editing could recover.
  it('refuses to split a zero-length bowed segment', () => {
    const degenerate = setBulge(moveVertex(verts, 1, 0, 0), 0, 0.5);
    const split = insertVertex(degenerate, 0);
    expect(split).toHaveLength(degenerate.length);
    expect(split.every((v) => Number.isFinite(v.x) && Number.isFinite(v.y))).toBe(true);
  });

  it('keeps the handle on a degenerate segment finite', () => {
    const degenerate = setBulge(moveVertex(verts, 1, 0, 0), 0, 0.5);
    const h = segmentHandle(degenerate, 0);
    expect(Number.isFinite(h.x) && Number.isFinite(h.y)).toBe(true);
  });

  // The predecessor's bulge described an arc ending at the removed corner. Left
  // in place it would curve to a different endpoint entirely.
  it('straightens the segment that spans a removed corner', () => {
    const bowed = setBulge(rectangleSketch(W, D), 1, 0.5);
    // Vertex 1 owns the arc; removing vertex 2 makes it span 1 to 3 instead.
    const after = removeVertex(bowed, 2);
    expect(after).toHaveLength(3);
    expect(after[1]).not.toHaveProperty('bulge');
  });

  it('leaves an arc alone when the removed corner is elsewhere', () => {
    const bowed = setBulge(rectangleSketch(W, D), 1, 0.5);
    expect(removeVertex(bowed, 3)[1].bulge).toBe(0.5);
  });

  it('straightens every span a multi-delete opens', () => {
    const bowed = setBulge(setBulge(rectangleSketch(W, D), 0, 0.4), 2, 0.4);
    // Removing 1 and 3 makes both arcs span new endpoints.
    const after = removeVertices([...bowed, { x: 10, y: 10 }, { x: 20, y: 10 }], new Set([1, 3]));
    expect(after.every((v) => (v.bulge ?? 0) === 0)).toBe(true);
  });

  // Clamping only the grabbed corner is not enough: the same delta applies to
  // the whole selection, so a selected edge would carry its far corner through
  // the wall and leave the outline unappliable.
  it('clamps a group delta against the whole selection, not one corner', () => {
    const all = new Set([0, 1, 2, 3]);
    // The rectangle already spans the drawer, so it cannot move at all.
    const pinned = clampGroupDelta(verts, all, 10, 10, W, D);
    expect(pinned.dx).toBeCloseTo(0, 9);
    expect(pinned.dy).toBeCloseTo(0, 9);

    // The front edge alone can rise, but only to the back wall.
    const front = new Set([0, 1]);
    expect(clampGroupDelta(verts, front, 0, 1000, W, D).dy).toBe(D);
    // Negative zero when the edge is already on the wall, hence toBeCloseTo.
    expect(clampGroupDelta(verts, front, 0, -5, W, D).dy).toBeCloseTo(0, 9);
  });

  it('allows a full move when the selection has room', () => {
    const inset = [
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    expect(clampGroupDelta(inset, new Set([0, 1, 2]), 10, 10, W, D)).toEqual({ dx: 10, dy: 10 });
  });
});
