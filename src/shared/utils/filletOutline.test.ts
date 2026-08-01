import { describe, it, expect } from 'vitest';
import type { DrawerOutline } from '@/core/types';
import { filletOutline } from './filletOutline';
import { validateOutline } from './drawerOutline';
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
});
