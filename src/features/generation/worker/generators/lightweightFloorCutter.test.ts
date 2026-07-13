// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const cellOpts = () => ({
  gridUnitMm: 42,
  fractionalEdgeX: 'end' as const,
  fractionalEdgeY: 'end' as const,
});

describe('buildLightweightFloorCutters', () => {
  it('returns [] when lightweight is false', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildLightweightFloorCutters(2, 2, 3.25, 2, cellOpts(), false);
    expect(result).toEqual([]);
  });

  it('returns 4 cutters for 2x2 grid (1 per full cell)', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildLightweightFloorCutters(2, 2, 3.25, 2, cellOpts());
    expect(result).toHaveLength(4);
  });

  it('includes fractional cells with full floor cutout', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    // 1.5×1.5 = 1 full cell (cross cutout) + fractional cells (full rectangular cutout)
    const result = buildLightweightFloorCutters(1.5, 1.5, 3.25, 2, cellOpts());
    expect(result.length).toBeGreaterThan(1);
  });

  it('each cutter is a valid Shape3D with geometry', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const { mesh } = await import('brepjs');
    const result = buildLightweightFloorCutters(2, 2, 3.25, 2, cellOpts());
    for (const cutter of result) {
      expect(cutter).toBeDefined();
      const tessellated = mesh(cutter, { tolerance: 0.5, angularTolerance: 15 });
      expect(tessellated.vertices.length).toBeGreaterThan(0);
    }
  });

  it('returns [] when pad exceeds half cell (arms too narrow)', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    // magnetRadius=19 -> padHalf=21, hw=42/2=21, arm=21-21=0 < MIN_ARM_WIDTH
    const result = buildLightweightFloorCutters(1, 1, 19, 2, cellOpts());
    expect(result).toEqual([]);
  });

  it('emits one valid 4-arm cross cutter for a full cell at pitch 50 (no stranded magnet)', async () => {
    const { buildLightweightFloorCutters } = await import('./lightweightFloorCutter');
    const { mesh } = await import('brepjs');
    // Outer-arm guard (hw − padHalf ≥ MIN_ARM_WIDTH) still passes on the larger
    // cell, so the single full cell yields one cross cutter with real geometry —
    // pads land on the ±17 magnets rather than carving through them.
    const opts = {
      gridUnitMm: 50,
      fractionalEdgeX: 'end' as const,
      fractionalEdgeY: 'end' as const,
    };
    const result = buildLightweightFloorCutters(1, 1, MAGNET_R, 2, opts);
    expect(result).toHaveLength(1);
    const tessellated = mesh(result[0], { tolerance: 0.5, angularTolerance: 15 });
    expect(tessellated.vertices.length).toBeGreaterThan(0);
  });
});

const GRID = 42;
const MAGNET_R = 6.5 / 2; // standard 6.5mm magnet

type Cell = { widthUnits: number; depthUnits: number; centerX: number; centerY: number };
function cell(widthUnits: number, depthUnits: number, centerX = 0, centerY = 0): Cell {
  return { widthUnits, depthUnits, centerX, centerY };
}

describe('planPartialCellFloorCuts (over-tile margin hollowing)', () => {
  it('hollows a narrow-tall tile into two end pads (side strips + center gap) — 25×42', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    // Short axis (X, 25mm) has room → remove the L/R strips; the two magnets
    // straddle Y → also remove the center gap between their pads. Result: a pad
    // around each magnet, everything else open (prints as sparse infill).
    const cuts = planPartialCellFloorCuts(cell(25 / GRID, 1), MAGNET_R, GRID);
    expect(cuts).toHaveLength(3);
    expect(cuts.every((c) => c.kind === 'rect')).toBe(true);
    for (const c of cuts) if (c.kind === 'rect') expect(c.centerY).toBeCloseTo(0, 6);
    const centered = cuts.filter((c) => Math.abs(c.centerX) < 1e-6);
    const strips = cuts.filter((c) => Math.abs(c.centerX) > 1e-6);
    expect(centered).toHaveLength(1); // center gap, on the tile axis
    expect(strips).toHaveLength(2); // left + right side strips
    expect(strips[0].centerX * strips[1].centerX).toBeLessThan(0); // opposite sides
  });

  it('hollows the center gap of a wide-short tile too thin to strip — 42×13', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    // Short axis (Y, 13mm) can't be stripped, but two magnets straddle X → remove
    // the single center gap between their pads.
    const cuts = planPartialCellFloorCuts(cell(1, 13 / GRID), MAGNET_R, GRID);
    expect(cuts).toHaveLength(1);
    const c = cuts[0];
    expect(c.kind).toBe('rect');
    if (c.kind === 'rect') {
      expect(c.centerX).toBeCloseTo(0, 6);
      expect(c.centerY).toBeCloseTo(0, 6);
      expect(c.width).toBeGreaterThan(2); // meaningful hollow between the magnets
    }
  });

  it('opens left/right of a lone-magnet square tile, padding the magnet — 25×25', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    // One centered magnet with room on both axes → hollow left/right (tie → X),
    // keeping a vertical pad through the magnet (strips offset in X, centered Y).
    const cuts = planPartialCellFloorCuts(cell(25 / GRID, 25 / GRID), MAGNET_R, GRID);
    expect(cuts).toHaveLength(2);
    for (const c of cuts) if (c.kind === 'rect') expect(c.centerY).toBeCloseTo(0, 6);
    const xs = cuts.map((c) => c.centerX).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[1]).toBeGreaterThan(0);
  });

  it('opens left/right of a lone-magnet corner tile too short to strip — 25×13', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    // Short axis (Y, 13mm) can't be stripped, but the wide axis has room → open
    // left/right, keeping a full-height pad around the centered magnet (rather
    // than leaving the whole corner tile solid).
    const cuts = planPartialCellFloorCuts(cell(25 / GRID, 13 / GRID), MAGNET_R, GRID);
    expect(cuts).toHaveLength(2);
    for (const c of cuts) if (c.kind === 'rect') expect(c.centerY).toBeCloseTo(0, 6);
    const xs = cuts.map((c) => c.centerX).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(0); // left open
    expect(xs[1]).toBeGreaterThan(0); // right open
  });

  it('keeps a single spine for a very long narrow foot (all magnets ride it) — 25×84', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    // Three magnets along Y, all on one spine → still just the two X-side strips.
    const cuts = planPartialCellFloorCuts(cell(25 / GRID, 2), MAGNET_R, GRID);
    expect(cuts).toHaveLength(2);
    for (const c of cuts) if (c.kind === 'rect') expect(c.centerY).toBeCloseTo(0, 6);
    const xs = cuts.map((c) => c.centerX).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(0);
    expect(xs[1]).toBeGreaterThan(0);
  });

  it('uses a cross cut for a standard-fits partial tile — 0.95×0.95', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    const cuts = planPartialCellFloorCuts(cell(0.95, 0.95), MAGNET_R, GRID);
    expect(cuts).toHaveLength(1);
    expect(cuts[0].kind).toBe('cross');
  });

  it('cross pads follow the pulled-in magnet offset, not a fixed ±13', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    const { magnetPositionsForCell } = await import('./baseplateMagnets');
    // A 0.95u (39.9mm) tile pulls magnets in to hold the 8mm wall inset, so the
    // cross pad half-width must track that offset (else it carves the magnets).
    const c = cell(0.95, 0.95);
    const cuts = planPartialCellFloorCuts(c, MAGNET_R, GRID);
    const cross = cuts[0];
    expect(cross.kind).toBe('cross');
    if (cross.kind !== 'cross') throw new Error('expected cross');
    const off = Math.abs(magnetPositionsForCell(c, MAGNET_R, GRID, GRID)[0][0]);
    // padHalf = offset − magnetRadius − PAD_MARGIN(1); pulled in below the ±13 value.
    expect(cross.padHalfX).toBeCloseTo(off - MAGNET_R - 1, 6);
    expect(cross.padHalfX).toBeLessThan(13 - MAGNET_R - 1);
  });

  it('keeps a 3-perimeter pad margin around magnet holes for a 0.8mm nozzle', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    const cuts = planPartialCellFloorCuts(cell(1, 1), MAGNET_R, GRID, 0.8);
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({
      kind: 'cross',
      padHalfX: 13 - MAGNET_R - 2.5,
      padHalfY: 13 - MAGNET_R - 2.5,
    });
  });

  it('contracts the outer relief edge for a wide nozzle without moving magnet centers', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    const { magnetPositionsForCell } = await import('./baseplateMagnets');
    const c = cell(1, 1);
    const cuts = planPartialCellFloorCuts(c, MAGNET_R, GRID, 0.8);
    const cross = cuts[0];
    expect(cross.kind).toBe('cross');
    if (cross.kind !== 'cross') throw new Error('expected cross');

    // 42/2 - INSET_BOT(2.95) - outer margin(2.5) = 15.55mm.
    expect(cross.hw).toBeCloseTo(15.55, 6);
    expect(cross.hd).toBeCloseTo(15.55, 6);
    expect(magnetPositionsForCell(c, MAGNET_R, GRID, GRID)).toEqual([
      [-13, -13],
      [13, -13],
      [13, 13],
      [-13, 13],
    ]);
  });

  it('a full 42mm tile keeps the standard cross pad (byte-identical)', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    const cuts = planPartialCellFloorCuts(cell(1, 1), MAGNET_R, GRID);
    const cross = cuts[0];
    if (cross.kind !== 'cross') throw new Error('expected cross');
    // offset 13 → padHalf = 13 − 3.25 − 1 = 8.75, unchanged from the old constant.
    expect(cross.padHalfX).toBeCloseTo(8.75, 6);
    expect(cross.padHalfY).toBeCloseTo(8.75, 6);
  });

  it('leaves a too-tiny tile solid (no cuts)', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    expect(planPartialCellFloorCuts(cell(0.1, 0.1), MAGNET_R, GRID)).toEqual([]);
  });

  it('offsets cuts to a non-origin tile center', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    const cuts = planPartialCellFloorCuts(cell(25 / GRID, 1, 100, 40), MAGNET_R, GRID);
    expect(cuts).toHaveLength(3);
    for (const c of cuts) if (c.kind === 'rect') expect(c.centerY).toBeCloseTo(40, 6);
    const xs = cuts.map((c) => c.centerX);
    expect(Math.min(...xs)).toBeLessThan(100);
    expect(Math.max(...xs)).toBeGreaterThan(100);
    expect(xs.filter((x) => Math.abs(x - 100) < 1e-6)).toHaveLength(1); // gap on axis
  });

  it('applies per-axis pitch: a non-square {x,y} tile matches its square-equivalent', async () => {
    const { planPartialCellFloorCuts } = await import('./lightweightFloorCutter');
    // A unit-square tile under a 42×21 anisotropic pitch is physically 42×21 —
    // identical to a 1×0.5 tile under a square 42 pitch. The cuts must match; if
    // the planner used the X pitch for both axes it would model a 42×42 tile and
    // produce different geometry. Guards the per-axis resolvePitch wiring.
    const nonSquare = planPartialCellFloorCuts(cell(1, 1), MAGNET_R, { x: GRID, y: GRID / 2 });
    const squareEquivalent = planPartialCellFloorCuts(cell(1, 0.5), MAGNET_R, GRID);
    expect(nonSquare).toEqual(squareEquivalent);
    // Sanity: this tile is short enough on Y to actually get hollowed (non-empty).
    expect(nonSquare.length).toBeGreaterThan(0);
  });
});

describe('buildPartialCellFloorCutters (BREP solids)', () => {
  it('returns [] when lightweight is false', async () => {
    const { buildPartialCellFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildPartialCellFloorCutters([cell(25 / GRID, 1)], MAGNET_R, 2, GRID, false);
    expect(result).toEqual([]);
  });

  it('builds side-strip + center-gap cutters for a 25×42 margin tile (pads only)', async () => {
    const { buildPartialCellFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildPartialCellFloorCutters([cell(25 / GRID, 1)], MAGNET_R, 2, GRID);
    expect(result).toHaveLength(3);
  });

  it('builds one center-gap cutter for a 42×13 margin tile', async () => {
    const { buildPartialCellFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildPartialCellFloorCutters([cell(1, 13 / GRID)], MAGNET_R, 2, GRID);
    expect(result).toHaveLength(1);
  });

  it('builds no cutter for a tile too small to hollow', async () => {
    const { buildPartialCellFloorCutters } = await import('./lightweightFloorCutter');
    const result = buildPartialCellFloorCutters([cell(0.1, 0.1)], MAGNET_R, 2, GRID);
    expect(result).toEqual([]);
  });

  it('each cutter is a valid Shape3D with geometry', async () => {
    const { buildPartialCellFloorCutters } = await import('./lightweightFloorCutter');
    const { mesh } = await import('brepjs');
    const result = buildPartialCellFloorCutters([cell(25 / GRID, 1)], MAGNET_R, 2, GRID);
    for (const cutter of result) {
      const tessellated = mesh(cutter, { tolerance: 0.5, angularTolerance: 15 });
      expect(tessellated.vertices.length).toBeGreaterThan(0);
    }
  });
});
