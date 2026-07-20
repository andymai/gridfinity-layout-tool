import { describe, it, expect } from 'vitest';
import { planLabelSockets } from './labelSocketPlan';
import type { CompartmentConfig } from '@/shared/types/bin';

const CLEARANCE = 0.3;

function grid(
  cols: number,
  rows: number,
  cells: number[],
  extra?: Partial<CompartmentConfig>
): CompartmentConfig {
  return { cols, rows, thickness: 1.2, cells, ...extra };
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
