/**
 * Real-kernel checks for the divider fit sample. The wall section must be cut
 * exactly as the bin is, so it is measured against a real bin body, slot band
 * by slot band; the piece must carry the design's piece fit and seat in the
 * section without touching it.
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators dividerFitSample
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { box, intersect, isErr, measureVolume, mesh, rotate, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateSlotPositions,
  getDividerLockPlan,
  getEffectiveSlotDimensions,
  tabEngagement,
} from '@/shared/utils/slotMath';
import { LIP_TAPER_WIDTH } from './generatorConstants';
import {
  DIVIDER_FIT_PIECE_LENGTH,
  buildDividerFitPiece,
  buildDividerFitSample,
  buildDividerFitWall,
  exportDividerFitSample,
  planDividerFitSection,
} from './dividerFitSample';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function design(over: Partial<BinParams['dividerPieces']> = {}, base: Partial<BinParams> = {}) {
  return buildParams({
    style: 'slotted',
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, ...over },
    ...base,
  });
}

function volumeOf(solid: Shape3D, probe: Shape3D): number {
  const hit = intersect(solid, probe, { optimisation: 'none' });
  if (isErr(hit)) {
    if (hit.error.code === 'INTERSECT_NOT_3D') return 0;
    throw new Error(`${hit.error.code}: ${hit.error.message}`);
  }
  try {
    return unwrap(measureVolume(hit.value));
  } finally {
    hit.value.delete();
  }
}

/**
 * Open width across a probe box centred on (x, y): its span along Y less the
 * solid it holds, spread over its X × Z section.
 */
function openWidth(
  solid: Shape3D,
  x: number,
  depth: number,
  y: number,
  span: number,
  z0: number,
  z1: number
): number {
  const probe = box(depth, span, z1 - z0, { at: [x, y, (z0 + z1) / 2] });
  try {
    return span - volumeOf(solid, probe) / (depth * (z1 - z0));
  } finally {
    probe.delete();
  }
}

interface SlotProfile {
  readonly pocket: number;
  readonly throat: number;
  readonly upper: number;
  readonly belowSeat: number;
  readonly pastSlot: number;
  readonly groove: number;
  readonly underGroove: number;
}

/**
 * The slot's open width band by band. `inward` is +1 when the cavity is at -X
 * of the wall face at `faceX`, which is how the sample is built.
 */
function slotProfile(
  solid: Shape3D,
  params: BinParams,
  faceX: number,
  inward: 1 | -1,
  crossY: number,
  seatZ: number,
  floorTop: number
): SlotProfile {
  const { thickness, clearance } = params.dividerPieces;
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(
    params.wallThickness,
    thickness,
    clearance
  );
  const lock = getDividerLockPlan(thickness, clearance);
  const span = slotWidth + 2;
  const inWall = faceX + inward * slotDepth * 0.5;
  const depth = slotDepth * 0.5;
  const at = (z0: number, z1: number, x = inWall, d = depth): number =>
    openWidth(solid, x, d, crossY, span, z0, z1);
  const lockTop = seatZ + lock.headHeight + lock.throatHeight;
  return {
    pocket: at(seatZ + 0.1, seatZ + lock.headHeight - 0.1),
    throat: at(seatZ + lock.headHeight + 0.1, lockTop - 0.1),
    upper: at(lockTop + 0.5, lockTop + 3),
    belowSeat: at(seatZ - 0.5, seatZ - 0.1),
    pastSlot: at(lockTop + 0.5, lockTop + 3, faceX + inward * (slotDepth + 0.1), 0.1),
    groove: at(floorTop - 0.7, floorTop - 0.1, faceX - inward * 2.5, 1),
    underGroove: at(seatZ - 0.4, seatZ - 0.1, faceX - inward * 2.5, 1),
  };
}

describe('divider fit sample through the real kernel', () => {
  const cases: { name: string; params: BinParams }[] = [
    { name: 'default, groove on', params: design() },
    { name: 'groove off', params: design({ floorGroove: false }) },
    { name: 'thin, snug piece', params: design({ thickness: 1.2, clearance: 0.1 }) },
    {
      name: 'thick wall, flat base',
      params: design(
        {},
        { wallThickness: 2.4, base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' } }
      ),
    },
  ];

  for (const { name, params } of cases) {
    it(`cuts the section's slot exactly as the bin cuts it (${name})`, async () => {
      const { createInitialContext, runPipeline } = await import('./pipeline');
      const { shellStage } = await import('./pipeline/stages/shellStage');
      const { featuresStage } = await import('./pipeline/stages/featuresStage');
      const { booleanStage } = await import('./pipeline/stages/booleanStage');
      const ctx = runPipeline(
        [shellStage, featuresStage, booleanStage],
        createInitialContext(params, undefined, true)
      );
      const bin = ctx.solid;
      expect(bin).not.toBeNull();
      if (!bin) return;
      const dim = ctx.dimensions;
      const plan = planDividerFitSection(params);
      expect(plan.seat).toEqual({
        floorZ: dim.floorThickness,
        grooveDepth: dim.dividerGrooveDepth,
      });
      const seatZ = dim.floorThickness - dim.dividerGrooveDepth;

      const lipOverhang = dim.hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
      const [crossY] = calculateSlotPositions(dim.innerD, params.slotConfig.x.pitch, lipOverhang);
      expect(crossY).toBeDefined();
      const real = slotProfile(bin, params, -dim.innerW / 2, -1, crossY, seatZ, dim.floorThickness);

      const wall = buildDividerFitWall(params);
      try {
        const sample = slotProfile(wall, params, 0, 1, 0, seatZ, dim.floorThickness);
        for (const key of Object.keys(real) as (keyof SlotProfile)[]) {
          expect(sample[key], key).toBeCloseTo(real[key], 3);
        }
        // The probes read a real slot, not two solids that agree on nothing.
        const { slotWidth } = getEffectiveSlotDimensions(
          params.wallThickness,
          params.dividerPieces.thickness,
          params.dividerPieces.clearance
        );
        expect(sample.upper).toBeCloseTo(slotWidth, 3);
        expect(sample.belowSeat).toBeCloseTo(0, 3);
        expect(sample.pastSlot).toBeCloseTo(0, 3);
        expect(sample.groove).toBeCloseTo(params.dividerPieces.floorGroove ? slotWidth : 0, 3);
      } finally {
        wall.delete();
      }
    }, 120_000);
  }

  /**
   * Stand the flat piece up in the section: its +X end in the slot to its
   * engagement, its floor edge on the seat, and its thinned tab centred across
   * the slot. Lifted a hair so resting faces do not read as overlap.
   */
  function seated(params: BinParams, piece: Shape3D): Shape3D {
    const { seat, pieceHeight } = planDividerFitSection(params);
    const { thickness, clearance, pieceFit = 0 } = params.dividerPieces;
    const { slotDepth } = getEffectiveSlotDimensions(params.wallThickness, thickness, clearance);
    const engagement = tabEngagement(slotDepth, clearance);
    // +90 about X: the drawing's installed height becomes +Z, its thickness -Y.
    const upright = rotate(piece, 90, { axis: [1, 0, 0] });
    const placed = translate(upright, [
      engagement - DIVIDER_FIT_PIECE_LENGTH / 2,
      (thickness - 2 * pieceFit) / 2,
      seat.floorZ - seat.grooveDepth + pieceHeight / 2 + 0.001,
    ]);
    upright.delete();
    return placed;
  }

  for (const pieceFit of [0, 0.1]) {
    it(`seats the sample piece without touching the section (fit ${pieceFit})`, () => {
      const params = design({ pieceFit });
      const wall = buildDividerFitWall(params);
      const piece = buildDividerFitPiece(params);
      const placed = seated(params, piece);
      piece.delete();
      try {
        expect(volumeOf(wall, placed)).toBeLessThan(1e-4);
      } finally {
        wall.delete();
        placed.delete();
      }
    });
  }

  it('gives the piece the design fit, and the catch still holds at a small one', () => {
    const params = design({ pieceFit: 0.1 });
    const { thickness, clearance } = params.dividerPieces;
    const lock = getDividerLockPlan(thickness, clearance);
    const piece = buildDividerFitPiece(params);
    try {
      const m = mesh(piece, { tolerance: 0.01, angularTolerance: 0.3, cache: false });
      let xMax = -Infinity;
      let yMin = Infinity;
      for (let i = 0; i < m.vertices.length; i += 3) {
        xMax = Math.max(xMax, m.vertices[i]);
        yMin = Math.min(yMin, m.vertices[i + 1]);
      }
      // Solid across the head, just above the floor edge at the tip.
      const head = box(0.15, 0.3, 10, { at: [xMax - 0.1, yMin + 0.3, 0] });
      try {
        const headThickness = volumeOf(piece, head) / (0.15 * 0.3);
        expect(headThickness).toBeCloseTo(thickness - 0.2, 3);
        expect(headThickness).toBeGreaterThan(lock.throatWidth);
      } finally {
        head.delete();
      }
    } finally {
      piece.delete();
    }
  });

  it('refuses a bin with no slot to sample', () => {
    expect(() => buildDividerFitSample(design({}, { wallThickness: 0.6 }))).toThrow(
      /no divider slots/
    );
    expect(() => buildDividerFitSample(design({}, { style: 'standard' }))).toThrow(
      /no divider slots/
    );
  });

  it('exports both parts in one file', async () => {
    const params = design({ pieceFit: 0.1 });
    const parts = buildDividerFitSample(params);
    expect(parts).toHaveLength(2);
    for (const p of parts) p.delete();

    const stl = await exportDividerFitSample(params, 'stl');
    expect(stl.fileName).toBe('divider_fit_sample.stl');
    // 80-byte header, 4-byte count, 50 bytes per triangle.
    const triangles = new DataView(stl.data).getUint32(80, true);
    expect(triangles).toBeGreaterThan(0);
    expect(stl.data.byteLength).toBe(84 + 50 * triangles);

    const step = await exportDividerFitSample(params, 'step');
    expect(step.fileName).toBe('divider_fit_sample.step');
    expect(new TextDecoder().decode(step.data.slice(0, 13))).toBe('ISO-10303-21;');
  });
});
