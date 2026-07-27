import { describe, it, expect } from 'vitest';
import { planLabelSockets, planLabelPlates } from './labelSocketPlan';
import type { CompartmentConfig, LabelTabConfig } from '@/shared/types/bin';

const CLEARANCE = 0.3;

function grid(
  cols: number,
  rows: number,
  cells: number[],
  extra?: Partial<CompartmentConfig>
): CompartmentConfig {
  return { cols, rows, thickness: 1.2, cells, ...extra };
}

function label(extra?: Partial<LabelTabConfig>): LabelTabConfig {
  return {
    enabled: true,
    mode: 'socket',
    support: 'bracket',
    depth: 12,
    width: 100,
    alignment: 'center',
    ...extra,
  };
}

/** Deep enough that a back+front pair never collides in these fixtures. */
const INNER_D = 100;

function plates(
  compartments: CompartmentConfig,
  innerWmm: number,
  extra?: {
    label?: Partial<LabelTabConfig>;
    innerDmm?: number;
    fallbackText?: string;
  }
): ReturnType<typeof planLabelPlates> {
  return planLabelPlates({
    compartments,
    label: label(extra?.label),
    innerWmm,
    innerDmm: extra?.innerDmm ?? INNER_D,
    clearanceMm: CLEARANCE,
    fallbackText: extra?.fallbackText ?? '',
  });
}

describe('planLabelSockets', () => {
  it('fits a 1U plate in a single-compartment 1U bin', () => {
    // 1U bin, default 1.2mm walls: innerW = 42 − 0.5 − 2.4 = 39.1mm.
    const plan = planLabelSockets(grid(1, 1, [0]), 39.1, CLEARANCE);
    expect(plan.compartments).toHaveLength(1);
    expect(plan.compartments[0]).toMatchObject({
      compartmentId: 0,
      autoWidthU: 1,
      plateWidthU: 1,
    });
    expect(plan.spanningWidthU).toBeNull();
    expect(plan.anyFits).toBe(true);
  });

  it('quantizes each compartment to the largest fitting width', () => {
    // 3U-wide bin (~123.1mm inner), one full-width compartment → 3U plate
    // needs 122.3mm; 2U in a 2-col split (~60.9mm each) fits only 1U.
    const wide = planLabelSockets(grid(1, 1, [0]), 123.1, CLEARANCE);
    expect(wide.compartments[0].plateWidthU).toBe(3);

    const halved = planLabelSockets(grid(2, 1, [0, 1]), 123.1, CLEARANCE);
    expect(halved.compartments.map((p) => p.plateWidthU)).toEqual([1, 1]);
  });

  it('deducts divider halves only at interior boundaries', () => {
    // 2 columns: each side loses thickness/2 = 0.6mm at the divider only.
    const plan = planLabelSockets(grid(2, 1, [0, 1]), 80, CLEARANCE);
    expect(plan.compartments[0].availableWidthMm).toBeCloseTo(39.4);
    expect(plan.compartments[1].availableWidthMm).toBeCloseTo(39.4);
  });

  it('spans merged columns as one compartment', () => {
    // 2×1 with both cells merged → one compartment spanning the full width
    // (a 2U socket needs 80.3mm: 78 + 0.3 clearance + 2×1 walls).
    const plan = planLabelSockets(grid(2, 1, [0, 0]), 81, CLEARANCE);
    expect(plan.compartments).toHaveLength(1);
    expect(plan.compartments[0].availableWidthMm).toBeCloseTo(81);
    expect(plan.compartments[0].plateWidthU).toBe(2);
  });

  it('honors a per-compartment override when it fits', () => {
    const plan = planLabelSockets(grid(1, 1, [0], { labelPlateWidths: [1] }), 123.1, CLEARANCE);
    expect(plan.compartments[0].autoWidthU).toBe(3);
    expect(plan.compartments[0].plateWidthU).toBe(1);
  });

  it('falls back to auto when the override no longer fits', () => {
    const plan = planLabelSockets(grid(1, 1, [0], { labelPlateWidths: [3] }), 39.1, CLEARANCE);
    expect(plan.compartments[0].plateWidthU).toBe(1);
  });

  it('falls back to one bin-spanning socket when no compartment fits', () => {
    // 4 columns across a 2U bin (~81.1mm inner): each column ~19.4mm — too
    // narrow for any plate — but the full interior hosts a 2U socket.
    const plan = planLabelSockets(grid(4, 1, [0, 1, 2, 3]), 81.1, CLEARANCE);
    expect(plan.compartments.every((p) => p.plateWidthU === null)).toBe(true);
    expect(plan.spanningWidthU).toBe(2);
    expect(plan.anyFits).toBe(true);
  });

  it('reports nothing fits for bins narrower than a 1U socket', () => {
    // Half-grid 0.5U bin: ~18.35mm inner — no standard plate fits anywhere.
    const plan = planLabelSockets(grid(1, 1, [0]), 18.35, CLEARANCE);
    expect(plan.compartments[0].plateWidthU).toBeNull();
    expect(plan.spanningWidthU).toBeNull();
    expect(plan.anyFits).toBe(false);
  });

  it('grows clearance shrinks what fits', () => {
    // 39.1mm hosts a 1U socket at 0.3 clearance (38.3) but not at 1.0 (39.0
    // still fits) — push to 1.2 so it tips over the edge.
    expect(planLabelSockets(grid(1, 1, [0]), 39.1, 1.2).anyFits).toBe(false);
  });
});

describe('planLabelPlates', () => {
  it('emits one plate per socketed compartment carrying its text', () => {
    expect(plates(grid(2, 1, [0, 1], { compartmentTexts: ['SCREWS', '  BOLTS '] }), 123.1)).toEqual(
      [
        { scope: 'compartment', compartmentId: 0, anchor: 'back', widthU: 1, text: 'SCREWS' },
        { scope: 'compartment', compartmentId: 1, anchor: 'back', widthU: 1, text: 'BOLTS' },
      ]
    );
  });

  it('skips compartments whose tab hosts no socket', () => {
    // 4 columns on a 3U bin: outer columns (~29mm) fit nothing; a merged
    // middle pair (~60mm) fits 1U.
    expect(plates(grid(4, 1, [0, 1, 1, 2], { compartmentTexts: ['A', 'B', 'C'] }), 123.1)).toEqual([
      { scope: 'compartment', compartmentId: 1, anchor: 'back', widthU: 1, text: 'B' },
    ]);
  });

  it('carries valid per-compartment icons and drops unknown ids', () => {
    expect(
      plates(
        grid(2, 1, [0, 1], {
          compartmentTexts: ['A', 'B'],
          labelIcons: ['bolt', 'not-a-real-icon'],
        }),
        123.1
      )
    ).toEqual([
      {
        scope: 'compartment',
        compartmentId: 0,
        anchor: 'back',
        widthU: 1,
        text: 'A',
        icon: 'bolt',
      },
      { scope: 'compartment', compartmentId: 1, anchor: 'back', widthU: 1, text: 'B' },
    ]);
  });

  it('emits a single fallback-text plate for the spanning socket', () => {
    expect(
      plates(grid(4, 1, [0, 1, 2, 3], { compartmentTexts: ['A', 'B', 'C', 'D'] }), 81.1, {
        fallbackText: ' Hardware ',
      })
    ).toEqual([{ scope: 'bin', anchor: 'back', widthU: 2, text: 'Hardware' }]);
  });

  it('emits no plates when nothing fits', () => {
    expect(plates(grid(1, 1, [0]), 18.35, { fallbackText: 'X' })).toEqual([]);
  });

  it('produces blank plates for compartments without text', () => {
    expect(plates(grid(1, 1, [0]), 39.1)).toEqual([
      { scope: 'compartment', compartmentId: 0, anchor: 'back', widthU: 1, text: '' },
    ]);
  });

  it('anchors the plate to the front wall for edges=front', () => {
    expect(
      plates(grid(1, 1, [0], { compartmentTexts: ['A'] }), 39.1, { label: { edges: 'front' } })
    ).toEqual([{ scope: 'compartment', compartmentId: 0, anchor: 'front', widthU: 1, text: 'A' }]);
  });

  // #2910: each compartment hosts a socket per edge, so it needs a plate per
  // edge. Shipping one plate for two sockets left users a sheet half short.
  it('emits a plate per edge for edges=both', () => {
    expect(
      plates(grid(2, 1, [0, 1], { compartmentTexts: ['A', 'B'] }), 123.1, {
        label: { edges: 'both' },
      })
    ).toEqual([
      { scope: 'compartment', compartmentId: 0, anchor: 'back', widthU: 1, text: 'A' },
      { scope: 'compartment', compartmentId: 0, anchor: 'front', widthU: 1, text: 'A' },
      { scope: 'compartment', compartmentId: 1, anchor: 'back', widthU: 1, text: 'B' },
      { scope: 'compartment', compartmentId: 1, anchor: 'front', widthU: 1, text: 'B' },
    ]);
  });

  it('drops the front plate where the back+front pair would collide', () => {
    // 2·depth + 2·inset = 24mm against a 20mm compartment: the worker drops
    // the front tab, so no plate may ship for it.
    expect(
      plates(grid(1, 1, [0], { compartmentTexts: ['A'] }), 39.1, {
        label: { edges: 'both' },
        innerDmm: 20,
      })
    ).toEqual([{ scope: 'compartment', compartmentId: 0, anchor: 'back', widthU: 1, text: 'A' }]);
  });

  it('drops both plates when the tab body is deeper than the compartment', () => {
    expect(plates(grid(1, 1, [0]), 39.1, { label: { edges: 'both' }, innerDmm: 10 })).toEqual([]);
  });

  it('counts each edge separately for the bin-spanning socket', () => {
    expect(
      plates(grid(4, 1, [0, 1, 2, 3]), 81.1, {
        label: { edges: 'both' },
        fallbackText: 'Hardware',
      })
    ).toEqual([
      { scope: 'bin', anchor: 'back', widthU: 2, text: 'Hardware' },
      { scope: 'bin', anchor: 'front', widthU: 2, text: 'Hardware' },
    ]);
  });

  it('drops the spanning front plate when the pair would collide across the bin', () => {
    expect(
      plates(grid(4, 1, [0, 1, 2, 3]), 81.1, {
        label: { edges: 'both' },
        innerDmm: 20,
        fallbackText: 'Hardware',
      })
    ).toEqual([{ scope: 'bin', anchor: 'back', widthU: 2, text: 'Hardware' }]);
  });

  describe('full-width mode', () => {
    it('emits one bin-wide plate per row, captioned from rowTexts', () => {
      expect(
        plates(grid(2, 2, [0, 1, 2, 3], { compartmentTexts: ['A', 'B', 'C', 'D'] }), 123.1, {
          label: { span: true, rowTexts: ['FRONT ROW', ' BACK ROW '] },
        })
      ).toEqual([
        { scope: 'row', row: 0, anchor: 'back', widthU: 3, text: 'FRONT ROW' },
        { scope: 'row', row: 1, anchor: 'back', widthU: 3, text: 'BACK ROW' },
      ]);
    });

    it('emits a plate per edge for edges=both', () => {
      expect(
        plates(grid(2, 1, [0, 1]), 123.1, {
          label: { span: true, edges: 'both', rowTexts: ['ONLY'] },
        })
      ).toEqual([
        { scope: 'row', row: 0, anchor: 'back', widthU: 3, text: 'ONLY' },
        { scope: 'row', row: 0, anchor: 'front', widthU: 3, text: 'ONLY' },
      ]);
    });

    it('skips rows whose compartments merge across the boundary', () => {
      // Column 0 runs straight through row 0 into row 1, so row 0's back edge
      // has no full-width wall to hang a shelf from.
      expect(
        plates(grid(2, 2, [0, 1, 0, 2]), 123.1, { label: { span: true, rowTexts: ['X', 'Y'] } })
      ).toEqual([{ scope: 'row', row: 1, anchor: 'back', widthU: 3, text: 'Y' }]);
    });
  });
});
