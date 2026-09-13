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
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { binFloorMm } from '@/shared/types/bin';
import type { Shape3D } from 'brepjs';
import { BOX_CORNER_RADIUS, CLEARANCE } from './generatorConstants';
import { resolveOverhang, overhangExpansion, hasOverhang } from './overhang';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

/**
 * Count ramp mesh vertices lying outside the true outer wall. A bottom-band
 * taper narrows the wall toward the floor, so the reference body is the tapered
 * outer loft, not the rim-sized prism; with no taper the two coincide.
 */
async function verticesOutsideOuterWall(params: BinParams): Promise<number> {
  const { drawRoundedRectangle, cut, mesh, unwrap, withScope, isEmpty } = await import('brepjs');
  const { sketch } = await import('./meshUtils');
  const { buildScoopRamps } = await import('./scoopRampBuilder');
  const { buildTaperedOuter } = await import('./taperedOuter');

  const wt = params.wallThickness;
  // Match the pipeline's own footprint (context.ts): outer = units·pitch −
  // clearance, expanded by the overhang; the taper insets that rim toward the
  // floor.
  const unitX = params.gridUnitMm;
  const unitY = params.gridUnitMmY ?? unitX;
  const ov = resolveOverhang(params.overhang);
  const exp = hasOverhang(ov) ? overhangExpansion(ov) : null;
  const outerW = params.width * unitX - CLEARANCE + (exp?.addW ?? 0);
  const outerD = params.depth * unitY - CLEARANCE + (exp?.addD ?? 0);
  const innerW = outerW - 2 * wt;
  const innerD = outerD - 2 * wt;
  const offX = exp?.offsetX ?? 0;
  const offY = exp?.offsetY ?? 0;
  const wallHeight = params.height * params.heightUnitMm;

  const ramp: Shape3D | null = buildScoopRamps(
    params,
    innerW,
    innerD,
    wallHeight,
    wt,
    binFloorMm(wt),
    undefined,
    ov.taper,
    offX,
    offY
  );
  if (!ramp) return 0;

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
  profile: 'fillet' | 'chamfer' = 'fillet'
): BinParams['overhang'] => {
  const s = { left: 0, right: 0, front: 0, back: 0, ...sides };
  return {
    ...s,
    feet: false,
    enabled: true,
    taper: { enabled: true, profile, bandHeight: 16, ...s },
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
