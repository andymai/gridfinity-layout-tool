/**
 * Scenario test: finger scoop ramps stay inside the outer wall (#4033).
 *
 * The ramp is a square-cornered prism pushed into the surrounding walls to weld
 * it (#4014). At the bin's rounded outer corners a square corner driven
 * diagonally into the wall overshoots the outer arc and pokes out of the bin
 * ("scoops cut through outside"). scoopRampBuilder clips the ramp to the rounded
 * cavity footprint to prevent that; this proves nothing pokes past the true
 * outer footprint across a range of wall thicknesses, lips, sides and styles
 * (the default 1.2 mm wall used to breach because the clip only ran below
 * ~1.10 mm).
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators scoopContainment
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { binFloorMm } from '@/shared/types/bin';
import type { Shape3D } from 'brepjs';
import { BOX_CORNER_RADIUS, CLEARANCE, SOCKET_HEIGHT } from './generatorConstants';
import { resolveOverhang, overhangExpansion, hasOverhang } from './overhang';
import { getLastSolid } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/**
 * Count ramp mesh vertices lying outside the true outer wall. A bottom-band
 * taper narrows the wall toward the floor, so the reference body is the tapered
 * outer loft, not the rim-sized prism; with no taper the two coincide.
 */
// Match the pipeline's own footprint (context.ts): outer = units·pitch −
// clearance, expanded by the overhang; the taper insets that rim toward the
// floor.
function footprintOf(params: BinParams): {
  outerW: number;
  outerD: number;
  innerW: number;
  innerD: number;
  offX: number;
  offY: number;
  ov: ReturnType<typeof resolveOverhang>;
} {
  const wt = params.wallThickness;
  const unitX = params.gridUnitMm;
  const unitY = params.gridUnitMmY ?? unitX;
  const ov = resolveOverhang(params.overhang);
  const exp = hasOverhang(ov) ? overhangExpansion(ov) : null;
  const outerW = params.width * unitX - CLEARANCE + (exp?.addW ?? 0);
  const outerD = params.depth * unitY - CLEARANCE + (exp?.addD ?? 0);
  return {
    outerW,
    outerD,
    innerW: outerW - 2 * wt,
    innerD: outerD - 2 * wt,
    offX: exp?.offsetX ?? 0,
    offY: exp?.offsetY ?? 0,
    ov,
  };
}

async function verticesOutsideOuterWall(params: BinParams): Promise<number> {
  const { drawRoundedRectangle, cut, mesh, unwrap, withScope, isEmpty, translate } =
    await import('brepjs');
  const { sketch } = await import('./meshUtils');
  const { buildScoopRamps } = await import('./scoopRampBuilder');
  const { buildTaperedOuter } = await import('./taperedOuter');

  const wt = params.wallThickness;
  const { outerW, outerD, innerW, innerD, offX, offY, ov } = footprintOf(params);
  const wallHeight = params.height * params.heightUnitMm;

  const built: Shape3D | null = buildScoopRamps(
    params,
    innerW,
    innerD,
    wallHeight,
    wt,
    binFloorMm(wt),
    undefined,
    ov.taper
  );
  if (!built) return 0;
  // The builder works in the cavity-local frame; the feature runner moves its
  // result by the asymmetric-overhang offset before fusing. Measure the ramp
  // where the bin actually carries it, or a clip built in the wrong frame
  // reads as contained here and still lands outside the wall in the pipeline.
  const ramp = translate(built, [offX, offY, 0]);
  built.delete();

  try {
    return withScope((scope) => {
      const outerBody = ov.taper
        ? buildTaperedOuter(scope, outerW, outerD, wallHeight, wt, ov.taper, offX, offY)
        : scope.register(
            sketch(drawRoundedRectangle(outerW, outerD, BOX_CORNER_RADIUS), 'XY', -1).extrude(
              wallHeight + 2
            )
          );
      const outside = scope.register(unwrap(cut(ramp, outerBody as never)));
      // A fully contained ramp cuts to an empty solid — that is the pass, and
      // brepjs returns it normally. Only that case is zero; a `cut`/`mesh`
      // failure must surface as a thrown error, not read as containment.
      if (isEmpty(outside)) return 0;
      const m = mesh(outside, { tolerance: 0.02, angularTolerance: 8, cache: false });
      return m.vertices.length / 3;
    });
  } finally {
    ramp.delete();
  }
}

const scoop = (over: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
  ...over,
});

// A bottom-band outer-wall taper on the given sides; per-side inset is clamped
// to the overhang, so the overhang must be at least as large.
const taperOverhang = (
  sides: Partial<Record<'left' | 'right' | 'front' | 'back', number>>,
  profile: 'fillet' | 'chamfer' = 'fillet',
  bandHeight = 16
): BinParams['overhang'] => {
  const s = { left: 0, right: 0, front: 0, back: 0, ...sides };
  return {
    ...s,
    feet: false,
    enabled: true,
    taper: { enabled: true, profile, bandHeight, ...s },
  };
};

describe('scoop ramps stay inside the outer wall', () => {
  const cases: [string, BinParams][] = [
    ['default 1.2mm wall, lip, curved (the reported case)', scoop()],
    ['no lip', scoop({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } })],
    [
      'straight style',
      scoop({ scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, style: 'straight' } }),
    ],
    [
      'side scoop (left)',
      scoop({ scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'left' } }),
    ],
    ['thin 0.95mm wall (clip already active)', scoop({ wallThickness: 0.95 })],
    ['thicker 2.0mm wall', scoop({ wallThickness: 2.0 })],
    // A taper narrows the wall toward the floor, exactly where the ramp stands.
    [
      'asymmetric left taper, back+right scoops (the reported case)',
      scoop({
        width: 1,
        depth: 1,
        height: 3,
        wallThickness: 1.6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        overhang: taperOverhang({ left: 11 }),
        scoop: {
          ...DEFAULT_BIN_PARAMS.scoop,
          enabled: true,
          side: 'back',
          sides: ['back', 'right'],
        },
      }),
    ],
    [
      'symmetric fillet taper, all four scoop walls',
      scoop({
        width: 2,
        depth: 2,
        overhang: taperOverhang({ left: 8, right: 8, front: 8, back: 8 }),
        scoop: {
          ...DEFAULT_BIN_PARAMS.scoop,
          enabled: true,
          sides: ['left', 'right', 'front', 'back'],
        },
      }),
    ],
    // A scoop ON the tapered side, with a band nearly the full wall: the ramp
    // stands where the inset is largest, and the offset shift is at its worst.
    [
      'tall fillet taper on the scooped side itself (the reported case)',
      scoop({
        width: 1,
        depth: 1,
        height: 7,
        wallThickness: 1.6,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
        overhang: taperOverhang({ left: 15 }, 'fillet', 44),
        scoop: {
          ...DEFAULT_BIN_PARAMS.scoop,
          enabled: true,
          autoMaxHeight: 14,
          side: 'back',
          sides: ['back', 'left', 'right'],
        },
      }),
    ],
    [
      'chamfer taper on the scooped wall',
      scoop({
        overhang: taperOverhang({ back: 9 }, 'chamfer'),
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, side: 'back' },
      }),
    ],
  ];

  for (const [name, params] of cases) {
    it(
      name,
      async () => {
        expect(await verticesOutsideOuterWall(params)).toBe(0);
      },
      120_000
    );
  }
});

/**
 * The same claim on the generated bin. The builder-level check above measures
 * the ramp in the frame the feature runner leaves it in, but only the pipeline
 * proves the two frames agree: a clip built in the body frame and a ramp
 * shifted into it afterwards each pass their own unit test and still put the
 * left ramp 7.5mm outside a left-tapered wall.
 */
describe('generated bin carries no scoop material outside a tapered wall', () => {
  it('tall fillet taper on the scooped side itself (the reported case)', async () => {
    const { cut, intersect, mesh, unwrap, withScope, isEmpty, translate, box } =
      await import('brepjs');
    const { buildTaperedOuter } = await import('./taperedOuter');
    const params = scoop({
      width: 1,
      depth: 1,
      height: 7,
      wallThickness: 1.6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      overhang: taperOverhang({ left: 15 }, 'fillet', 44),
      scoop: {
        ...DEFAULT_BIN_PARAMS.scoop,
        enabled: true,
        autoMaxHeight: 14,
        side: 'back',
        sides: ['back', 'left', 'right'],
      },
    });
    const result = getGenerateBin()(params, undefined, false);
    expect(result.triangleCount).toBeGreaterThan(0);
    const solid = getLastSolid();
    if (!solid) throw new Error('generateBin left no solid behind');
    const { outerW, outerD, offX, offY, ov } = footprintOf(params);
    const taper = ov.taper;
    if (!taper) throw new Error('scenario lost its taper');
    const wt = params.wallThickness;
    const wallHeight = params.height * params.heightUnitMm - SOCKET_HEIGHT;
    const outside = withScope((scope) => {
      // The body sits on the socket, so lift the reference loft to meet it and
      // ignore everything below the socket plane: the feet are not the wall.
      const body = buildTaperedOuter(scope, outerW, outerD, wallHeight + 2, wt, taper, offX, offY);
      const lifted = scope.register(translate(body, [0, 0, SOCKET_HEIGHT]));
      const aboveSocket = scope.register(
        box(outerW * 3, outerD * 3, wallHeight + 20, {
          at: [0, 0, SOCKET_HEIGHT + 0.05 + (wallHeight + 20) / 2],
        })
      );
      const outsideWall = scope.register(unwrap(cut(solid as never, lifted as never)));
      if (isEmpty(outsideWall)) return 0;
      // Everything the bin legitimately has above the socket is inside the loft.
      const overshoot = scope.register(unwrap(intersect(outsideWall, aboveSocket as never)));
      if (isEmpty(overshoot)) return 0;
      const m = mesh(overshoot, { tolerance: 0.02, angularTolerance: 8, cache: false });
      return m.vertices.length / 3;
    });
    expect(outside).toBe(0);
  }, 240_000);
});
