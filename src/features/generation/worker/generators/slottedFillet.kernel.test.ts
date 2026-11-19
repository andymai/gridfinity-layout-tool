/**
 * Real-kernel checks for the interior fillet in a bin with removable dividers.
 *
 * The fillet rounds the outer walls; each wall slot carries a channel that
 * follows the fillet's curve down to the seat, and each piece end that seats
 * in a wall slot carries a rounded bottom corner. A bin whose slot is plugged
 * by the fillet and one whose channel is cut square both export watertight, so
 * these probe the solid itself: the channel open along the curve, the corner
 * behind it solid, and a real piece set into the real bin overlapping nothing.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D, ValidSolid } from 'brepjs';
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
import { cornerRiseMm, resolveDividerFilletSeat } from '@/shared/utils/slottedFillet';
import type { DividerFilletSeat } from '@/shared/utils/slottedFillet';
import { LIP_TAPER_WIDTH } from './generatorConstants';
import type { BinDimensions } from './pipeline/types';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

function slottedFillet(overrides: Partial<BinParams> = {}): BinParams {
  return buildParams({
    width: 2,
    depth: 2,
    height: 5,
    style: 'slotted',
    interiorFilletMm: 2.5,
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    ...overrides,
  });
}

interface Built {
  readonly bin: Shape3D;
  readonly dim: BinDimensions;
  readonly seat: DividerFilletSeat;
}

async function buildBody(params: BinParams): Promise<Built> {
  const { createInitialContext, runPipeline } = await import('./pipeline');
  const { shellStage } = await import('./pipeline/stages/shellStage');
  const { featuresStage } = await import('./pipeline/stages/featuresStage');
  const { booleanStage } = await import('./pipeline/stages/booleanStage');
  const ctx = runPipeline(
    [shellStage, featuresStage, booleanStage],
    createInitialContext(params, undefined, true)
  );
  const bin = ctx.solid;
  if (!bin) throw new Error('no bin');
  const dim = ctx.dimensions;
  const seat = resolveDividerFilletSeat(params, {
    innerW: dim.innerW,
    innerD: dim.innerD,
    wallHeight: dim.wallHeight,
    hasLip: dim.hasLip,
  });
  if (!seat) throw new Error('no fillet seat');
  return { bin, dim, seat };
}

async function solidFraction(
  shape: Shape3D,
  size: [number, number, number],
  at: [number, number, number]
): Promise<number> {
  const { box, intersect, isErr, measureVolume, unwrap } = await import('brepjs');
  const probe = box(size[0], size[1], size[2], { at });
  try {
    const hit = intersect(shape, probe, { optimisation: 'none' });
    if (isErr(hit)) {
      if (hit.error.code === 'INTERSECT_NOT_3D') return 0;
      throw new Error(`${hit.error.code}: ${hit.error.message}`);
    }
    try {
      return unwrap(measureVolume(hit.value)) / (size[0] * size[1] * size[2]);
    } finally {
      hit.value.delete();
    }
  } finally {
    probe.delete();
  }
}

/** The first X-axis slot's centre, and the inner face of the left wall. */
function firstSlot(params: BinParams, dim: BinDimensions): { crossY: number; wallX: number } {
  const lipOverhang = dim.hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
  const [crossY] = calculateSlotPositions(dim.innerD, params.slotConfig.x.pitch, lipOverhang);
  return { crossY, wallX: -dim.innerW / 2 };
}

const PROBE = 0.12;

describe('a wall slot follows the interior fillet', () => {
  for (const floorGroove of [true, false]) {
    it(`opens a channel along the fillet's curve to the seat (groove ${floorGroove ? 'on' : 'off'})`, async () => {
      const params = slottedFillet({
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove },
      });
      const { bin, dim, seat } = await buildBody(params);
      try {
        const { crossY, wallX } = firstSlot(params, dim);
        const floorTop = dim.floorThickness;
        const seatZ = floorTop - dim.dividerGrooveDepth;
        const { slotDepth } = getEffectiveSlotDimensions(
          params.wallThickness,
          params.dividerPieces.thickness,
          params.dividerPieces.clearance
        );
        const r = seat.filletRadius;
        const rc = seat.channelRadius;
        // Section frame: u in from the wall face, z in the body frame.
        const at = (u: number, z: number, y: number): [number, number, number] => [wallX + u, y, z];
        const rise = (u: number): number => r - Math.sqrt(r * r - (r - u) * (r - u));
        const cube: [number, number, number] = [PROBE, PROBE, PROBE];

        const centre = { u: rc - slotDepth, z: seatZ + rc };
        const channelZ = (u: number): number =>
          centre.z - Math.sqrt(rc * rc - (centre.u - u) * (centre.u - u));
        // Midway between the channel's curve and the fillet's surface.
        const u = 0.3;
        const filletZ = floorTop + rise(u);
        const midZ = (Math.max(channelZ(u), floorTop) + filletZ) / 2;
        expect(filletZ - channelZ(u)).toBeGreaterThan(0.3);

        // Away from the slot the outer wall is rounded.
        const beside = crossY + 8;
        expect(
          await solidFraction(bin, cube, at(u, midZ, beside)),
          'fillet beside the slot'
        ).toBeGreaterThan(0.95);

        // In the slot, the same spot is open: the channel runs through the fillet.
        expect(
          await solidFraction(bin, cube, at(u, midZ, crossY)),
          'fillet left standing in the slot'
        ).toBeLessThan(0.05);

        // Just inside the channel's curve, all the way round, is open; just
        // behind it is solid, so the channel is curved, not cut square.
        for (const deg of [195, 225, 255]) {
          const a = (deg * Math.PI) / 180;
          const inside = at(
            centre.u + (rc - 0.2) * Math.cos(a),
            centre.z + (rc - 0.2) * Math.sin(a),
            crossY
          );
          const behind = at(
            centre.u + (rc + 0.2) * Math.cos(a),
            centre.z + (rc + 0.2) * Math.sin(a),
            crossY
          );
          expect(await solidFraction(bin, cube, inside), `channel at ${deg}°`).toBeLessThan(0.05);
          expect(await solidFraction(bin, cube, behind), `corner at ${deg}°`).toBeGreaterThan(0.95);
        }

        // The lock sits above the curve, where the tab is straight.
        const lock = getDividerLockPlan(
          params.dividerPieces.thickness,
          params.dividerPieces.clearance
        );
        const throatZ = seatZ + seat.lockLift + lock.headHeight + lock.throatHeight / 2;
        const nubY = crossY + (lock.throatWidth + lock.pocketWidth) / 4;
        const nubWidth = (lock.pocketWidth - lock.throatWidth) / 2;
        expect(
          await solidFraction(
            bin,
            [slotDepth * 0.5, nubWidth * 0.6, lock.throatHeight * 0.6],
            at(-slotDepth / 2, throatZ, nubY)
          ),
          'throat nub'
        ).toBeGreaterThan(0.9);
        // Below the throat the slot is open at full width, so the head passes.
        expect(
          await solidFraction(
            bin,
            [slotDepth * 0.5, nubWidth * 0.6, lock.headHeight * 0.6],
            at(-slotDepth / 2, throatZ - lock.throatHeight / 2 - lock.headHeight / 2, nubY)
          ),
          'head pocket'
        ).toBeLessThan(0.05);

        const { getSolids } = await import('brepjs');
        expect(getSolids(bin)).toHaveLength(1);
      } finally {
        bin.delete();
      }
    }, 120_000);
  }
});

/**
 * Stand a flat piece up in the bin: the flat frame's X runs along the width,
 * its Y (installed height) becomes Z with the bottom edge on the seat, and its
 * Z (thickness) becomes Y, centred on the slot.
 */
async function seatX(
  piece: Shape3D,
  height: number,
  thickness: number,
  crossY: number,
  seatZ: number
): Promise<Shape3D> {
  const { rotate, translate } = await import('brepjs');
  const up = rotate(piece, 90, { axis: [1, 0, 0] });
  try {
    return translate(up, [0, crossY + thickness / 2, seatZ + height / 2]);
  } finally {
    up.delete();
  }
}

async function overlap(a: Shape3D, b: Shape3D): Promise<number> {
  const { intersect, isErr, measureVolume, unwrap } = await import('brepjs');
  const hit = intersect(a as ValidSolid, b as ValidSolid, { optimisation: 'none' });
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

describe('a removable piece seats over the interior fillet', () => {
  for (const floorGroove of [true, false]) {
    it(`sets into its slot touching nothing (groove ${floorGroove ? 'on' : 'off'})`, async () => {
      const { buildUniqueDividerPieces } = await import('./dividerBuilder');
      const { getBounds, getSolids } = await import('brepjs');
      const params = slottedFillet({
        dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove },
      });
      const { bin, dim } = await buildBody(params);
      const pieces = buildUniqueDividerPieces(
        params,
        dim.innerW,
        dim.innerD,
        dim.wallHeight,
        dim.hasLip
      );
      try {
        expect(pieces).toHaveLength(1);
        const piece = pieces[0].shape;
        expect(getSolids(piece)).toHaveLength(1);
        const b = getBounds(piece);
        const height = b.yMax - b.yMin;
        const { crossY } = firstSlot(params, dim);
        const seatZ = dim.floorThickness - dim.dividerGrooveDepth;
        const seated = await seatX(piece, height, params.dividerPieces.thickness, crossY, seatZ);
        try {
          expect(await overlap(bin, seated)).toBeLessThan(0.01);
        } finally {
          seated.delete();
        }
      } finally {
        bin.delete();
        for (const p of pieces) p.shape.delete();
      }
    }, 120_000);
  }
});

describe('a short piece over a lifted throat', () => {
  it('relieves its neck when its top reaches into the throat band', async () => {
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');
    const { getBounds } = await import('brepjs');
    const params = slottedFillet({
      interiorFilletMm: 4,
      dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, height: 6 },
    });
    const { bin, dim } = await buildBody(params);
    const pieces = buildUniqueDividerPieces(
      params,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      dim.hasLip
    );
    try {
      const piece = pieces[0].shape;
      const b = getBounds(piece);
      const { crossY } = firstSlot(params, dim);
      const seatZ = dim.floorThickness - dim.dividerGrooveDepth;
      const seated = await seatX(
        piece,
        b.yMax - b.yMin,
        params.dividerPieces.thickness,
        crossY,
        seatZ
      );
      try {
        expect(await overlap(bin, seated)).toBeLessThan(0.01);
      } finally {
        seated.delete();
      }
    } finally {
      bin.delete();
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);
});

describe('the piece fit over a rounded corner', () => {
  it('thins the curved seat as well as the straight ones', async () => {
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');
    const { box, getBounds, intersect, unwrap } = await import('brepjs');
    const pieceFit = 0.15;
    const params = slottedFillet({
      interiorFilletMm: 6,
      dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, pieceFit },
    });
    const { bin, dim, seat } = await buildBody(params);
    bin.delete();
    const pieces = buildUniqueDividerPieces(
      params,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      dim.hasLip
    );
    try {
      const piece = pieces[0].shape;
      const b = getBounds(piece);
      const r = seat.cornerRadius;
      // Inside the rounded corner, past the straight end band and above the groove band.
      const probe = box(0.4, 0.4, 10, { at: [b.xMax - r / 2, b.yMin + r / 2, 0] });
      const hit = unwrap(intersect(piece as ValidSolid, probe));
      try {
        const thickness = params.dividerPieces.thickness;
        expect(getBounds(hit).zMax).toBeCloseTo(thickness - 2 * pieceFit, 3);
      } finally {
        hit.delete();
        probe.delete();
      }
    } finally {
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);
});

/**
 * Stand a flat piece up along Y: its length runs along the depth, its
 * thickness along X, centred on the line at `crossX`.
 */
async function seatY(
  piece: Shape3D,
  height: number,
  thickness: number,
  crossX: number,
  alongY: number,
  seatZ: number
): Promise<Shape3D> {
  const { rotate, translate } = await import('brepjs');
  const up = rotate(piece, 90, { axis: [1, 0, 0] });
  const turned = rotate(up, 90, { axis: [0, 0, 1] });
  up.delete();
  try {
    return translate(turned, [crossX - thickness / 2, alongY, seatZ + height / 2]);
  } finally {
    turned.delete();
  }
}

/** The flat piece moved so its own bounds start at the origin's centre line. */
async function centred(
  piece: Shape3D
): Promise<{ shape: Shape3D; length: number; height: number }> {
  const { getBounds, translate } = await import('brepjs');
  const b = getBounds(piece);
  const shape = translate(piece, [-(b.xMin + b.xMax) / 2, -(b.yMin + b.yMax) / 2, 0]);
  return { shape, length: b.xMax - b.xMin, height: b.yMax - b.yMin };
}

/** Whether each bottom corner of a flat piece is rounded away. */
async function roundedEnds(piece: Shape3D): Promise<{ low: boolean; high: boolean }> {
  const { getBounds } = await import('brepjs');
  const b = getBounds(piece);
  const z = (b.zMin + b.zMax) / 2;
  const cube: [number, number, number] = [0.1, 0.1, 0.1];
  const low = await solidFraction(piece, cube, [b.xMin + 0.25, b.yMin + 0.25, z]);
  const high = await solidFraction(piece, cube, [b.xMax - 0.25, b.yMin + 0.25, z]);
  return { low: low < 0.05, high: high < 0.05 };
}

describe('every piece type rounds the ends that seat in a wall slot', () => {
  const both = (crossStyle: 'lap' | 'insert', extra: Partial<BinParams['slotConfig']> = {}) =>
    slottedFillet({
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
        crossStyle,
        ...extra,
      },
    });
  const cases: { name: string; params: BinParams; ends: Record<string, [boolean, boolean]> }[] = [
    {
      name: 'interlocking (lap) pieces',
      params: both('lap'),
      ends: { 'divider-horizontal': [true, true], 'divider-vertical': [true, true] },
    },
    {
      name: 'snappable lap pieces',
      params: both('lap', { partialStyle: 'snappable' }),
      ends: { 'divider-horizontal': [true, true], 'divider-vertical': [true, true] },
    },
    {
      name: 'insert long and short pieces',
      params: both('insert'),
      ends: {
        'divider-vertical': [true, true],
        'divider-horizontal-compartment': [false, false],
        'divider-horizontal-compartment-edge': [true, false],
      },
    },
    {
      name: 'a partial-length set',
      params: both('lap', { partialStyle: 'lengthSet' }),
      ends: {
        'divider-horizontal': [true, true],
        'divider-horizontal-1u': [true, false],
        'divider-horizontal-1u-mid': [false, false],
      },
    },
  ];

  for (const c of cases) {
    it(
      c.name,
      async () => {
        const { buildUniqueDividerPieces } = await import('./dividerBuilder');
        const { getSolids } = await import('brepjs');
        const { deriveDimensions } = await import('./pipeline/context');
        const dim = deriveDimensions(c.params, true);
        const pieces = buildUniqueDividerPieces(
          c.params,
          dim.innerW,
          dim.innerD,
          dim.wallHeight,
          dim.hasLip
        );
        try {
          const seen = new Set<string>();
          for (const piece of pieces) {
            expect(getSolids(piece.shape), `${piece.label} came apart`).toHaveLength(1);
            const expected = c.ends[piece.label];
            if (!expected) continue;
            seen.add(piece.label);
            const ends = await roundedEnds(piece.shape);
            expect([ends.low, ends.high], piece.label).toEqual(expected);
          }
          expect([...seen].sort()).toEqual(Object.keys(c.ends).sort());
        } finally {
          for (const p of pieces) p.shape.delete();
        }
      },
      120_000
    );
  }

  it('both lap pieces of a crossing set into the bin touching nothing', async () => {
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');
    const params = both('lap');
    const { bin, dim } = await buildBody(params);
    const pieces = buildUniqueDividerPieces(
      params,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      dim.hasLip
    );
    try {
      const lipOverhang = dim.hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
      const [crossY] = calculateSlotPositions(dim.innerD, 20, lipOverhang);
      const [crossX] = calculateSlotPositions(dim.innerW, 20, lipOverhang);
      const seatZ = dim.floorThickness - dim.dividerGrooveDepth;
      const t = params.dividerPieces.thickness;
      for (const piece of pieces) {
        const flat = await centred(piece.shape);
        const seated =
          piece.label === 'divider-horizontal'
            ? await seatX(flat.shape, flat.height, t, crossY, seatZ)
            : await seatY(flat.shape, flat.height, t, crossX, 0, seatZ);
        flat.shape.delete();
        try {
          expect(await overlap(bin, seated), piece.label).toBeLessThan(0.01);
        } finally {
          seated.delete();
        }
      }
    } finally {
      bin.delete();
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);
});

describe('a custom layout with a divider near a corner', () => {
  it('holds the fillet clear of the divider, and its piece seats in the channel', async () => {
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');
    // A line 13.5mm in from the left wall, under a fillet asked for at 12mm.
    const params = slottedFillet({
      interiorFilletMm: 12,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        layout: 'custom',
        customGrid: { cols: 6, rows: 1, cells: [0, 1, 1, 1, 1, 2] },
      },
    });
    const { bin, dim, seat } = await buildBody(params);
    const pieces = buildUniqueDividerPieces(
      params,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      dim.hasLip
    );
    try {
      const t = params.dividerPieces.thickness;
      const lineX = -dim.innerW / 2 + dim.innerW / 6;
      // The piece's corner, not just the fillet, ends short of the line.
      expect(seat.filletRadius).toBeLessThan(12);
      expect(seat.cornerRadius).toBeLessThanOrEqual(dim.innerW / 6 - t / 2 - 0.2 + 1e-9);

      // The front wall's channel at that line is open just inside its curve.
      const { slotDepth } = getEffectiveSlotDimensions(
        params.wallThickness,
        t,
        params.dividerPieces.clearance
      );
      const seatZ = dim.floorThickness - dim.dividerGrooveDepth;
      const rc = seat.channelRadius;
      const a = (225 * Math.PI) / 180;
      const v = rc - slotDepth + (rc - 0.2) * Math.cos(a);
      const z = seatZ + rc + (rc - 0.2) * Math.sin(a);
      expect(
        await solidFraction(bin, [PROBE, PROBE, PROBE], [lineX, -dim.innerD / 2 + v, z])
      ).toBeLessThan(0.05);

      const first = pieces.find((p) => p.label === 'divider-01');
      expect(first).toBeDefined();
      if (!first) return;
      expect(await roundedEnds(first.shape)).toEqual({ low: true, high: true });
      const flat = await centred(first.shape);
      const seated = await seatY(flat.shape, flat.height, t, lineX, 0, seatZ);
      flat.shape.delete();
      try {
        expect(await overlap(bin, seated)).toBeLessThan(0.01);
      } finally {
        seated.delete();
      }
    } finally {
      bin.delete();
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);
});

describe('an interior cutout over a rounded corner', () => {
  it('keeps solid above the curve, so the end of the piece stays tied on', async () => {
    const { buildUniqueDividerPieces } = await import('./dividerBuilder');
    const { getBounds, getSolids } = await import('brepjs');
    const walls = DEFAULT_BIN_PARAMS.walls;
    const params = slottedFillet({
      walls: {
        ...walls,
        enabled: true,
        shape: 'u-shape',
        cornerRadiusTop: 0,
        cornerRadiusBottom: 0,
        interior: { ...walls.interior, enabled: true, width: 100, depth: 100 },
      },
    });
    const { deriveDimensions } = await import('./pipeline/context');
    const dim = deriveDimensions(params, true);
    const seat = resolveDividerFilletSeat(params, {
      innerW: dim.innerW,
      innerD: dim.innerD,
      wallHeight: dim.wallHeight,
      hasLip: dim.hasLip,
    });
    if (!seat) throw new Error('no fillet seat');
    const pieces = buildUniqueDividerPieces(
      params,
      dim.innerW,
      dim.innerD,
      dim.wallHeight,
      dim.hasLip
    );
    try {
      const piece = pieces[0].shape;
      expect(getSolids(piece)).toHaveLength(1);
      const b = getBounds(piece);
      const { slotDepth } = getEffectiveSlotDimensions(
        params.wallThickness,
        params.dividerPieces.thickness,
        params.dividerPieces.clearance
      );
      // Just inboard of the wall face, where the window's side stands over
      // the curve: a full band of solid sits on top of the curve.
      const d = tabEngagement(slotDepth, params.dividerPieces.clearance) + 0.3;
      const rise = cornerRiseMm(seat.cornerRadius, d);
      const band = 1.8;
      expect(
        await solidFraction(
          piece,
          [0.1, band, 0.4],
          [b.xMin + d, b.yMin + rise + 0.1 + band / 2, (b.zMin + b.zMax) / 2]
        )
      ).toBeGreaterThan(0.95);
    } finally {
      for (const p of pieces) p.shape.delete();
    }
  }, 120_000);
});
