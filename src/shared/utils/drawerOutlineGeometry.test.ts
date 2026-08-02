import { describe, expect, it } from 'vitest';

import type { DrawerOutline } from '@/core/types';
import type { OutlineLatticeFrame } from './drawerOutlineGeometry';
import {
  arcGeometry,
  arcPointAt,
  classifyRect,
  flattenOutline,
  insideAreaFraction,
  isFootprintInsideOutline,
  outlineBounds,
  outlineLatticeShift,
  outlineSignedArea,
  pointInOutline,
} from './drawerOutlineGeometry';

const U = 42;

/** 4×4-unit drawer with the top-right 2×2 cells notched out (L-shape). */
const L_SHAPE: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

/** 4×4-unit drawer with the top-right corner chamfered along the diagonal. */
const CHAMFER: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 2 * U },
    { x: 2 * U, y: 4 * U },
    { x: 0, y: 4 * U },
  ],
};

/** 4×4-unit drawer whose back edge bows inward as a circular arc.
 * Traveling −x along the back edge, a negative bulge bows left = into the
 * drawer (DXF: positive bulge bows right of travel). */
const CURVED_BACK: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 4 * U, bulge: -0.25 },
    { x: 0, y: 4 * U },
  ],
};

describe('arcGeometry', () => {
  it('computes a semicircle from bulge 1, bowing right of travel', () => {
    const arc = arcGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, 1);
    expect(arc).not.toBeNull();
    expect(arc?.r).toBeCloseTo(5);
    expect(arc?.cx).toBeCloseTo(5);
    expect(arc?.cy).toBeCloseTo(0);
    expect(arc?.sweep).toBeCloseTo(Math.PI);
    const apex = arcPointAt(arc as NonNullable<typeof arc>, 0.5);
    expect(apex.x).toBeCloseTo(5);
    expect(apex.y).toBeCloseTo(-5);
  });

  it('bulge sign flips the arc side', () => {
    const arc = arcGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, -1);
    const apex = arcPointAt(arc as NonNullable<typeof arc>, 0.5);
    expect(apex.y).toBeCloseTo(5);
  });

  it('lands on the end point for non-semicircle bulges', () => {
    for (const bulge of [0.5, -0.5, 0.25, -0.8]) {
      const arc = arcGeometry({ x: 2, y: 3 }, { x: 12, y: 7 }, bulge);
      const end = arcPointAt(arc as NonNullable<typeof arc>, 1);
      expect(end.x).toBeCloseTo(12);
      expect(end.y).toBeCloseTo(7);
      const start = arcPointAt(arc as NonNullable<typeof arc>, 0);
      expect(start.x).toBeCloseTo(2);
      expect(start.y).toBeCloseTo(3);
    }
  });

  it('returns null for straight and degenerate segments', () => {
    expect(arcGeometry({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toBeNull();
    expect(arcGeometry({ x: 3, y: 3 }, { x: 3, y: 3 }, 0.5)).toBeNull();
  });
});

describe('flattenOutline', () => {
  it('keeps straight outlines as their vertices', () => {
    expect(flattenOutline(L_SHAPE)).toHaveLength(6);
  });

  it('subdivides arcs within chord tolerance and memoizes on reference', () => {
    const pts = flattenOutline(CURVED_BACK);
    expect(pts.length).toBeGreaterThan(4);
    expect(flattenOutline(CURVED_BACK)).toBe(pts);
    const arc = arcGeometry(
      CURVED_BACK.vertices[2],
      CURVED_BACK.vertices[3],
      CURVED_BACK.vertices[2].bulge as number
    );
    const a = arc as NonNullable<typeof arc>;
    const originals = new Set(CURVED_BACK.vertices.map((v) => `${v.x},${v.y}`));
    const subdivided = pts.filter((p) => !originals.has(`${p.x},${p.y}`));
    expect(subdivided.length).toBeGreaterThan(0);
    for (const p of subdivided) {
      expect(Math.hypot(p.x - a.cx, p.y - a.cy)).toBeCloseTo(a.r, 5);
    }
  });
});

describe('outlineSignedArea', () => {
  it('is positive for CCW loops and matches known areas', () => {
    expect(outlineSignedArea(L_SHAPE)).toBeCloseTo(16 * U * U - 4 * U * U);
    expect(outlineSignedArea(CHAMFER)).toBeCloseTo(16 * U * U - 2 * U * U);
  });
});

describe('pointInOutline', () => {
  it('distinguishes body from notch', () => {
    expect(pointInOutline(L_SHAPE, U, U)).toBe(true);
    expect(pointInOutline(L_SHAPE, 3 * U, 3 * U)).toBe(false);
    expect(pointInOutline(L_SHAPE, 5 * U, U)).toBe(false);
  });
});

describe('classifyRect', () => {
  const cell = (cx: number, cy: number): [number, number, number, number] => [
    cx * U,
    cy * U,
    (cx + 1) * U,
    (cy + 1) * U,
  ];

  it('classifies L-shape cells inside/outside', () => {
    expect(classifyRect(L_SHAPE, ...cell(0, 0))).toBe('inside');
    expect(classifyRect(L_SHAPE, ...cell(3, 1))).toBe('inside');
    expect(classifyRect(L_SHAPE, ...cell(2, 2))).toBe('outside');
    expect(classifyRect(L_SHAPE, ...cell(3, 3))).toBe('outside');
  });

  it('treats boundary-on-gridline cells as fully covered, not partial', () => {
    // The notch edges lie exactly on grid lines: the abutting body cells must
    // classify 'inside' so rectilinear shapes get full pockets everywhere.
    expect(classifyRect(L_SHAPE, ...cell(1, 2))).toBe('inside');
    expect(classifyRect(L_SHAPE, ...cell(3, 1))).toBe('inside');
    expect(classifyRect(L_SHAPE, ...cell(1, 3))).toBe('inside');
  });

  it('marks diagonal-crossed cells partial', () => {
    expect(classifyRect(CHAMFER, ...cell(3, 2))).toBe('partial');
    expect(classifyRect(CHAMFER, ...cell(2, 3))).toBe('partial');
    expect(classifyRect(CHAMFER, ...cell(3, 3))).toBe('outside');
    expect(classifyRect(CHAMFER, ...cell(0, 0))).toBe('inside');
  });

  it('marks arc-crossed cells partial', () => {
    expect(classifyRect(CURVED_BACK, ...cell(1, 3))).toBe('partial');
    expect(classifyRect(CURVED_BACK, ...cell(1, 0))).toBe('inside');
  });

  it('classifies a rect that fully contains the outline as partial', () => {
    expect(classifyRect(L_SHAPE, -U, -U, 10 * U, 10 * U)).toBe('partial');
  });
});

describe('insideAreaFraction', () => {
  it('is 1 inside, 0 in the notch, ~0.5 on the diagonal', () => {
    expect(insideAreaFraction(L_SHAPE, 0, 0, U, U)).toBe(1);
    expect(insideAreaFraction(L_SHAPE, 3 * U, 3 * U, 4 * U, 4 * U)).toBe(0);
    const diag = insideAreaFraction(CHAMFER, 3 * U, 2 * U, 4 * U, 3 * U);
    expect(diag).toBeGreaterThan(0.25);
    expect(diag).toBeLessThan(0.75);
  });
});

describe('isFootprintInsideOutline', () => {
  it('accepts boundary-flush footprints and rejects notch overlap', () => {
    expect(isFootprintInsideOutline({ x: 0, y: 0, width: 2, depth: 4 }, L_SHAPE, U)).toBe(true);
    expect(isFootprintInsideOutline({ x: 0, y: 0, width: 4, depth: 2 }, L_SHAPE, U)).toBe(true);
    expect(isFootprintInsideOutline({ x: 1, y: 1, width: 2, depth: 2 }, L_SHAPE, U)).toBe(false);
    expect(isFootprintInsideOutline({ x: 2, y: 2, width: 1, depth: 1 }, L_SHAPE, U)).toBe(false);
  });

  it('supports half-grid footprints', () => {
    expect(isFootprintInsideOutline({ x: 1.5, y: 1.5, width: 0.5, depth: 0.5 }, L_SHAPE, U)).toBe(
      true
    );
    expect(isFootprintInsideOutline({ x: 1.5, y: 1.5, width: 1, depth: 1 }, L_SHAPE, U)).toBe(
      false
    );
  });

  it('scales footprints by the per-axis pitch on a non-square grid (#2733)', () => {
    const UX = 48;
    const UY = 42;
    const lNs: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * UX, y: 0 },
        { x: 4 * UX, y: 2 * UY },
        { x: 2 * UX, y: 2 * UY },
        { x: 2 * UX, y: 4 * UY },
        { x: 0, y: 4 * UY },
      ],
    };
    // Back-flush in the tall body: y ends exactly at the drawer's back edge
    // (4 × UY) — using the X pitch on Y would push it out of the outline.
    expect(isFootprintInsideOutline({ x: 0, y: 2, width: 2, depth: 2 }, lNs, UX, UY)).toBe(true);
    expect(isFootprintInsideOutline({ x: 2, y: 0, width: 2, depth: 2 }, lNs, UX, UY)).toBe(true);
    expect(isFootprintInsideOutline({ x: 2, y: 2, width: 1, depth: 1 }, lNs, UX, UY)).toBe(false);
  });
});

describe('outlineBounds', () => {
  it('measures the flattened extent, including an arc that bows past its endpoints', () => {
    // The back edge (segment leaving [4U,4U] toward [0,4U]) bows outward: positive
    // bulge sweeps right of −x travel, i.e. up, pushing maxY past the vertex row.
    const bowed: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U, bulge: 0.4 },
        { x: 0, y: 4 * U },
      ],
    };
    const b = outlineBounds(bowed);
    expect(b.minX).toBeCloseTo(0, 6);
    expect(b.maxX).toBeCloseTo(4 * U, 6);
    expect(b.minY).toBeCloseTo(0, 6);
    // The arc pushes maxY past the vertex row at 4U.
    expect(b.maxY).toBeGreaterThan(4 * U);
  });
});

describe('outlineLatticeShift', () => {
  /** Zero-padding frame over a widthU×depthU drawer. */
  const frame = (widthU: number, depthU: number, pitchX = U, pitchY = U): OutlineLatticeFrame => ({
    x: { extentMm: widthU * pitchX, originMm: 0, pitchMm: pitchX, wholeCells: Math.floor(widthU) },
    y: { extentMm: depthU * pitchY, originMm: 0, pitchMm: pitchY, wholeCells: Math.floor(depthU) },
  });

  it('is zero when the outline fills the extent', () => {
    const full: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const shift = outlineLatticeShift(full, frame(4, 4));
    expect(shift.x).toBe(0);
    expect(shift.y).toBe(0);
  });

  it('keeps a half-unit-slack corner outline in place — registration beats centring (#3149)', () => {
    // The #3149 auto-grow shape: 8.25×7.04 units on a 48×42 pitch, grown to an
    // 8.5×7.5 drawer. The only position holding 8×7 whole cells is the corner
    // anchor; a bbox-centring shift (+6, +9.75) would lose a column and a row.
    const grown: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 396, y: 0 },
        { x: 396, y: 295.5 },
        { x: 0, y: 295.5 },
      ],
    };
    const shift = outlineLatticeShift(grown, frame(8.5, 7.5, 48, 42));
    expect(shift.x).toBe(0);
    expect(shift.y).toBe(0);
  });

  it('centres a whole-unit-drifted outline by whole cells only', () => {
    // 6u-wide rectangle stuck in the right two thirds of a 9u extent: any
    // whole-unit shift keeps all 6 cells, so centring picks the least move
    // that lands nearest the extent centre.
    const drifted: DrawerOutline = {
      vertices: [
        { x: 3 * U, y: 0 },
        { x: 9 * U, y: 0 },
        { x: 9 * U, y: 4 * U },
        { x: 3 * U, y: 4 * U },
      ],
    };
    const shift = outlineLatticeShift(drifted, frame(9, 4));
    expect(shift.x).toBe(-U);
    expect(shift.y).toBe(0);
  });

  it('registers the cell block to the padded lattice origin', () => {
    // 3u square at the corner of a 4u drawer with 10mm padding all round:
    // whole cells start at x=10, so the registered shifts land on 10+k·U.
    const square: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 3 * U, y: 0 },
        { x: 3 * U, y: 3 * U },
        { x: 0, y: 3 * U },
      ],
    };
    const shift = outlineLatticeShift(square, {
      x: { extentMm: 4 * U + 20, originMm: 10, pitchMm: U, wholeCells: 4 },
      y: { extentMm: 4 * U + 20, originMm: 10, pitchMm: U, wholeCells: 4 },
    });
    // Candidate registrations are 10 (k=0) and 52 (k=1), equally centred;
    // the smaller move wins.
    expect(shift.x).toBe(10);
    expect(shift.y).toBe(10);
  });

  it('falls back to clamped bbox centring when no whole cell fits', () => {
    // A sliver thinner than a cell has no registration to preserve.
    const sliver: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 0.8 * U, y: 0 },
        { x: 0.8 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const shift = outlineLatticeShift(sliver, frame(4, 4));
    expect(shift.x).toBeCloseTo(1.6 * U, 6);
    expect(shift.y).toBe(0);
  });
});
