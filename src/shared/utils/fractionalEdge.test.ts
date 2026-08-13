import { describe, it, expect } from 'vitest';
import {
  hasFractionalEdgeMismatch,
  computeMatchedEdges,
  edgeForPosition,
  latticeForPosition,
  computeMatchedFootLattice,
  hasFootLatticeMismatch,
} from './fractionalEdge';
import type { FractionalEdgeDesign, FractionalEdgeDrawer } from './fractionalEdge';

/** A 5.5-wide drawer with its half column on the right (the default). */
const FRAC_END = { width: 5.5, depth: 4, fractionalEdgeX: 'end' as const };
/** The same drawer with its half column on the left, so cells start at 0.5. */
const FRAC_START = { width: 5.5, depth: 4, fractionalEdgeX: 'start' as const };
/** A whole-number drawer — no fractional column exists on either axis. */
const WHOLE = { width: 5, depth: 4 };

/** One placement, as the array the helpers take. */
const at = (x: number, y = 0): { x: number; y: number }[] => [{ x, y }];

describe('edgeForPosition', () => {
  it('puts the half cell last for a bin starting on a cell boundary', () => {
    expect(edgeForPosition(4, 5.5, 'end')).toBe('end');
  });

  it('puts the half cell first when the drawer cells start at the half offset', () => {
    // Cells are [0,0.5] [0.5,1.5] …, so a bin at 0 opens with the half cell.
    expect(edgeForPosition(0, 5.5, 'start')).toBe('start');
    expect(edgeForPosition(0.5, 5.5, 'start')).toBe('end');
  });

  it('reads the position, not the drawer, when the drawer axis is a whole number', () => {
    // A 1.5-wide bin in a 5-wide drawer is free to sit either way; the layout
    // grid draws whichever its position implies (#3070).
    expect(edgeForPosition(0, 5, undefined)).toBe('end');
    expect(edgeForPosition(0.5, 5, undefined)).toBe('start');
    expect(edgeForPosition(2, 5, undefined)).toBe('end');
    expect(edgeForPosition(2.5, 5, undefined)).toBe('start');
  });

  it('treats an unset or invalid drawer edge as the default end edge', () => {
    expect(edgeForPosition(0, 5.5, undefined)).toBe('end');
  });
});

describe('hasFractionalEdgeMismatch', () => {
  it('flags a fractional-width design whose foot points the wrong way', () => {
    // Bin at 0 in a start-fractional drawer opens with its half cell → 'start'.
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'end', fractionalEdgeManualX: false },
        FRAC_START,
        at(0)
      )
    ).toBe(true);
  });

  it('accepts the bin that fills a right-hand half column', () => {
    // 5.5-wide drawer, half column on the right: a 1.5-wide bin at x=4 spans
    // [4,5.5], so its half cell is the last one.
    expect(
      hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'end' }, FRAC_END, at(4))
    ).toBe(false);
    expect(
      hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'start' }, FRAC_END, at(4))
    ).toBe(true);
  });

  it('does not flag when the design agrees with the placement', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'start' },
        FRAC_START,
        at(0)
      )
    ).toBe(false);
  });

  it('does not flag a correct foot in a whole-number drawer (#3070)', () => {
    // The reported bug: no fractional column exists on X, the unset drawer edge
    // normalized to 'end', and a correct 'start' foot was flagged and reversed.
    expect(
      hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'start' }, WHOLE, at(0.5))
    ).toBe(false);
    expect(
      hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'end' }, WHOLE, at(0))
    ).toBe(false);
  });

  it('still flags a genuinely reversed foot in a whole-number drawer', () => {
    expect(
      hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'start' }, WHOLE, at(0))
    ).toBe(true);
  });

  it('flags a fractional-depth mismatch independently of width', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 2, depth: 2.5, fractionalEdgeY: 'start' },
        { width: 5, depth: 4 },
        at(0, 0)
      )
    ).toBe(true);
  });

  it('never flags an integer dimension', () => {
    expect(
      hasFractionalEdgeMismatch({ width: 2, depth: 2, fractionalEdgeX: 'end' }, FRAC_START, at(0))
    ).toBe(false);
  });

  it('suppresses the warning once that axis is manual', () => {
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'end', fractionalEdgeManualX: true },
        FRAC_START,
        at(0)
      )
    ).toBe(false);
  });

  it('a manual X override does not hide a real Y mismatch', () => {
    expect(
      hasFractionalEdgeMismatch(
        {
          width: 1.5,
          depth: 1.5,
          fractionalEdgeX: 'end',
          fractionalEdgeManualX: true,
          fractionalEdgeY: 'start',
          fractionalEdgeManualY: false,
        },
        { width: 5.5, depth: 4, fractionalEdgeX: 'start' },
        at(0, 0)
      )
    ).toBe(true);
  });

  it('does not flag when the design edge is unknown (legacy registry entry)', () => {
    expect(hasFractionalEdgeMismatch({ width: 1.5, depth: 2 }, FRAC_START, at(0))).toBe(false);
  });

  it('does not flag a half-socket design — its edge has no geometric effect', () => {
    // Every cell is a uniform 0.5 unit, so there is no odd half foot to align
    // and `forEachCell`'s reverse() is a no-op.
    expect(
      hasFractionalEdgeMismatch(
        { width: 1.5, depth: 2, fractionalEdgeX: 'start', halfSockets: true },
        WHOLE,
        at(0)
      )
    ).toBe(false);
  });

  describe('a design placed more than once', () => {
    const design = { width: 1.5, depth: 2, fractionalEdgeX: 'end' as const };

    it('flags when every placement agrees the edge is wrong', () => {
      // Both at half-offsets in a whole-number drawer → both want 'start'.
      expect(
        hasFractionalEdgeMismatch(design, WHOLE, [
          { x: 0.5, y: 0 },
          { x: 2.5, y: 0 },
        ])
      ).toBe(true);
    });

    it('stays quiet when the placements want opposite edges', () => {
      // No single value satisfies both, so this is an inherent conflict of
      // sharing one design — a one-click "fix" would just move the problem.
      expect(
        hasFractionalEdgeMismatch(design, WHOLE, [
          { x: 0, y: 0 },
          { x: 0.5, y: 0 },
        ])
      ).toBe(false);
    });

    it('stays quiet when every placement already agrees with the design', () => {
      expect(
        hasFractionalEdgeMismatch(design, WHOLE, [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ])
      ).toBe(false);
    });

    it('resolves each axis independently', () => {
      // X agrees across both placements, Y disagrees — only X is actionable.
      const both = {
        width: 1.5,
        depth: 1.5,
        fractionalEdgeX: 'end' as const,
        fractionalEdgeY: 'end' as const,
      };
      const patch = computeMatchedEdges(both, WHOLE, [
        { x: 0.5, y: 0 },
        { x: 2.5, y: 0.5 },
      ]);
      expect(patch.fractionalEdgeX).toBe('start');
      expect(patch.fractionalEdgeY).toBeUndefined();
    });
  });

  it('has nothing to say about a design that is not placed anywhere', () => {
    expect(
      hasFractionalEdgeMismatch({ width: 1.5, depth: 2, fractionalEdgeX: 'start' }, WHOLE, [])
    ).toBe(false);
  });
});

describe('computeMatchedEdges', () => {
  it('aligns only the fractional axes to the placement and clears that manual flag', () => {
    expect(
      computeMatchedEdges(
        { width: 1.5, depth: 2, fractionalEdgeX: 'end', fractionalEdgeManualX: true },
        FRAC_START,
        at(0)
      )
    ).toEqual({ fractionalEdgeX: 'start', fractionalEdgeManualX: false });
  });

  it('aligns both axes when both dimensions are fractional', () => {
    expect(
      computeMatchedEdges(
        { width: 1.5, depth: 2.5 },
        { width: 5.5, depth: 4.5, fractionalEdgeX: 'start', fractionalEdgeY: 'end' },
        at(0, 2)
      )
    ).toEqual({
      fractionalEdgeX: 'start',
      fractionalEdgeManualX: false,
      fractionalEdgeY: 'end',
      fractionalEdgeManualY: false,
    });
  });

  it('leaves a correctly placed foot alone instead of reversing it (#3070)', () => {
    expect(computeMatchedEdges({ width: 1.5, depth: 2 }, WHOLE, at(0.5))).toEqual({
      fractionalEdgeX: 'start',
      fractionalEdgeManualX: false,
    });
  });

  it('defaults an unset drawer edge to end', () => {
    expect(computeMatchedEdges({ width: 1.5, depth: 2 }, { width: 5.5, depth: 4 }, at(4))).toEqual({
      fractionalEdgeX: 'end',
      fractionalEdgeManualX: false,
    });
  });
});

describe('foot lattice placement (#3467)', () => {
  const design = (over: Partial<FractionalEdgeDesign> = {}): FractionalEdgeDesign => ({
    width: 3,
    depth: 3,
    ...over,
  });
  const drawer: FractionalEdgeDrawer = { width: 6, depth: 6 };

  describe('latticeForPosition', () => {
    it('wants the grid lattice when the bin opens on a cell boundary', () => {
      expect(latticeForPosition(0, 6, 'end')).toBe('grid');
      expect(latticeForPosition(2, 6, 'end')).toBe('grid');
    });

    it('wants the half lattice when the bin sits half a unit off', () => {
      expect(latticeForPosition(0.5, 6, 'end')).toBe('half');
      expect(latticeForPosition(2.5, 6, 'end')).toBe('half');
    });

    it('follows the drawer’s own fractional offset', () => {
      // A 5.5u drawer with its slot at the start puts every boundary on n+0.5.
      expect(latticeForPosition(0.5, 5.5, 'start')).toBe('grid');
      expect(latticeForPosition(1, 5.5, 'start')).toBe('half');
    });
  });

  describe('computeMatchedFootLattice', () => {
    it('resolves each axis independently', () => {
      expect(computeMatchedFootLattice(design(), drawer, [{ x: 1.5, y: 2 }])).toEqual({
        footLatticeX: 'half',
        footLatticeY: 'grid',
      });
    });

    it('stays silent on an axis whose placements disagree', () => {
      const patch = computeMatchedFootLattice(design(), drawer, [
        { x: 0, y: 0 },
        { x: 0.5, y: 0 },
      ]);
      expect(patch.footLatticeX).toBeUndefined();
      expect(patch.footLatticeY).toBe('grid');
    });

    it('is empty with no placements', () => {
      expect(computeMatchedFootLattice(design(), drawer, [])).toEqual({});
    });

    it('is empty for a half-socket base — it seats at either offset', () => {
      expect(
        computeMatchedFootLattice(design({ halfSockets: true }), drawer, [{ x: 0.5, y: 0.5 }])
      ).toEqual({});
    });

    it('is empty for a custom shape — the generator pins it to the grid', () => {
      expect(
        computeMatchedFootLattice(design({ hasCellMask: true }), drawer, [{ x: 0.5, y: 0.5 }])
      ).toEqual({});
    });
  });

  describe('hasFootLatticeMismatch', () => {
    it('flags an unset lattice on a half-offset placement', () => {
      // Unset means 'grid', so a design predating the setting still warns.
      expect(hasFootLatticeMismatch(design(), drawer, [{ x: 0.5, y: 0 }])).toBe(true);
    });

    it('is quiet when the lattice already matches', () => {
      expect(
        hasFootLatticeMismatch(design({ footLatticeX: 'half' }), drawer, [{ x: 0.5, y: 0 }])
      ).toBe(false);
    });

    it('flags a half lattice on an on-grid placement too', () => {
      // Wrong in both directions: this one perches the bin as surely as the other.
      expect(
        hasFootLatticeMismatch(design({ footLatticeX: 'half' }), drawer, [{ x: 0, y: 0 }])
      ).toBe(true);
    });

    it('has no manual override — a part that does not fit is not a preference', () => {
      expect(
        hasFootLatticeMismatch(
          design({ fractionalEdgeManualX: true, fractionalEdgeManualY: true }),
          drawer,
          [{ x: 0.5, y: 0 }]
        )
      ).toBe(true);
    });

    it('is quiet for a half-socket base', () => {
      expect(
        hasFootLatticeMismatch(design({ halfSockets: true }), drawer, [{ x: 0.5, y: 0 }])
      ).toBe(false);
    });
  });
});

describe('foot lattice and fractional edge are complementary (#3467)', () => {
  const drawer: FractionalEdgeDrawer = { width: 6, depth: 6 };

  it('leaves a fractional axis to the edge mechanism', () => {
    // A 2.5u axis with its half cell on the leading edge already decomposes to
    // [0.5, 1, 1], which is the seating-correct layout for a half offset.
    const patch = computeMatchedFootLattice({ width: 2.5, depth: 3 }, drawer, [{ x: 0.5, y: 0.5 }]);
    expect(patch.footLatticeX).toBeUndefined();
    expect(patch.footLatticeY).toBe('half');
  });

  it('does not warn about a fractional axis the edge mechanism owns', () => {
    expect(hasFootLatticeMismatch({ width: 2.5, depth: 2.5 }, drawer, [{ x: 0.5, y: 0.5 }])).toBe(
      false
    );
  });
});
