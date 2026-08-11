import { describe, it, expect } from 'vitest';
import { planMergedBin } from './mergeBins';
import { createTestBin, createTestLayout, expectOk, expectErr } from '@/test/testUtils';
import type { Bin } from '@/core/types';
import { binId, gridUnits, heightUnits, mm } from '@/core/types';

function bin(
  id: string,
  x: number,
  y: number,
  width: number,
  depth: number,
  overrides: Partial<Bin> = {}
): Bin {
  return createTestBin({
    id: binId(id),
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(width),
    depth: gridUnits(depth),
    ...overrides,
  });
}

describe('planMergedBin', () => {
  const layout = createTestLayout();

  it('rejects an empty selection', () => {
    expect(expectErr(planMergedBin([], layout)).kind).toBe('too-few-bins');
  });

  it('rejects a single bin, which would only copy it into one compartment', () => {
    const reason = expectErr(planMergedBin([bin('a', 0, 0, 1, 1)], layout));

    expect(reason.kind).toBe('too-few-bins');
    if (reason.kind === 'too-few-bins') expect(reason.count).toBe(1);
  });

  it('maps two side-by-side bins onto a 2x1 compartment grid', () => {
    const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

    expect(plan.params.width).toBe(2);
    expect(plan.params.depth).toBe(1);
    expect(plan.params.compartments.cols).toBe(2);
    expect(plan.params.compartments.rows).toBe(1);
    expect(plan.params.compartments.cells).toEqual([0, 1]);
    expect(plan.isRectangular).toBe(true);
    expect(plan.compartmentCount).toBe(2);
  });

  it('is translation invariant — the bounding box, not the drawer origin, sets the footprint', () => {
    const atOrigin = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));
    const offset = expectOk(planMergedBin([bin('a', 3, 2, 1, 1), bin('b', 4, 2, 1, 1)], layout));

    expect(offset.params.width).toBe(atOrigin.params.width);
    expect(offset.params.compartments).toEqual(atOrigin.params.compartments);
  });

  describe('cell resolution', () => {
    it('coarsens to the GCD so whole-unit bins do not burn compartment columns', () => {
      // Four grid units wide, but every edge lands on a 2-unit boundary.
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 2, 1), bin('b', 2, 0, 2, 1)], layout));

      expect(plan.params.width).toBe(4);
      expect(plan.params.compartments.cols).toBe(2);
    });

    it('falls to half-unit cells when a bin edge needs them', () => {
      const plan = expectOk(
        planMergedBin([bin('a', 0, 0, 0.5, 1), bin('b', 0.5, 0, 1.5, 1)], layout)
      );

      expect(plan.params.width).toBe(2);
      expect(plan.params.compartments.cols).toBe(4);
      expect(plan.params.compartments.cells).toEqual([0, 1, 1, 1]);
    });

    it('resolves each axis independently', () => {
      // X needs half-units; Y is happy at 1 unit.
      const plan = expectOk(
        planMergedBin([bin('a', 0, 0, 0.5, 2), bin('b', 0.5, 0, 0.5, 2)], layout)
      );

      expect(plan.params.compartments.cols).toBe(2);
      expect(plan.params.compartments.rows).toBe(1);
    });
  });

  describe('blocked selections', () => {
    it('blocks when the cell grid exceeds MAX_COMPARTMENT_GRID', () => {
      // 7 units of half-bins = 14 columns, over the limit of 12.
      const bins = Array.from({ length: 14 }, (_, i) => bin(`b${i}`, i * 0.5, 0, 0.5, 1));
      const reason = expectErr(planMergedBin(bins, layout));

      expect(reason.kind).toBe('grid-overflow');
      if (reason.kind === 'grid-overflow') {
        expect(reason.cols).toBe(14);
        expect(reason.max).toBe(12);
      }
    });

    it('blocks a footprint past MAX_DIMENSION', () => {
      const wide = createTestLayout({
        drawer: { width: gridUnits(40), depth: gridUnits(8), height: heightUnits(12) },
      });
      // Two 9-unit bins: an 18-unit span whose GCD keeps the grid at 2 columns,
      // so this reaches the size cap rather than tripping grid-overflow first.
      const reason = expectErr(planMergedBin([bin('a', 0, 0, 9, 1), bin('b', 9, 0, 9, 1)], wide));

      expect(reason.kind).toBe('too-large');
    });

    it('allows a rectangle up to MAX_DIMENSION, since no cellMask caps it at 10', () => {
      const wide = createTestLayout({
        drawer: { width: gridUnits(40), depth: gridUnits(8), height: heightUnits(12) },
      });
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 8, 1), bin('b', 8, 0, 8, 1)], wide));

      expect(plan.params.width).toBe(16);
      expect(plan.params.cellMask).toBeUndefined();
    });
  });

  describe('gaps', () => {
    it('turns an uncovered cell into its own compartment and flags the selection', () => {
      // Bottom-right unit empty.
      const plan = expectOk(
        planMergedBin([bin('a', 0, 0, 2, 1), bin('b', 0, 1, 1, 1), bin('c', 1, 1, 2, 1)], layout)
      );

      expect(plan.isRectangular).toBe(false);
      expect(plan.warnings.gapCompartmentCount).toBe(1);
      expect(plan.params.compartments.cols).toBe(3);
      // Every cell belongs to some compartment — no holes, no cellMask.
      expect(plan.params.compartments.cells).toHaveLength(6);
      expect(plan.params.cellMask).toBeUndefined();
    });

    it('extends a gap rectangle sideways rather than emitting one per cell', () => {
      // 3x2 bounding box; the top row's right two cells are uncovered.
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 3, 1), bin('b', 0, 1, 1, 1)], layout));

      expect(plan.warnings.gapCompartmentCount).toBe(1);
      expect(plan.compartmentCount).toBe(3);
    });

    it('extends a gap rectangle downwards too, not just along the row', () => {
      // 3x2 bounding box with a full-height 1x2 channel down the middle. The
      // stacked 1x1 bins on the left are what force two rows — two bins each
      // spanning the full depth would coarsen the Y axis to a single row.
      const plan = expectOk(
        planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 0, 1, 1, 1), bin('c', 2, 0, 1, 2)], layout)
      );

      expect(plan.params.compartments.cols).toBe(3);
      expect(plan.params.compartments.rows).toBe(2);
      // One 1x2 gap compartment, not two stacked single cells.
      expect(plan.warnings.gapCompartmentCount).toBe(1);
      expect(plan.compartmentCount).toBe(4);

      // And it really is one compartment spanning both rows.
      const { cells, cols } = plan.params.compartments;
      expect(cells[1]).toBe(cells[cols + 1]);
    });

    it('reports which compartment IDs are gaps, renumbered to match cells', () => {
      // 3x2 with the bottom-right unit empty.
      const plan = expectOk(
        planMergedBin([bin('a', 0, 0, 2, 1), bin('b', 0, 1, 1, 1), bin('c', 1, 1, 2, 1)], layout)
      );

      expect(plan.gapCompartmentIds).toHaveLength(1);
      // The ID has to index `cells` directly, i.e. it must be post-normalize.
      const gapId = plan.gapCompartmentIds[0];
      expect(plan.params.compartments.cells).toContain(gapId);
      // Bottom row, rightmost column is the empty unit.
      const { cells, cols } = plan.params.compartments;
      expect(cells[cols - 1]).toBe(gapId);
    });

    it('reports no gap IDs for a selection that tiles its bounding box', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

      expect(plan.gapCompartmentIds).toEqual([]);
    });

    it('never emits a cellMask, because a masked bin would export undivided', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 2, 2, 1, 1)], layout));

      expect(plan.params.cellMask).toBeUndefined();
      expect(plan.isRectangular).toBe(false);
    });
  });

  describe('height', () => {
    it('takes the tallest bin and reports the ones raised to meet it', () => {
      const plan = expectOk(
        planMergedBin(
          [
            bin('short', 0, 0, 1, 1, { height: heightUnits(3) }),
            bin('tall', 1, 0, 1, 1, { height: heightUnits(6) }),
          ],
          layout
        )
      );

      expect(plan.params.height).toBe(6);
      expect(plan.warnings.raisedHeightBinIds).toEqual([binId('short')]);
    });

    it('reports nothing raised when heights already agree', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

      expect(plan.warnings.raisedHeightBinIds).toEqual([]);
    });
  });

  describe('labels', () => {
    it('carries bin labels onto their compartments and enables tabs', () => {
      const plan = expectOk(
        planMergedBin(
          [bin('a', 0, 0, 1, 1, { label: 'Screws' }), bin('b', 1, 0, 1, 1, { label: 'Nuts' })],
          layout
        )
      );

      expect(plan.params.compartments.compartmentTexts).toEqual(['Screws', 'Nuts']);
      expect(plan.params.label.enabled).toBe(true);
    });

    it('keeps texts aligned with cells when scan order renumbers compartments', () => {
      // Listed top-row-first, but cells are built bottom-row-first, so the
      // compartment IDs come out in a different order than the input array.
      const plan = expectOk(
        planMergedBin(
          [
            bin('top', 0, 1, 1, 1, { label: 'TOP' }),
            bin('bottom', 0, 0, 1, 1, { label: 'BOTTOM' }),
          ],
          layout
        )
      );

      const { cells, compartmentTexts } = plan.params.compartments;
      // cells is row-major with row 0 at the bottom.
      expect(compartmentTexts?.[cells[0]]).toBe('BOTTOM');
      expect(compartmentTexts?.[cells[1]]).toBe('TOP');
    });

    it('leaves tabs off when no bin carries a label', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

      expect(plan.params.label.enabled).toBe(false);
      expect(plan.params.compartments.compartmentTexts).toBeUndefined();
    });
  });

  describe('warnings', () => {
    it('reports bins whose linked design geometry cannot be carried', () => {
      const plan = expectOk(
        planMergedBin(
          [
            bin('plain', 0, 0, 1, 1),
            bin('linked', 1, 0, 1, 1, { linkedDesignId: 'design_1' as Bin['linkedDesignId'] }),
          ],
          layout
        )
      );

      expect(plan.warnings.linkedDesignBinIds).toEqual([binId('linked')]);
    });
  });

  describe('print bed', () => {
    it('enables split connectors when the piece overruns the bed', () => {
      const small = createTestLayout({
        printBedSize: mm(180),
        drawer: { width: gridUnits(20), depth: gridUnits(8), height: heightUnits(12) },
      });
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 4, 1), bin('b', 4, 0, 4, 1)], small));

      expect(plan.warnings.splitEnabled).toBe(true);
      expect(plan.params.splitConnectors?.enabled).toBe(true);
      expect(plan.params.splitConnectors?.wallConnector).toBe('key');
    });

    it('leaves them alone when the piece fits', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

      expect(plan.warnings.splitEnabled).toBe(false);
    });

    it('checks depth against printBedDepth on a non-square bed', () => {
      const shallow = createTestLayout({
        printBedSize: mm(400),
        printBedDepth: mm(120),
        drawer: { width: gridUnits(20), depth: gridUnits(20), height: heightUnits(12) },
      });
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 4, 2), bin('b', 0, 2, 4, 2)], shallow));

      expect(plan.warnings.splitEnabled).toBe(true);
    });
  });

  describe('layout settings', () => {
    it('copies the grid and height pitch off the layout, not the drawer', () => {
      const custom = createTestLayout({
        gridUnitMm: mm(40),
        gridUnitMmY: mm(35),
        heightUnitMm: mm(6),
      });
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], custom));

      expect(plan.params.gridUnitMm).toBe(40);
      expect(plan.params.gridUnitMmY).toBe(35);
      expect(plan.params.heightUnitMm).toBe(6);
    });

    it('falls back to a square Y pitch when the layout has none', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

      expect(plan.params.gridUnitMmY).toBe(plan.params.gridUnitMm);
    });
  });

  describe('base style', () => {
    it('defaults to a Gridfinity base', () => {
      const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

      expect(plan.params.base.style).toBe('standard');
    });

    it('produces a socketless insert when asked for flat', () => {
      const plan = expectOk(
        planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout, { baseStyle: 'flat' })
      );

      expect(plan.params.base.style).toBe('flat');
    });
  });

  it('uses the designer default divider thickness', () => {
    const plan = expectOk(planMergedBin([bin('a', 0, 0, 1, 1), bin('b', 1, 0, 1, 1)], layout));

    expect(plan.params.compartments.thickness).toBe(1.2);
  });
});
