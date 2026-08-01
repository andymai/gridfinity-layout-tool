import { describe, it, expect } from 'vitest';
import { outlineSignedArea } from '@/shared/utils/drawerOutlineGeometry';
import { fitLoop, largestLoop, loopBounds } from './fitLoop';
import type { ImportedLoop } from './types';

const U = 42;
const DRAWER_W = 10 * U; // 420mm
const DRAWER_D = 8 * U; // 336mm

/** CCW rectangle of the given size, anchored well away from the origin. */
function rectLoop(w: number, d: number, x = 1000, y = -500): ImportedLoop {
  return {
    vertices: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + d },
      { x, y: y + d },
    ],
  };
}

const fit = (loop: ImportedLoop, scaleToFit = false) =>
  fitLoop(loop, DRAWER_W, DRAWER_D, U, U, scaleToFit);

describe('loopBounds', () => {
  // An arc bulges past its own endpoints. A box measured from the vertices
  // alone would call a curved edge inside the drawer when it is not.
  it('measures the arc, not just the vertices', () => {
    // Positive bulge bows right of travel, so the bottom edge dips below y = 0
    // by its sagitta (bulge × chord / 2 = 25mm) and the loop is 75mm deep.
    const bowed: ImportedLoop = {
      vertices: [
        { x: 0, y: 0, bulge: 0.5 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
        { x: 0, y: 50 },
      ],
    };
    const b = loopBounds(bowed.vertices);
    expect(b.depthMm).toBeCloseTo(75, 1);
    expect(b.minY).toBeCloseTo(-25, 1);
  });
});

describe('largestLoop', () => {
  it('picks the perimeter over the detail inside it', () => {
    const chosen = largestLoop([rectLoop(20, 20), rectLoop(200, 100), rectLoop(5, 5)]);
    expect(loopBounds(chosen?.vertices ?? []).widthMm).toBe(200);
  });

  it('returns null when nothing encloses area', () => {
    expect(largestLoop([])).toBeNull();
    expect(largestLoop([{ vertices: [{ x: 0, y: 0 }] }])).toBeNull();
  });
});

describe('fitLoop', () => {
  it('centres the loop in the drawer at its measured size', () => {
    const r = fit(rectLoop(200, 100));
    expect(r.scale).toBe(1);
    const b = loopBounds(r.vertices);
    expect(b.widthMm).toBeCloseTo(200, 6);
    expect(b.depthMm).toBeCloseTo(100, 6);
    // Equal margin on both sides of each axis.
    expect(b.minX).toBeCloseTo((DRAWER_W - 200) / 2, 6);
    expect(b.minY).toBeCloseTo((DRAWER_D - 100) / 2, 6);
  });

  // Everything downstream assumes a CCW loop; a CAD file has no such rule.
  it('winds the loop counter-clockwise whichever way it was drawn', () => {
    const cw: ImportedLoop = { vertices: [...rectLoop(200, 100).vertices].reverse() };
    expect(outlineSignedArea({ vertices: fit(cw).vertices })).toBeGreaterThan(0);
  });

  it('keeps a bowed edge bowing the same way after rewinding', () => {
    const ccw: ImportedLoop = {
      vertices: [
        { x: 0, y: 0, bulge: 0.4 },
        { x: 200, y: 0 },
        { x: 200, y: 100 },
        { x: 0, y: 100 },
      ],
    };
    // The same bottom edge, traversed the other way: it now leaves (200, 0),
    // and the bulge flips sign to keep the bow on the same physical side.
    const cw: ImportedLoop = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 0, bulge: -0.4 },
      ],
    };
    // Same shape drawn both ways lands on the same area, bow included.
    expect(outlineSignedArea({ vertices: fit(cw).vertices })).toBeCloseTo(
      outlineSignedArea({ vertices: fit(ccw).vertices }),
      6
    );
  });

  // True scale is the whole point of importing from CAD, so an oversized loop
  // is reported rather than quietly shrunk.
  it('leaves an oversized loop at true scale unless asked to fit', () => {
    const r = fit(rectLoop(900, 400));
    expect(r.scale).toBe(1);
    expect(r.sourceWidthMm).toBe(900);
    expect(loopBounds(r.vertices).widthMm).toBeCloseTo(900, 6);
  });

  it('scales an oversized loop down uniformly when asked', () => {
    const r = fit(rectLoop(900, 400), true);
    expect(r.scale).toBeCloseTo(DRAWER_W / 900, 6);
    const b = loopBounds(r.vertices);
    expect(b.widthMm).toBeLessThanOrEqual(DRAWER_W + 1e-6);
    expect(b.depthMm).toBeLessThanOrEqual(DRAWER_D + 1e-6);
    // Uniform, so the aspect ratio is untouched.
    expect(b.widthMm / b.depthMm).toBeCloseTo(900 / 400, 6);
  });

  it('never scales a loop UP to fill the drawer', () => {
    expect(fit(rectLoop(50, 25), true).scale).toBe(1);
  });

  it('reports the drawer size the loop needs, rounded to a half unit', () => {
    // 430mm needs 10.5 units at a 42mm pitch (10 units is 420mm).
    const r = fit(rectLoop(430, 100));
    expect(r.requiredWidthUnits).toBe(10.5);
    expect(r.requiredDepthUnits).toBe(2.5);
  });
});
