import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, CompartmentConfig } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import {
  DIVIDER_RAIL_MARGIN,
  dividerRailBlocks,
  dividerRailSides,
  type DividerRailBlock,
} from './dividerRailPlan';

/**
 * A default 2x2x3 bin: innerW = innerD = 2*42 - 0.5 - 2*1.2 = 81.1mm, interior
 * ceiling at 15.3mm, and the rail band's floor at 12.95mm above the cavity
 * floor. Every expectation below is stated against those, not re-derived.
 */
function bin(compartments: CompartmentConfig, overrides: Partial<BinParams> = {}): BinParams {
  return { ...DEFAULT_BIN_PARAMS, compartments, ...overrides };
}

const TWO_COLUMNS: CompartmentConfig = { cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] };

describe('dividerRailBlocks', () => {
  it('blocks both ends of a column boundary, at the divider plus a margin either side', () => {
    const blocks = dividerRailBlocks(bin(TWO_COLUMNS));
    // The boundary of a 2-column grid sits on the bin centreline.
    const expected = { lo: -0.6 - DIVIDER_RAIL_MARGIN, hi: 0.6 + DIVIDER_RAIL_MARGIN };
    expect(blocks).toEqual([
      { side: 'front', ...expected },
      { side: 'back', ...expected },
    ]);
  });

  it('blocks the left and right walls for a row boundary', () => {
    const blocks = dividerRailBlocks(bin({ cols: 1, rows: 2, thickness: 1.2, cells: [0, 1] }));
    expect(dividerRailSides(blocks)).toEqual(['left', 'right']);
  });

  it('treats a column boundary broken by a merged row as two runs', () => {
    // One run against the front wall, a separate one against the back, and the
    // merged middle row between them. The row boundaries either side of that
    // merge are real dividers too, so they take the left and right walls.
    const blocks = dividerRailBlocks(
      bin({ cols: 2, rows: 3, thickness: 1.2, cells: [0, 1, 2, 2, 3, 4] })
    );
    expect(dividerRailSides(blocks)).toEqual(['front', 'back', 'left', 'right']);
    expect(blocks.filter((b) => b.side === 'front' || b.side === 'back')).toHaveLength(2);
  });

  it('costs the end walls nothing when the column boundary reaches neither', () => {
    // The only column boundary is between the two middle cells, a full cell
    // clear of both the front and the back wall. The row boundaries still
    // reach the side walls.
    const blocks = dividerRailBlocks(
      bin({ cols: 2, rows: 3, thickness: 1.2, cells: [0, 0, 1, 2, 3, 3] })
    );
    expect(blocks.filter((b) => b.side === 'front' || b.side === 'back')).toEqual([]);
    expect(dividerRailSides(blocks)).toEqual(['left', 'right']);
  });

  describe('bins that build no divider walls', () => {
    it('a single compartment', () => {
      expect(dividerRailBlocks(bin({ cols: 2, rows: 1, thickness: 1.2, cells: [0, 0] }))).toEqual(
        []
      );
    });

    it('a solid bin', () => {
      expect(dividerRailBlocks(bin(TWO_COLUMNS, { style: 'solid' }))).toEqual([]);
    });

    it('a slotted bin, whose stale compartment cells must not warn', () => {
      expect(dividerRailBlocks(bin(TWO_COLUMNS, { style: 'slotted' }))).toEqual([]);
    });

    it('a polygon bin, whose compartments are gated off', () => {
      const cells = Array<0 | 1>(64).fill(1);
      cells[0] = 0;
      const cellMask: CellMask = { cols: 8, rows: 8, cells };
      expect(dividerRailBlocks(bin(TWO_COLUMNS, { width: 4, depth: 4, cellMask }))).toEqual([]);
    });

    it('cells too small for the wall builder to make a viable cavity', () => {
      // Eight columns of 1.2mm-thick dividers on a 1-wide bin leaves each
      // compartment under `thickness * 2`, which is where
      // `buildCompartmentWallsInScope` bails.
      const cells = [0, 1, 2, 3, 4, 5, 6, 7];
      expect(
        dividerRailBlocks(bin({ cols: 8, rows: 1, thickness: 3, cells }, { width: 1, depth: 1 }))
      ).toEqual([]);
    });
  });

  describe('the divider has to reach the band', () => {
    it('an explicit dividerHeight below it costs no rail', () => {
      expect(dividerRailBlocks(bin({ ...TWO_COLUMNS, dividerHeight: 12 }))).toEqual([]);
    });

    it('one just above it still does', () => {
      expect(dividerRailBlocks(bin({ ...TWO_COLUMNS, dividerHeight: 13 }))).toHaveLength(2);
    });

    it('a collar lifts the band clear without moving the divider', () => {
      expect(dividerRailBlocks(bin(TWO_COLUMNS, { extraWallHeightMm: 4 }))).toEqual([]);
    });

    it('a collar too short to clear it does not', () => {
      expect(dividerRailBlocks(bin(TWO_COLUMNS, { extraWallHeightMm: 2 }))).toHaveLength(2);
    });
  });

  it('follows a tilt to its real endpoints and widens for the crossing angle', () => {
    const blocks = dividerRailBlocks(
      bin({
        ...TWO_COLUMNS,
        dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 20, offsetEnd: -20 }],
      })
    );
    // thickness * hypot(81.1, 40) / 81.1 / 2 = 0.669, against 0.6 straight.
    const front = blocks.find((b) => b.side === 'front');
    const back = blocks.find((b) => b.side === 'back');
    expect((front?.lo ?? 0) + (front?.hi ?? 0)).toBeCloseTo(40, 6);
    expect((back?.lo ?? 0) + (back?.hi ?? 0)).toBeCloseTo(-40, 6);
    expect((front?.hi ?? 0) - (front?.lo ?? 0)).toBeCloseTo(2 * (0.669 + DIVIDER_RAIL_MARGIN), 2);
  });

  describe('a leaning divider sweeps across the rail band', () => {
    // Divider top at the 15.3mm ceiling, band floor at 12.95mm: the rail sees
    // 2.35mm of the wall, over which a lean travels 2.35 * tan(lean).
    const BAND_DEPTH = 15.3 - 12.95;
    const leaning = (rakeDeg: number): readonly DividerRailBlock[] =>
      dividerRailBlocks(
        bin({
          ...TWO_COLUMNS,
          dividerOverrides: [
            { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg },
          ],
        })
      );

    it('widens the notch by the travel, on the side it leans toward', () => {
      const front = leaning(45).find((b) => b.side === 'front');
      const sweep = BAND_DEPTH * Math.tan(Math.PI / 4);
      expect(front?.lo).toBeCloseTo(-0.6 - DIVIDER_RAIL_MARGIN, 2);
      expect(front?.hi).toBeCloseTo(0.6 + sweep + DIVIDER_RAIL_MARGIN, 2);
    });

    it('widens the other side for a negative lean', () => {
      const front = leaning(-45).find((b) => b.side === 'front');
      const sweep = BAND_DEPTH * Math.tan(Math.PI / 4);
      expect(front?.lo).toBeCloseTo(-0.6 - sweep - DIVIDER_RAIL_MARGIN, 2);
      expect(front?.hi).toBeCloseTo(0.6 + DIVIDER_RAIL_MARGIN, 2);
    });

    it('outgrows the margin, which is the whole reason it is measured', () => {
      const straight = dividerRailBlocks(bin(TWO_COLUMNS)).find((b) => b.side === 'front');
      const leaned = leaning(45).find((b) => b.side === 'front');
      const grew = (leaned?.hi ?? 0) - (straight?.hi ?? 0);
      expect(grew).toBeGreaterThan(DIVIDER_RAIL_MARGIN);
    });

    it('costs nothing when the divider stands upright', () => {
      expect(leaning(0)).toEqual(dividerRailBlocks(bin(TWO_COLUMNS)));
    });
  });

  // A rail reaches 3.35mm inboard of the inner wall face, so a boundary line
  // closer than that runs THROUGH the rail rather than across it and denies the
  // whole run. Only a small custom pitch gets a cell that narrow past the
  // viability guard: 18.1mm leaves a 15.2mm interior in four 3.8mm cells.
  const expectWholeRun = (
    blocks: readonly DividerRailBlock[],
    side: DividerRailBlock['side'],
    halfExtent: number
  ): void => {
    const widest = blocks
      .filter((b) => b.side === side)
      .sort((a, b) => b.hi - b.lo - (a.hi - a.lo))[0];
    expect(widest).toBeDefined();
    expect(widest?.lo).toBeCloseTo(-halfExtent - DIVIDER_RAIL_MARGIN, 6);
    expect(widest?.hi).toBeCloseTo(halfExtent + DIVIDER_RAIL_MARGIN, 6);
  };

  it('takes the back and front rails whole for a row boundary inside their reach', () => {
    const blocks = dividerRailBlocks(
      bin({ cols: 1, rows: 4, thickness: 1, cells: [0, 1, 2, 3] }, { depth: 1, gridUnitMmY: 18.1 })
    );
    // The whole X run, not a crossing: innerW/2 = 40.55.
    expectWholeRun(blocks, 'back', 40.55);
    expectWholeRun(blocks, 'front', 40.55);
  });

  it('takes the left and right rails whole for a column boundary inside their reach', () => {
    const blocks = dividerRailBlocks(
      bin({ cols: 4, rows: 1, thickness: 1, cells: [0, 1, 2, 3] }, { width: 1, gridUnitMm: 18.1 })
    );
    // The pitch applies to both axes, so a 2-deep bin at 18.1mm has innerD 33.3.
    expectWholeRun(blocks, 'left', 16.65);
    expectWholeRun(blocks, 'right', 16.65);
  });
});

describe('dividerRailSides', () => {
  it('reports each affected wall once, in a stable order', () => {
    expect(
      dividerRailSides([
        { side: 'back', lo: 0, hi: 1 },
        { side: 'front', lo: 0, hi: 1 },
        { side: 'back', lo: 4, hi: 5 },
      ])
    ).toEqual(['front', 'back']);
  });
});
