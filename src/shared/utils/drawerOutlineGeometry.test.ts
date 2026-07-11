import { describe, expect, it } from 'vitest';

import type { DrawerOutline } from '@/core/types';
import {
  arcGeometry,
  arcPointAt,
  classifyRect,
  flattenOutline,
  insideAreaFraction,
  isFootprintInsideOutline,
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
});
