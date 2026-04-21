import { describe, it, expect } from 'vitest';
import {
  buildFullMask,
  classifyShape,
  countFilled,
  hashMask,
  hasHalfBinDetail,
  isAllFilled,
  isPartialMask,
  isRegionFilled,
  MASK_CELL_SIZE,
  MASK_CELLS_PER_UNIT,
  MAX_MASK_DIMENSION,
  maskToPolygon,
  resizeMask,
  validateMask,
  type CellMask,
} from './cellMask';

/** Build a mask from a 2D boolean array (row 0 = bottom). */
function mask(rows: (0 | 1)[][]): CellMask {
  const r = rows.slice().reverse(); // input comes visually top-first; flip to bottom-first
  const cols = r[0]?.length ?? 0;
  return { cols, rows: r.length, cells: r.flat() };
}

describe('buildFullMask', () => {
  it('builds an all-filled mask at half-bin resolution', () => {
    const m = buildFullMask(2, 3);
    expect(m.cols).toBe(4); // 2 * MASK_CELLS_PER_UNIT
    expect(m.rows).toBe(6); // 3 * MASK_CELLS_PER_UNIT
    expect(m.cells.length).toBe(24);
    expect(m.cells.every((c) => c === 1)).toBe(true);
  });

  it('handles half-bin widths', () => {
    const m = buildFullMask(1.5, 1.5);
    expect(m.cols).toBe(3);
    expect(m.rows).toBe(3);
  });
});

describe('isAllFilled / countFilled', () => {
  it('detects a full mask', () => {
    const m = buildFullMask(2, 2);
    expect(isAllFilled(m)).toBe(true);
    expect(countFilled(m)).toBe(16);
  });

  it('detects a partial mask', () => {
    const m = mask([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ]);
    expect(isAllFilled(m)).toBe(false);
    expect(countFilled(m)).toBe(8);
  });
});

describe('hasHalfBinDetail', () => {
  interface Case {
    readonly name: string;
    readonly rows: (0 | 1)[][];
    readonly expected: boolean;
  }

  const cases: readonly Case[] = [
    // 1u-aligned masks (no half-bin detail) — every 1u block is uniform.
    {
      name: '2×2 fully filled',
      rows: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
      expected: false,
    },
    {
      name: '2×2 bottom-right 1u cleared (1u L-shape)',
      rows: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 0, 0],
        [1, 1, 0, 0],
      ],
      expected: false,
    },
    {
      name: '3×3 L preset (1u corner cut)',
      rows: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 0, 0],
        [1, 1, 1, 1, 0, 0],
      ],
      expected: false,
    },
    {
      name: '4×4 checkerboard at 1u granularity',
      rows: [
        [1, 1, 0, 0, 1, 1, 0, 0],
        [1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0, 1, 1],
        [0, 0, 1, 1, 0, 0, 1, 1],
        [1, 1, 0, 0, 1, 1, 0, 0],
        [1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0, 1, 1],
        [0, 0, 1, 1, 0, 0, 1, 1],
      ],
      expected: false,
    },

    // Half-bin detail present — any 1u block with mixed sub-cells.
    {
      name: '2×2 with one half-cell cleared',
      rows: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 0],
      ],
      expected: true,
    },
    {
      name: '2×2 with a half-cell row cleared',
      rows: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ],
      expected: true,
    },
    {
      name: '3×3 with a diagonal half-cell cut',
      rows: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1, 1],
      ],
      expected: true,
    },

    // Odd dimensions — the trailing 0.5u fringe is natural half-cells, not
    // half-bin detail. Only mixed 1u blocks trigger the predicate.
    {
      name: '1.5×1.5 fully filled (3×3 mask) — fringe only, no mixed 1u',
      rows: [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1],
      ],
      expected: false,
    },
    {
      name: '2×1.5 (4×3 mask) fully filled — fringe only',
      rows: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, 1, 1, 1],
      ],
      expected: false,
    },
    {
      name: '2×2 with a single interior half-cell cut inside an odd-dim mask (5×5)',
      // 5×5 mask: the bottom-left 2×2 block has three filled + one empty =
      // mixed → true, regardless of the trailing odd fringe.
      rows: [
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 1, 1, 1, 1],
      ],
      expected: true,
    },
  ];

  it.each(cases)('$name → $expected', ({ rows, expected }) => {
    expect(hasHalfBinDetail(mask(rows))).toBe(expected);
  });

  it('returns false when every 1u grid square has all four sub-cells matching', () => {
    // 2×2 bin (4×4 mask) with the whole bottom-right 1u cell cleared — each
    // 1u square is uniform (all 4 filled or all 4 empty).
    const m = mask([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 0, 0],
      [1, 1, 0, 0],
    ]);
    expect(hasHalfBinDetail(m)).toBe(false);
  });

  it('returns true when any 1u grid square has mixed sub-cells', () => {
    // One cleared half-cell inside an otherwise-full 2×2 bin.
    const m = mask([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 0],
    ]);
    expect(hasHalfBinDetail(m)).toBe(true);
  });

  it('returns false for a fully-filled odd-dim mask (fringe is not detail)', () => {
    // 1.5×1.5 bin = 3×3 mask. Trailing fringe cells are natural half-cells;
    // no 1u block has mixed filled/empty sub-cells.
    const m = mask([
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
    expect(hasHalfBinDetail(m)).toBe(false);
  });

  it('preset L at 3\u00d73 (half-bin mask 6\u00d76) has no half-bin detail', () => {
    // L preset clears a full 1u corner — every 1u square stays uniform.
    const m = mask([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0, 0],
    ]);
    expect(hasHalfBinDetail(m)).toBe(false);
  });
});

describe('isPartialMask', () => {
  it('returns false for undefined', () => {
    expect(isPartialMask(undefined)).toBe(false);
  });

  it('returns false for a fully-filled mask', () => {
    expect(isPartialMask(buildFullMask(2, 2))).toBe(false);
  });

  it('returns true for a mask with at least one empty cell', () => {
    const m = mask([
      [1, 1],
      [1, 0],
    ]);
    expect(isPartialMask(m)).toBe(true);
  });
});

describe('validateMask', () => {
  it('accepts a full rectangle', () => {
    expect(validateMask(buildFullMask(2, 2))).toBeNull();
  });

  it('accepts a 4-connected L-shape', () => {
    expect(
      validateMask(
        mask([
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 0],
        ])
      )
    ).toBeNull();
  });

  it('rejects an empty mask', () => {
    const err = validateMask(mask([[0]]));
    expect(err?.kind).toBe('empty');
  });

  it('rejects dimension mismatch', () => {
    const err = validateMask({ cols: 2, rows: 2, cells: [1, 1, 1] });
    expect(err?.kind).toBe('dimension_mismatch');
  });

  it('rejects invalid cell values', () => {
    const err = validateMask({ cols: 2, rows: 1, cells: [1, 2 as unknown as 1] });
    expect(err?.kind).toBe('invalid_cell_value');
  });

  it('rejects disconnected components', () => {
    // Two 1×1 cells separated by an empty one
    const err = validateMask(mask([[1, 0, 1]]));
    expect(err?.kind).toBe('disconnected');
  });

  it('rejects diagonal-only touching (4-connected, not 8-connected)', () => {
    const err = validateMask(
      mask([
        [1, 0],
        [0, 1],
      ])
    );
    expect(err?.kind).toBe('disconnected');
  });

  it('accepts masks with interior holes (O/ring-shaped bins)', () => {
    // 3×3 ring: outer frame filled, center empty. Validates because the
    // filled region is still one 4-connected component; the hole becomes
    // an inner loop in the generator's polygon output.
    expect(
      validateMask(
        mask([
          [1, 1, 1],
          [1, 0, 1],
          [1, 1, 1],
        ])
      )
    ).toBeNull();
  });

  it('accepts a true U-shape (empty region reaches the boundary)', () => {
    // 3×3 U: open at the top. The center cell is empty but reaches
    // the top edge via the empty cell above it.
    expect(
      validateMask(
        mask([
          [1, 0, 1],
          [1, 0, 1],
          [1, 1, 1],
        ])
      )
    ).toBeNull();
  });

  it('rejects masks exceeding MAX_MASK_DIMENSION', () => {
    const tooBig = MAX_MASK_DIMENSION + 1;
    const err = validateMask({ cols: tooBig, rows: 1, cells: new Array(tooBig).fill(1) });
    expect(err?.kind).toBe('out_of_bounds');
  });

  it('rejects zero or negative dimensions', () => {
    expect(validateMask({ cols: 0, rows: 1, cells: [] })?.kind).toBe('dimension_mismatch');
    expect(validateMask({ cols: 1, rows: -1, cells: [] })?.kind).toBe('dimension_mismatch');
  });
});

describe('resizeMask', () => {
  it('preserves overlap when growing', () => {
    const m = mask([
      [1, 0],
      [1, 1],
    ]);
    const bigger = resizeMask(m, 3, 3);
    // Old 2×2 region preserved at (cols 0-1, rows 0-1); new cells default to filled.
    expect(bigger.cols).toBe(3);
    expect(bigger.rows).toBe(3);
    // row 0 = bottom (was [1,1]) + new col 2 filled
    expect(bigger.cells.slice(0, 3)).toEqual([1, 1, 1]);
    // row 1 = (was [1,0]) + new col 2 filled
    expect(bigger.cells.slice(3, 6)).toEqual([1, 0, 1]);
    // row 2 = all new, filled
    expect(bigger.cells.slice(6, 9)).toEqual([1, 1, 1]);
  });

  it('drops cells when shrinking', () => {
    const m = mask([
      [1, 1, 1],
      [1, 1, 0],
      [1, 1, 1],
    ]);
    const smaller = resizeMask(m, 2, 2);
    // Keeps bottom-left 2×2 of the original
    expect(smaller.cols).toBe(2);
    expect(smaller.rows).toBe(2);
    // row 0 = bottom (was [1,1,1]) → first 2 = [1,1]
    // row 1 = (was [1,1,0]) → first 2 = [1,1]
    expect(smaller.cells).toEqual([1, 1, 1, 1]);
  });
});

describe('maskToPolygon', () => {
  it('returns 4 corners for a 1×1 rectangle', () => {
    const m = buildFullMask(0.5, 0.5); // exactly one half-cell
    const loops = maskToPolygon(m);
    expect(loops).toHaveLength(1);
    const poly = loops[0];
    expect(poly).toHaveLength(4);
    // CCW from bottom-left
    expect(poly[0]).toEqual({ x: 0, y: 0 });
    // Bounding box check
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBeCloseTo(MASK_CELL_SIZE);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBeCloseTo(MASK_CELL_SIZE);
  });

  it('collapses collinear cells into 4 corners for a larger rectangle', () => {
    const m = buildFullMask(2, 1); // 4×2 mask cells = one rectangle
    const loops = maskToPolygon(m);
    expect(loops).toHaveLength(1);
    const poly = loops[0];
    expect(poly).toHaveLength(4);
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    expect(Math.max(...xs)).toBeCloseTo(2);
    expect(Math.max(...ys)).toBeCloseTo(1);
  });

  it('produces 6 corners for an L-shape (3×3 with BR corner missing)', () => {
    // One full grid cell = 2 mask cells. 3×3 L with bottom-right 1×1 grid cell empty
    // = 6×6 mask with bottom-right 2×2 cells empty.
    const m = mask([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 0, 0],
      [1, 1, 1, 1, 0, 0],
    ]);
    const loops = maskToPolygon(m);
    expect(loops).toHaveLength(1);
    const poly = loops[0];
    expect(poly).toHaveLength(6);

    // Bounds: 3 grid units wide, 3 grid units tall
    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBeCloseTo(3);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBeCloseTo(3);

    // Concave corner at (2, 1) (grid units)
    const hasConcave = poly.some((p) => Math.abs(p.x - 2) < 1e-6 && Math.abs(p.y - 1) < 1e-6);
    expect(hasConcave).toBe(true);
  });

  it('produces 8 corners for a T-shape', () => {
    // 3×3 T: top row full, middle row: only center, bottom row: only center
    //   [ 1 1 1 ]
    //   [ 0 1 0 ]
    //   [ 0 1 0 ]
    // At half-bin resolution (6×6):
    const m = mask([
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 0],
      [0, 0, 1, 1, 0, 0],
    ]);
    const loops = maskToPolygon(m);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toHaveLength(8);
  });

  it('returns outer + inner hole loop for an O-shape (3×3 ring)', () => {
    // 3×3 mask (mid-point): outer frame filled, center empty.
    const m = mask([
      [1, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ]);
    const loops = maskToPolygon(m);
    expect(loops).toHaveLength(2);

    // Outer loop: CCW, bounds 0..1.5 in grid units (3 half-cells × 0.5).
    const outer = loops[0];
    expect(outer).toHaveLength(4);
    const outerXs = outer.map((p) => p.x);
    expect(Math.min(...outerXs)).toBe(0);
    expect(Math.max(...outerXs)).toBeCloseTo(1.5);

    // Inner hole loop: the empty center cell is one half-cell at (0.5..1.0,
    // 0.5..1.0) in grid units.
    const hole = loops[1];
    expect(hole).toHaveLength(4);
    const holeXs = hole.map((p) => p.x);
    const holeYs = hole.map((p) => p.y);
    expect(Math.min(...holeXs)).toBeCloseTo(0.5);
    expect(Math.max(...holeXs)).toBeCloseTo(1.0);
    expect(Math.min(...holeYs)).toBeCloseTo(0.5);
    expect(Math.max(...holeYs)).toBeCloseTo(1.0);
  });
});

describe('classifyShape', () => {
  it('returns rectangle for a full mask', () => {
    expect(classifyShape(buildFullMask(2, 2))).toBe('rectangle');
  });

  it('returns custom for a non-full mask', () => {
    expect(
      classifyShape(
        mask([
          [1, 1, 1],
          [1, 1, 0],
        ])
      )
    ).toBe('custom');
  });
});

describe('hashMask', () => {
  it('is deterministic', () => {
    const m = buildFullMask(2, 2);
    expect(hashMask(m)).toBe(hashMask(m));
  });

  it('differs for different masks', () => {
    const a = buildFullMask(2, 2);
    const b = mask([
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 0],
    ]);
    expect(hashMask(a)).not.toBe(hashMask(b));
  });
});

describe('MASK_CELLS_PER_UNIT', () => {
  it('matches HALF_BIN_SCALE semantics (2 sub-cells per grid unit)', () => {
    expect(MASK_CELLS_PER_UNIT).toBe(2);
    expect(MASK_CELL_SIZE).toBe(0.5);
  });
});

describe('isRegionFilled', () => {
  // 3x3 L-shape (BR corner removed), at half-bin resolution (6x6 mask)
  const lMask = mask([
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0],
    [1, 1, 1, 1, 0, 0],
  ]);

  it('returns true for a 1x1 region fully inside the filled area', () => {
    // cell (0, 0) — bottom-left full grid unit of the L
    expect(isRegionFilled(lMask, 0, 0, 1, 1)).toBe(true);
  });

  it('returns false for a 1x1 region on the missing corner', () => {
    // cell (2, 0) — the removed bottom-right corner of the L
    expect(isRegionFilled(lMask, 2, 0, 1, 1)).toBe(false);
  });

  it('returns false for a 1x1 region overlapping the concave boundary', () => {
    // cell (1.5, 0) — half in, half out (right half of row 0 overlaps the missing corner)
    expect(isRegionFilled(lMask, 1.5, 0, 1, 1)).toBe(false);
  });

  it('returns true for a half-cell inside the filled area', () => {
    expect(isRegionFilled(lMask, 0, 0, 0.5, 0.5)).toBe(true);
  });

  it('returns false when region extends outside the mask', () => {
    expect(isRegionFilled(lMask, 3, 0, 1, 1)).toBe(false);
  });
});
