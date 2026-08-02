import { describe, expect, it } from 'vitest';

import type { DrawerOutline, Layout } from '@/core/types';
import { gridUnits, mm } from '@/core/types';
import { createTestLayout } from '@/test/testUtils';
import {
  canonicalStartOutline,
  hashOutline,
  normalizeDrawerOutline,
  OUTLINE_MAX_VERTICES,
  quantizeOutline,
  resizeDrawerOutline,
  rotateOutline180,
  snapOutlineToBounds,
  translateOutline,
  validateOutline,
} from './drawerOutline';
import { outlineSignedArea } from './drawerOutlineGeometry';

const U = 42;

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

const CURVED_BACK: DrawerOutline = {
  vertices: [
    { x: 0, y: 0 },
    { x: 4 * U, y: 0 },
    { x: 4 * U, y: 4 * U, bulge: -0.25 },
    { x: 0, y: 4 * U },
  ],
};

describe('validateOutline', () => {
  it('accepts valid shapes', () => {
    expect(validateOutline(L_SHAPE, 4 * U, 4 * U, U)).toBeNull();
    expect(validateOutline(CURVED_BACK, 4 * U, 4 * U, U)).toBeNull();
  });

  it('rejects too few and too many vertices', () => {
    expect(
      validateOutline(
        {
          vertices: [
            { x: 0, y: 0 },
            { x: U, y: 0 },
          ],
        },
        U,
        U,
        U
      )?.kind
    ).toBe('too_few_vertices');
    const many: DrawerOutline = {
      vertices: Array.from({ length: OUTLINE_MAX_VERTICES + 1 }, (_, i) => ({
        x: Math.cos((i / (OUTLINE_MAX_VERTICES + 1)) * 2 * Math.PI) * U + 2 * U,
        y: Math.sin((i / (OUTLINE_MAX_VERTICES + 1)) * 2 * Math.PI) * U + 2 * U,
      })),
    };
    expect(validateOutline(many, 4 * U, 4 * U, U)?.kind).toBe('too_many_vertices');
  });

  it('rejects non-finite coordinates and out-of-range bulges', () => {
    expect(
      validateOutline(
        {
          vertices: [
            { x: 0, y: 0 },
            { x: NaN, y: 0 },
            { x: U, y: U },
          ],
        },
        4 * U,
        4 * U,
        U
      )?.kind
    ).toBe('non_finite');
    expect(
      validateOutline(
        {
          vertices: [
            { x: 0, y: 0, bulge: 2 },
            { x: 4 * U, y: 0 },
            { x: 0, y: 4 * U },
          ],
        },
        4 * U,
        4 * U,
        U
      )?.kind
    ).toBe('bad_bulge');
  });

  it('rejects coincident consecutive vertices', () => {
    expect(
      validateOutline(
        {
          vertices: [
            { x: 0, y: 0 },
            { x: 0, y: 0.0001 },
            { x: 4 * U, y: 0 },
            { x: 0, y: 4 * U },
          ],
        },
        4 * U,
        4 * U,
        U
      )?.kind
    ).toBe('degenerate_segment');
  });

  it('rejects outlines leaving the drawer extent, including arc bellies', () => {
    expect(
      validateOutline(
        {
          vertices: [
            { x: 0, y: 0 },
            { x: 5 * U, y: 0 },
            { x: 0, y: 4 * U },
          ],
        },
        4 * U,
        4 * U,
        U
      )?.kind
    ).toBe('out_of_bounds');
    // Endpoints in-bounds but the arc bellies below the bbox (positive bulge
    // bows right of +x travel = downward).
    expect(
      validateOutline(
        {
          vertices: [
            { x: 0, y: 0, bulge: 0.5 },
            { x: 4 * U, y: 0 },
            { x: 4 * U, y: 4 * U },
            { x: 0, y: 4 * U },
          ],
        },
        4 * U,
        4 * U,
        U
      )?.kind
    ).toBe('out_of_bounds');
  });

  it('rejects clockwise winding', () => {
    const cw: DrawerOutline = { vertices: [...L_SHAPE.vertices].reverse() };
    expect(validateOutline(cw, 4 * U, 4 * U, U)?.kind).toBe('not_ccw');
  });

  it('rejects self-intersection', () => {
    const bowtie: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 4 * U, y: 0 },
        { x: 0, y: 4 * U },
      ],
    };
    expect(validateOutline(bowtie, 4 * U, 4 * U, U)?.kind).toBe('self_intersecting');
  });

  it('rejects areas below one grid cell', () => {
    const tiny: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: U / 2, y: 0 },
        { x: U / 2, y: U },
      ],
    };
    expect(validateOutline(tiny, 4 * U, 4 * U, U)?.kind).toBe('too_small');
  });

  it('sizes the one-cell minimum by both pitches (#2733)', () => {
    const cell: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 48, y: 0 },
        { x: 48, y: 42 },
        { x: 0, y: 42 },
      ],
    };
    // One true cell (48 × 42 = 2016mm²) passes; the square-pitch rule
    // (48² = 2304mm²) would wrongly reject it.
    expect(validateOutline(cell, 4 * 48, 4 * 42, 48, 42)).toBeNull();
    expect(validateOutline(cell, 4 * 48, 4 * 42, 48)?.kind).toBe('too_small');
  });
});

describe('quantize and snap', () => {
  it('quantizes coordinates to 0.01mm', () => {
    const q = quantizeOutline({
      vertices: [
        { x: 0.004, y: 0.006 },
        { x: 41.999, y: 0 },
        { x: 0, y: 42.0049 },
      ],
    });
    expect(q.vertices[0]).toEqual({ x: 0, y: 0.01 });
    expect(q.vertices[1].x).toBeCloseTo(42, 5);
    expect(q.vertices[2].y).toBeCloseTo(42, 5);
  });

  it('snaps near-boundary vertices onto the bbox', () => {
    const s = snapOutlineToBounds(
      {
        vertices: [
          { x: 0.03, y: -0.02 },
          { x: 4 * U - 0.04, y: 0 },
          { x: 0, y: 4 * U + 0.01 },
        ],
      },
      4 * U,
      4 * U
    );
    expect(s.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(s.vertices[1].x).toBe(4 * U);
    expect(s.vertices[2].y).toBe(4 * U);
  });
});

describe('transforms', () => {
  it('translates vertices and preserves bulges', () => {
    const t = translateOutline(CURVED_BACK, 10, -5);
    expect(t.vertices[1]).toEqual({ x: 4 * U + 10, y: -5 });
    expect(t.vertices[2].bulge).toBe(-0.25);
  });

  it('rotateOutline180 twice is the identity and preserves winding', () => {
    const once = rotateOutline180(L_SHAPE, 4 * U, 4 * U);
    expect(outlineSignedArea(once)).toBeCloseTo(outlineSignedArea(L_SHAPE));
    const twice = rotateOutline180(once, 4 * U, 4 * U);
    expect(twice.vertices).toEqual(L_SHAPE.vertices);
  });
});

describe('hashOutline', () => {
  it('is stable under sub-quantum jitter and geometry-only', () => {
    const jittered: DrawerOutline = {
      vertices: L_SHAPE.vertices.map((v) => ({ x: v.x + 0.002, y: v.y - 0.002 })),
      authoring: { kind: 'cells' },
    };
    expect(hashOutline(jittered)).toBe(hashOutline(L_SHAPE));
  });

  it('differs for different shapes', () => {
    expect(hashOutline(L_SHAPE)).not.toBe(hashOutline(CURVED_BACK));
    const shifted: DrawerOutline = {
      vertices: L_SHAPE.vertices.map((v) => ({ x: v.x + U, y: v.y })),
    };
    expect(hashOutline(shifted)).not.toBe(hashOutline(L_SHAPE));
  });
});

describe('canonicalStartOutline', () => {
  /** A rectangle chamfered at BL and TR — point-symmetric about its center. */
  const SYM_CHAMFER: DrawerOutline = {
    vertices: [
      { x: U, y: 0 },
      { x: 4 * U, y: 0 },
      { x: 4 * U, y: 3 * U },
      { x: 3 * U, y: 4 * U },
      { x: 0, y: 4 * U },
      { x: 0, y: U },
    ],
  };

  /** Rotate the vertex list by `k` — same polygon, different starting vertex. */
  const rotateStart = (outline: DrawerOutline, k: number): DrawerOutline => ({
    vertices: [...outline.vertices.slice(k), ...outline.vertices.slice(0, k)],
  });

  it('is invariant to the starting vertex (cyclic shift)', () => {
    const base = canonicalStartOutline(SYM_CHAMFER);
    for (let k = 1; k < SYM_CHAMFER.vertices.length; k++) {
      expect(canonicalStartOutline(rotateStart(SYM_CHAMFER, k)).vertices).toEqual(base.vertices);
      expect(hashOutline(canonicalStartOutline(rotateStart(SYM_CHAMFER, k)))).toBe(
        hashOutline(base)
      );
    }
  });

  it('collapses a point-symmetric outline and its 180° rotation to one hash', () => {
    const rotated = rotateOutline180(SYM_CHAMFER, 4 * U, 4 * U);
    // The 180° rotation of a point-symmetric loop is the same polygon shifted by
    // n/2, so canonical-start hashes match even though raw hashes need not.
    expect(hashOutline(canonicalStartOutline(rotated))).toBe(
      hashOutline(canonicalStartOutline(SYM_CHAMFER))
    );
  });

  it('keeps an asymmetric outline distinct from its 180° rotation', () => {
    const rotated = rotateOutline180(L_SHAPE, 4 * U, 4 * U);
    expect(hashOutline(canonicalStartOutline(rotated))).not.toBe(
      hashOutline(canonicalStartOutline(L_SHAPE))
    );
  });

  it('preserves winding and bulge association', () => {
    const canon = canonicalStartOutline(CURVED_BACK);
    expect(outlineSignedArea(canon)).toBeCloseTo(outlineSignedArea(CURVED_BACK));
  });
});

describe('resizeDrawerOutline', () => {
  it('returns the same outline when dims are unchanged', () => {
    expect(resizeDrawerOutline(L_SHAPE, 4 * U, 4 * U, 4 * U, 4 * U, U)).toBe(L_SHAPE);
  });

  it('crops on shrink, preserving the notch', () => {
    const shrunk = resizeDrawerOutline(L_SHAPE, 4 * U, 4 * U, 3 * U, 4 * U, U);
    expect(shrunk).toBeDefined();
    const o = shrunk as DrawerOutline;
    expect(validateOutline(o, 3 * U, 4 * U, U)).toBeNull();
    expect(outlineSignedArea(o)).toBeCloseTo(3 * 4 * U * U - 1 * 2 * U * U);
  });

  it('resets to rectangle when the shrink consumes the notch', () => {
    expect(resizeDrawerOutline(L_SHAPE, 4 * U, 4 * U, 2 * U, 4 * U, U)).toBeUndefined();
  });

  it('extends across a grown edge with the new area inside', () => {
    const grown = resizeDrawerOutline(L_SHAPE, 4 * U, 4 * U, 5 * U, 4 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 5 * U, 4 * U, U)).toBeNull();
    expect(outlineSignedArea(o)).toBeCloseTo(16 * U * U - 4 * U * U + 4 * U * U);
  });

  it('grows both axes sequentially', () => {
    // Notch at the bottom-right, away from both grown edges.
    const bottomNotch: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 2 * U, y: 0 },
        { x: 2 * U, y: 2 * U },
        { x: 4 * U, y: 2 * U },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const grown = resizeDrawerOutline(bottomNotch, 4 * U, 4 * U, 5 * U, 5 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 5 * U, 5 * U, U)).toBeNull();
    // L area + right strip (1×4) + top strip (5×1).
    expect(outlineSignedArea(o)).toBeCloseTo((12 + 4 + 5) * U * U);
  });

  it('grows depth past an edge-touching notch, keeping it open', () => {
    const grown = resizeDrawerOutline(L_SHAPE, 4 * U, 4 * U, 4 * U, 5 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 4 * U, 5 * U, U)).toBeNull();
    // L area + top strip over the body only (the notch mouth stays open at
    // the right drawer edge — no hole).
    expect(outlineSignedArea(o)).toBeCloseTo((12 + 4) * U * U);
  });

  it('keeps the shape when a second-axis growth cannot weld (welds the first, notch stays open)', () => {
    // Width growth welds a strip along the notch's right side; the later depth
    // growth would then span two separate top runs, so it welds nothing and the
    // width-grown shape is kept rather than discarded (#3114).
    const grown = resizeDrawerOutline(L_SHAPE, 4 * U, 4 * U, 5 * U, 5 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 5 * U, 5 * U, U)).toBeNull();
    // L area (12) + welded right strip (1×4); the top stays open (unwelded).
    expect(outlineSignedArea(o)).toBeCloseTo((12 + 4) * U * U);
  });

  it('keeps an off-edge outline when growing (the grid enlarges around it)', () => {
    // An L inset from the 4-wide drawer's right edge: growing to 5 wide welds
    // nothing (no run flush with the old edge), so it is kept unchanged, now
    // offset within the larger grid (#3114).
    const inset: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 3 * U, y: 0 },
        { x: 3 * U, y: 2 * U },
        { x: U, y: 2 * U },
        { x: U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const grown = resizeDrawerOutline(inset, 4 * U, 4 * U, 5 * U, 4 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 5 * U, 4 * U, U)).toBeNull();
    expect(o.vertices).toEqual(inset.vertices);
  });

  it('keeps a right-notched outline when growing past its two-run edge', () => {
    // The notch cuts the old right edge into two runs; welding both would trap a
    // hole. Growing instead keeps the shape, the notch now interior to the
    // larger grid (#3114).
    const sideNotch: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: U },
        { x: 2 * U, y: U },
        { x: 2 * U, y: 3 * U },
        { x: 4 * U, y: 3 * U },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    expect(validateOutline(sideNotch, 4 * U, 4 * U, U)).toBeNull();
    const grown = resizeDrawerOutline(sideNotch, 4 * U, 4 * U, 5 * U, 4 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 5 * U, 4 * U, U)).toBeNull();
    // Full 4×4 minus the 2×2 notch.
    expect(outlineSignedArea(o)).toBeCloseTo((16 - 4) * U * U);
  });

  it('keeps an oversize outline on grow, revalidated against the larger bounds', () => {
    // The perimeter already reaches past the old 4-wide grid (x = 4.5u).
    // Growing welds nothing and keeps it, now within the 5-wide bounds (#3114).
    const oversize: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4.5 * U, y: 0 },
        { x: 4.5 * U, y: 3.5 * U },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const grown = resizeDrawerOutline(oversize, 4 * U, 4 * U, 5 * U, 4 * U, U);
    expect(grown).toBeDefined();
    const o = grown as DrawerOutline;
    expect(validateOutline(o, 5 * U, 4 * U, U)).toBeNull();
    expect(o.vertices).toEqual(oversize.vertices);
  });

  it('resets when a shrink would split the shape into two components', () => {
    const bridge: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: U, y: 0 },
        { x: U, y: 3 * U },
        { x: 3 * U, y: 3 * U },
        { x: 3 * U, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    expect(validateOutline(bridge, 4 * U, 4 * U, U)).toBeNull();
    expect(resizeDrawerOutline(bridge, 4 * U, 4 * U, 4 * U, 2 * U, U)).toBeUndefined();
  });

  it('resets when the crop removes the whole curved region', () => {
    // CURVED_BACK's arc only dips to y = 3.5u; cropping to 3u leaves a plain
    // rectangle, which must normalize back to "no outline".
    expect(resizeDrawerOutline(CURVED_BACK, 4 * U, 4 * U, 4 * U, 3 * U, U)).toBeUndefined();
  });

  it('crops through arcs without breaking validity', () => {
    // Deeper bow (sagitta 1u): the clip line at 3.5u crosses the arc twice.
    const deepCurve: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U, bulge: -0.5 },
        { x: 0, y: 4 * U },
      ],
    };
    const shrunk = resizeDrawerOutline(deepCurve, 4 * U, 4 * U, 4 * U, 3.5 * U, U);
    expect(shrunk).toBeDefined();
    const o = shrunk as DrawerOutline;
    expect(validateOutline(o, 4 * U, 3.5 * U, U)).toBeNull();
    expect(o.vertices.some((v) => (v.bulge ?? 0) !== 0)).toBe(true);
    expect(outlineSignedArea(o)).toBeLessThan(4 * 3.5 * U * U);
  });

  it('drops the authoring annotation when geometry changes', () => {
    const annotated: DrawerOutline = { ...L_SHAPE, authoring: { kind: 'cells' } };
    const shrunk = resizeDrawerOutline(annotated, 4 * U, 4 * U, 3 * U, 4 * U, U);
    expect((shrunk as DrawerOutline).authoring).toBeUndefined();
  });
});

describe('normalizeDrawerOutline', () => {
  function layoutWith(outline: DrawerOutline | undefined, width = 4, depth = 4): Layout {
    const layout = createTestLayout();
    layout.gridUnitMm = mm(U);
    layout.drawer = {
      ...layout.drawer,
      width: gridUnits(width),
      depth: gridUnits(depth),
    };
    if (outline !== undefined) layout.drawer.outline = outline;
    return layout;
  }

  it('passes through layouts without an outline', () => {
    const layout = layoutWith(undefined);
    expect(normalizeDrawerOutline(layout)).toBe(layout);
  });

  it('passes through valid outlines unchanged', () => {
    const layout = layoutWith(L_SHAPE);
    expect(normalizeDrawerOutline(layout)).toBe(layout);
  });

  it('crops an outline that exceeds the drawer extent (stale after resize)', () => {
    const layout = layoutWith(L_SHAPE, 3, 4);
    const normalized = normalizeDrawerOutline(layout);
    expect(normalized).not.toBe(layout);
    const outline = normalized.drawer.outline as DrawerOutline;
    expect(validateOutline(outline, 3 * U, 4 * U, U)).toBeNull();
  });

  it('measures the depth extent with the Y pitch on a non-square grid (#2733)', () => {
    const UY = 48;
    const tall: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 2 * UY },
        { x: 2 * U, y: 2 * UY },
        { x: 2 * U, y: 4 * UY },
        { x: 0, y: 4 * UY },
      ],
    };
    const layout = layoutWith(tall);
    layout.gridUnitMmY = mm(UY);
    // The outline legitimately reaches 4 × UY deep; cropping it against the
    // square extent (4 × U) would mangle the shape.
    expect(normalizeDrawerOutline(layout)).toBe(layout);
  });

  it('drops rectangle-equivalent outlines', () => {
    const rect: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    const normalized = normalizeDrawerOutline(layoutWith(rect));
    expect(normalized.drawer.outline).toBeUndefined();
  });

  it('drops rectangles with redundant collinear vertices', () => {
    const rect: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 2 * U, y: 0 },
        { x: 4 * U, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 0, y: 4 * U },
      ],
    };
    expect(normalizeDrawerOutline(layoutWith(rect)).drawer.outline).toBeUndefined();
  });

  it('keeps a small corner chamfer in a large drawer', () => {
    // A 5mm chamfer removes 12.5mm² — far below any perimeter-scaled area
    // epsilon on a 10-unit drawer. Must survive as intentional geometry.
    const chamfered: DrawerOutline = {
      vertices: [
        { x: 5, y: 0 },
        { x: 10 * U, y: 0 },
        { x: 10 * U, y: 10 * U },
        { x: 0, y: 10 * U },
        { x: 0, y: 5 },
      ],
    };
    const layout = layoutWith(chamfered, 10, 10);
    expect(normalizeDrawerOutline(layout)).toBe(layout);
  });

  it('drops malformed outline values without crashing (untrusted ingress)', () => {
    for (const garbage of [null, 42, 'shape', {}, { vertices: 'nope' }, { vertices: [{}] }]) {
      const layout = layoutWith(undefined);
      (layout.drawer as { outline?: unknown }).outline = garbage;
      expect(normalizeDrawerOutline(layout).drawer.outline).toBeUndefined();
    }
  });

  it('drops invalid outlines', () => {
    const bowtie: DrawerOutline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 4 * U, y: 4 * U },
        { x: 4 * U, y: 0 },
        { x: 0, y: 4 * U },
      ],
    };
    const normalized = normalizeDrawerOutline(layoutWith(bowtie));
    expect(normalized.drawer.outline).toBeUndefined();
  });
});
