/**
 * Scenario test: a finger scoop stands on the floor and lands on it tangentially.
 *
 * Two things went wrong here and neither showed up in the export-integrity
 * suite, because both leave a watertight mesh. The ramp was authored from the
 * box bottom, so its lower two millimetres were buried in the floor and the
 * visible arc met the floor at an angle, well short of its nominal run. And on
 * a flat base the body reached the exporter as a multi-shell tangle whose
 * outer shell had the ramp SUBTRACTED, so the floor under the scoop was gone.
 * This probes the real export body: floor solid under the ramp, ramp solid
 * above the floor at mid-run, and only a hair of ramp left just before the
 * run ends.
 *
 * Cross-kernel:
 *   BREPJS_KERNEL=brepkit pnpm exec vitest run --project=generators scoopFloor
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import {
  computeInteriorHeight,
  computeLipOffset,
  resolveScoopProfile,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import { LIP_SMALL_TAPER, LIP_TAPER_WIDTH } from './generatorConstants';
import { getLastSolid, setLastSolid } from './shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe('finger scoop on the floor through the real kernel', () => {
  const cases: [string, Partial<BinParams>][] = [
    ['standard base', { height: 6, scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true } }],
    [
      'flat base',
      {
        height: 6,
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      },
    ],
  ];

  for (const [name, overrides] of cases) {
    it(`${name}: floor under the ramp, ramp on the floor, tangent landing`, async () => {
      const { box, intersect, isErr, measureVolume, unwrap } = await import('brepjs');
      const { exportBin } = await import('./binExporter');
      const { deriveDimensions } = await import('./pipeline/context');

      const params = buildParams(overrides);
      setLastSolid(null);
      await exportBin(params, 'stl');
      const bin = getLastSolid();
      expect(bin).not.toBeNull();
      if (!bin) return;

      const dim = deriveDimensions(params, true);
      const floorTop = dim.baseOffsetZ + dim.floorThickness;
      const lipOffset = computeLipOffset(dim.hasLip, true, LIP_TAPER_WIDTH, params.wallThickness);
      const frame = scoopFrameHeights(
        dim.wallHeight,
        computeInteriorHeight(dim.wallHeight, dim.hasLip, LIP_SMALL_TAPER),
        dim.floorThickness
      );
      const profile = resolveScoopProfile(
        params.scoop,
        dim.innerW,
        dim.innerD,
        true,
        dim.hasLip,
        frame.wallHeight,
        frame.interiorHeight,
        lipOffset
      );
      expect(profile).not.toBeNull();
      if (!profile) return;
      const { run, height } = profile;
      const wallY = -dim.innerD / 2;
      const rampStartY = wallY + lipOffset;

      const solidFraction = (
        w: number,
        d: number,
        h: number,
        at: [number, number, number]
      ): number => {
        const probe = box(w, d, h, { at });
        try {
          const hit = intersect(bin, probe, { optimisation: 'none' });
          if (isErr(hit)) {
            // A probe clear of the body intersects to nothing, which the kernel
            // reports as "not a 3D shape". Anything else is a boolean failure
            // and must fail the probe, not read as open space.
            if (hit.error.code === 'INTERSECT_NOT_3D') return 0;
            throw new Error(`${hit.error.code}: ${hit.error.message}`);
          }
          try {
            return unwrap(measureVolume(hit.value)) / (w * d * h);
          } finally {
            hit.value.delete();
          }
        } finally {
          probe.delete();
        }
      };

      // Floor under the ramp: the slab between the bin bottom and the floor top
      // is solid where the ramp sits (the flat-base regression carved it out).
      expect(
        solidFraction(10, run * 0.4, dim.floorThickness * 0.8, [
          0,
          rampStartY + run * 0.3,
          floorTop - dim.floorThickness / 2,
        ])
      ).toBeGreaterThan(0.95);

      // Ramp on the floor: at mid-run a quarter arc of rise `height` stands
      // height·(1−sin 60°) ≈ 0.134·height above the floor. Buried two
      // millimetres, most of that was inside the slab.
      const midRise = height * (1 - Math.sin(Math.PI / 3));
      expect(
        solidFraction(10, 1, midRise * 0.8, [0, rampStartY + run / 2, floorTop + midRise * 0.4])
      ).toBeGreaterThan(0.95);

      // Tangent landing: one millimetre before the run ends the arc is only
      // ~1/(2·run) mm tall, so a probe a full millimetre above the floor there
      // must be empty. A ramp buried in the floor ended several millimetres
      // short of this point with a visible kink instead.
      expect(solidFraction(10, 0.6, 0.6, [0, rampStartY + run - 1, floorTop + 1.3])).toBeLessThan(
        0.02
      );
      expect(
        solidFraction(10, 0.6, 0.6, [0, rampStartY + run - 4, floorTop + 0.35])
      ).toBeGreaterThan(0.2);
    }, 300_000);
  }
});
