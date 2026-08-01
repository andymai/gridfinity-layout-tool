import { describe, it, expect } from 'vitest';
import type { DrawerOutline } from '@/core/types';
import { filletOutline, unfilletOutline } from './filletOutline';
import { quantizeOutline, validateOutline } from './drawerOutline';
import { arcGeometry, flattenOutline, outlineSignedArea } from './drawerOutlineGeometry';

const U = 42;
const W = 8 * U;
const D = 6 * U;

const rect = (): DrawerOutline => ({
  vertices: [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: D },
    { x: 0, y: D },
  ],
});

/** L-shape: a notch out of the back-right, giving one concave corner. */
const lShape = (): DrawerOutline => ({
  vertices: [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: D / 2 },
    { x: W / 2, y: D / 2 },
    { x: W / 2, y: D },
    { x: 0, y: D },
  ],
});

describe('filletOutline', () => {
  it('leaves the outline untouched for a negligible radius', () => {
    const o = rect();
    expect(filletOutline(o, 0)).toBe(o);
  });

  it('replaces each corner with two points joined by an arc', () => {
    const filleted = filletOutline(rect(), 20);
    expect(filleted.vertices).toHaveLength(8);
    const arcs = filleted.vertices.filter((v) => (v.bulge ?? 0) !== 0);
    expect(arcs).toHaveLength(4);
  });

  // A quarter turn sweeps 90°, whose bulge is tan(90°/4).
  it('gives a right-angle corner the arc a 90 degree sweep implies', () => {
    const filleted = filletOutline(rect(), 20);
    const bulge = filleted.vertices.find((v) => (v.bulge ?? 0) !== 0)?.bulge;
    expect(bulge).toBeCloseTo(Math.tan(Math.PI / 8), 9);
  });

  it('produces an arc of exactly the requested radius', () => {
    const r = 20;
    const filleted = filletOutline(rect(), r);
    const i = filleted.vertices.findIndex((v) => (v.bulge ?? 0) !== 0);
    const a = filleted.vertices[i];
    const b = filleted.vertices[(i + 1) % filleted.vertices.length];
    const arc = arcGeometry(a, b, a.bulge ?? 0);
    expect(arc?.r).toBeCloseTo(r, 6);
  });

  it('rounds a convex corner inward, removing material', () => {
    const before = Math.abs(outlineSignedArea(rect()));
    const after = Math.abs(outlineSignedArea(filletOutline(rect(), 20)));
    expect(after).toBeLessThan(before);
    // Four quarter-circles cut from four square corners: r²(4 − π). Areas come
    // from the flattened polyline, whose chords cut just inside each arc, so
    // this is checked to ~2% rather than exactly.
    const exact = 20 * 20 * (4 - Math.PI);
    expect(before - after).toBeGreaterThan(exact * 0.98);
    expect(before - after).toBeLessThan(exact * 1.02);
  });

  // A concave corner curves the other way, so its arc must carry the opposite
  // sign or the notch would bulge outward instead of being relieved.
  it('signs a concave corner the other way', () => {
    const filleted = filletOutline(lShape(), 15);
    const bulges = filleted.vertices.map((v) => v.bulge ?? 0).filter((b) => b !== 0);
    expect(bulges.some((b) => b > 0)).toBe(true);
    expect(bulges.some((b) => b < 0)).toBe(true);
  });

  it('keeps the result valid, wound the same way, and inside the drawer', () => {
    for (const shape of [rect(), lShape()]) {
      const filleted = filletOutline(shape, 15);
      expect(validateOutline(filleted, W, D, U)).toBeNull();
      expect(outlineSignedArea(filleted)).toBeGreaterThan(0);
      for (const p of flattenOutline(filleted)) {
        expect(p.x).toBeGreaterThanOrEqual(-0.01);
        expect(p.y).toBeGreaterThanOrEqual(-0.01);
        expect(p.x).toBeLessThanOrEqual(W + 0.01);
        expect(p.y).toBeLessThanOrEqual(D + 0.01);
      }
    }
  });

  // Two fillets sharing an edge must not eat past its midpoint, or the loop
  // folds over itself and the shape stops being valid at all.
  it('caps the setback so an oversized radius cannot fold the loop', () => {
    const filleted = filletOutline(rect(), 10_000);
    expect(validateOutline(filleted, W, D, U)).toBeNull();
    expect(outlineSignedArea(filleted)).toBeGreaterThan(0);
  });

  it('leaves a corner sharp when either adjacent segment is already an arc', () => {
    const curved: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: W, y: 0, bulge: 0.3 },
        { x: W, y: D },
        { x: 0, y: D },
      ],
    };
    const filleted = filletOutline(curved, 20);
    // The two corners touching the bowed segment stay put; the other two round.
    expect(filleted.vertices.filter((v) => (v.bulge ?? 0) !== 0)).toHaveLength(3);
  });

  it('carries the authoring echo through unchanged', () => {
    const o: DrawerOutline = { ...rect(), authoring: { kind: 'pen' } };
    expect(filletOutline(o, 12).authoring).toEqual({ kind: 'pen' });
  });

  // Each fillet adds a vertex. Past the model ceiling the outline fails
  // validation and Apply is blocked with no way out but undoing the radius.
  it('stops filleting before the vertex ceiling rather than blocking apply', () => {
    // 200 corners on a circle whose edges are long enough, and a radius small
    // enough, that every corner is genuinely eligible — a tighter polygon puts
    // the setback under MIN_RADIUS_MM and nothing rounds, which would make this
    // pass while exercising none of the budget.
    const n = 200;
    const cx = W / 2;
    const cy = D / 2;
    const r = Math.min(W, D) / 2 - 1;
    const many: DrawerOutline = {
      vertices: Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      }),
    };
    // Sanity: unbudgeted this geometry really does round every corner.
    const edge = Math.hypot(
      many.vertices[1].x - many.vertices[0].x,
      many.vertices[1].y - many.vertices[0].y
    );
    const filleted = filletOutline(many, edge);

    // 200 + 56 available = 256, so the budget must stop it exactly at the cap.
    expect(filleted.vertices).toHaveLength(256);
    expect(filleted.vertices.filter((v) => (v.bulge ?? 0) !== 0)).toHaveLength(56);
    expect(validateOutline(filleted, W, D, U)).toBeNull();
  });

  // The rest of the outline geometry treats |bulge| < BULGE_EPS as straight, so
  // a corner they consider straight has to be filletable here too.
  it('treats a sub-epsilon bulge as straight', () => {
    const almost: DrawerOutline = {
      vertices: rect().vertices.map((v, i) => (i === 0 ? { ...v, bulge: 1e-12 } : v)),
    };
    // All four corners round, as they would with the bulge absent entirely.
    expect(filletOutline(almost, 20).vertices.filter((v) => (v.bulge ?? 0) !== 0)).toHaveLength(4);
  });

  describe('per-corner radii', () => {
    it('rounds only the corners the array gives a radius', () => {
      const filleted = filletOutline(rect(), [20, 0, 20, 0]);
      expect(filleted.vertices).toHaveLength(6);
      expect(filleted.vertices.filter((v) => (v.bulge ?? 0) !== 0)).toHaveLength(2);
    });

    it('gives each corner its own radius', () => {
      const filleted = filletOutline(rect(), [10, 30, 0, 0]);
      const radii = filleted.vertices
        .map((v, i) =>
          arcGeometry(v, filleted.vertices[(i + 1) % filleted.vertices.length], v.bulge ?? 0)
        )
        .filter((a) => a !== null)
        .map((a) => a.r);
      expect(radii).toHaveLength(2);
      expect(radii[0]).toBeCloseTo(10, 6);
      expect(radii[1]).toBeCloseTo(30, 6);
    });

    it('leaves the outline untouched when every radius is zero', () => {
      const o = rect();
      expect(filletOutline(o, [0, 0, 0, 0])).toBe(o);
    });

    it('treats a short array as zero for the corners it does not reach', () => {
      const filleted = filletOutline(rect(), [20]);
      expect(filleted.vertices.filter((v) => (v.bulge ?? 0) !== 0)).toHaveLength(1);
    });
  });
});

/** Assert two vertex lists describe the same corners, ignoring where the loop starts. */
function expectSameCorners(actual: DrawerOutline['vertices'], expected: DrawerOutline['vertices']) {
  expect(actual).toHaveLength(expected.length);
  const offset = actual.findIndex(
    (v) => Math.abs(v.x - expected[0].x) < 1e-6 && Math.abs(v.y - expected[0].y) < 1e-6
  );
  expect(offset).toBeGreaterThanOrEqual(0);
  for (let i = 0; i < expected.length; i++) {
    const v = actual[(offset + i) % actual.length];
    expect(v.x).toBeCloseTo(expected[i].x, 6);
    expect(v.y).toBeCloseTo(expected[i].y, 6);
  }
}

describe('unfilletOutline', () => {
  it('returns an unrounded outline as drawn, with no radii', () => {
    const o = rect();
    const { vertices, radii } = unfilletOutline(o);
    expect(vertices).toEqual(o.vertices);
    expect(radii).toEqual([0, 0, 0, 0]);
  });

  it('recovers the corners and the radius a uniform fillet was built from', () => {
    const original = rect();
    const { vertices, radii } = unfilletOutline(filletOutline(original, 20));
    expectSameCorners(vertices, original.vertices);
    expect(radii.every((r) => Math.abs(r - 20) < 1e-6)).toBe(true);
  });

  it('recovers per-corner radii, including a concave one', () => {
    const original = lShape();
    const asked = [10, 25, 0, 15, 0, 20];
    const { vertices, radii } = unfilletOutline(filletOutline(original, asked));
    expectSameCorners(vertices, original.vertices);
    const offset = vertices.findIndex(
      (v) => Math.abs(v.x - original.vertices[0].x) < 1e-6 && Math.abs(v.y) < 1e-6
    );
    for (let i = 0; i < asked.length; i++) {
      expect(radii[(offset + i) % radii.length]).toBeCloseTo(asked[i], 6);
    }
  });

  // The pen editor seeds from a stored outline, which has been quantized to
  // 0.01mm — an exact tangency test would find no fillets at all after a save.
  it('still recognises a fillet after the outline is quantized', () => {
    const original = rect();
    const stored = quantizeOutline(filletOutline(original, 17.5));
    const { vertices, radii } = unfilletOutline(stored);
    expect(vertices).toHaveLength(4);
    for (const r of radii) expect(r).toBeCloseTo(17.5, 1);
  });

  // The setback cap can clip a radius well below the one asked for. Reporting
  // the request would show a number the shape does not have.
  it('reports the radius that was applied, not the one requested', () => {
    const { radii } = unfilletOutline(filletOutline(rect(), 10_000));
    // 0.49 of the shorter (D = 252mm) edge, which a 90 degree turn sets back 1:1.
    const capped = D * 0.49;
    expect(radii).toHaveLength(4);
    for (const r of radii) expect(r).toBeCloseTo(capped, 6);
  });

  it('leaves a hand-drawn arc alone rather than reading it as a fillet', () => {
    // The bowed segment is not tangent to its neighbours, so collapsing it
    // would move geometry the user drew on purpose.
    const drawn: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: W, y: 0, bulge: 0.4 },
        { x: W, y: D },
        { x: 0, y: D },
      ],
    };
    const { vertices, radii } = unfilletOutline(drawn);
    expect(vertices).toEqual(drawn.vertices);
    expect(radii).toEqual([0, 0, 0, 0]);
  });

  it('round-trips back to the same geometry', () => {
    const filleted = filletOutline(lShape(), [12, 12, 0, 12, 0, 12]);
    const { vertices, radii } = unfilletOutline(filleted);
    const again = filletOutline({ vertices }, radii);
    expect(again.vertices).toHaveLength(filleted.vertices.length);
    expectSameCorners(again.vertices, filleted.vertices);
  });

  it('keeps a fillet that wraps the end of the vertex array', () => {
    // Rotating the loop puts one fillet's two vertices across index 0, which a
    // non-cyclic scan would miss.
    const filleted = filletOutline(rect(), 20);
    const rotated: DrawerOutline = {
      vertices: [...filleted.vertices.slice(-1), ...filleted.vertices.slice(0, -1)],
    };
    expect(unfilletOutline(rotated).vertices).toHaveLength(4);
  });
});
