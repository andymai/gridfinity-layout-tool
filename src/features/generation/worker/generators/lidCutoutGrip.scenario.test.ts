/**
 * Click rails vs. wall cutouts and handle holes.
 *
 * A cutout or a high handle hole removes the stacking lip along its own span.
 * Until that cost the wall its whole rail, so a 40%-wide window threw
 * away the 60% of retention it never touched — the same defect fixed for
 * label tabs, still live for these two.
 *
 * The probe here is the mirror image of every other file in this family. A rail
 * over a window does not COLLIDE with anything, so `worstSeatInterference` and
 * `worstRailInterference` both report clean on a lid that holds by that stretch
 * not at all; they are kept below only as controls that the fix did not trade
 * one defect for the other. What actually decides these cases is
 * `ungrippedRailMm`, which asks whether the bin still has lip wherever the lid
 * has rail.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidCutoutGrip.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  lidZOffset,
  ungrippedRailMm,
  worstRailInterference,
  worstSeatInterference,
} from './__kernel-tests__/lidSeating';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/features/bin-designer/types';

type Side = 'front' | 'back' | 'left' | 'right';

const CUTOUT_OFF = {
  enabled: false,
  width: 0,
  depth: 0,
  alignment: 'center' as const,
  offset: 0,
  widthMm: null,
};

function cutouts(sides: readonly Side[], width: number, depth = 50): BinParams['walls'] {
  const on = {
    enabled: true,
    width,
    depth,
    alignment: 'center' as const,
    offset: 0,
    widthMm: null,
  };
  const walls = {
    ...DEFAULT_BIN_PARAMS.walls,
    enabled: true,
    front: { ...CUTOUT_OFF },
    back: { ...CUTOUT_OFF },
    left: { ...CUTOUT_OFF },
    right: { ...CUTOUT_OFF },
  };
  for (const s of sides) walls[s] = { ...on };
  return walls;
}

const HANDLE_OFF = { enabled: false, width: null, height: null, cornerRadius: null };

function handles(
  sides: readonly Side[],
  over: Partial<BinParams['handles']> = {}
): BinParams['handles'] {
  const cfg = {
    ...DEFAULT_BIN_PARAMS.handles,
    enabled: true,
    front: { ...HANDLE_OFF },
    back: { ...HANDLE_OFF },
    left: { ...HANDLE_OFF },
    right: { ...HANDLE_OFF },
    ...over,
  };
  for (const s of sides) cfg[s] = { ...HANDLE_OFF, enabled: true };
  return cfg;
}

interface Case {
  readonly name: string;
  readonly overrides: Partial<BinParams>;
  /**
   * Rails expected on the front wall. Always set: "no ungripped rail" is
   * satisfied by building no rail at all, which would pass the whole file while
   * shipping the friction-fit lid this change exists to stop shipping.
   */
  readonly expectFrontRails: number;
  /** Also sweep the whole footprint against the same bin with no openings. */
  readonly fullSweep?: boolean;
}

const CASES: readonly Case[] = [
  {
    // Control in the other direction: no openings, so all four rails run whole.
    name: 'a plain bin keeps its rails',
    overrides: {},
    expectFrontRails: 1,
  },
  {
    // The headline case: a cut wall still carries rails either side of it.
    name: 'a 40% front cutout leaves a rail either side of the window',
    overrides: { walls: cutouts(['front'], 40) },
    expectFrontRails: 2,
    fullSweep: true,
  },
  {
    name: 'a 70% cutout still leaves both stretches',
    overrides: { walls: cutouts(['front'], 70) },
    expectFrontRails: 2,
  },
  {
    // Off-centre: the two survivors are unequal, and the short one has to fall
    // out on its own by `LID_MIN_RAIL_LENGTH` rather than by a wall-level rule.
    name: 'a left-aligned cutout leaves one long stretch',
    overrides: {
      walls: {
        ...cutouts(['front'], 60),
        front: {
          enabled: true,
          width: 60,
          depth: 50,
          alignment: 'left' as const,
          offset: 0,
          widthMm: null,
        },
      },
    },
    expectFrontRails: 1,
  },
  {
    // No lip anywhere on that wall, so it goes friction-fit — the segment pass
    // reaching zero, not a wall-level disable.
    name: 'a full-width cutout drops its wall to friction-fit',
    overrides: { walls: cutouts(['front'], 100) },
    expectFrontRails: 0,
  },
  {
    // Cuts on all four walls must not block the lid: 60% of every wall
    // still carries lip, which is enough to hold rails.
    name: 'partial cutouts on all four walls still generate a lid with rails',
    overrides: { walls: cutouts(['front', 'back', 'left', 'right'], 40) },
    expectFrontRails: 2,
    fullSweep: true,
  },
  {
    name: 'a handle reaching the lip leaves a rail either side',
    overrides: { handles: handles(['front'], { width: 50 }) },
    expectFrontRails: 2,
  },
  {
    // The hole sits below the lip, so nothing is removed and the rail is whole.
    // Guards the other direction: charging a rail for a low handle would be
    // over-blocking that no interference probe could catch either.
    name: 'a low handle costs no rail at all',
    overrides: { handles: handles(['front'], { width: 50, verticalPosition: 0.3 }) },
    expectFrontRails: 1,
  },
  {
    name: 'three handles on one wall leave the stretches between them',
    overrides: { handles: handles(['front'], { width: 20, count: 3 }) },
    expectFrontRails: 4,
  },
  {
    // Both on the same wall: `handleBuilder` splits the handle around the
    // cutout, and the rail pass has to see all three openings.
    name: 'a cutout and a handle on the same wall',
    overrides: {
      walls: cutouts(['front'], 20),
      handles: handles(['front'], { width: 80 }),
    },
    expectFrontRails: 2,
    fullSweep: true,
  },
  {
    // The interior relief is no help here — it carves back material that
    // intrudes, and cannot put back material a cutout removed. Rails must still
    // stop short of the window with it on.
    name: 'a relieved interior does not restore the missing lip',
    overrides: {
      walls: cutouts(['front'], 40),
      lid: {
        ...DEFAULT_BIN_PARAMS.lid,
        enabled: true,
        attachment: 'clickRails',
        clickRails: { front: true, back: true, left: true, right: true },
        clickRailCoverage: 100,
        relieveInterior: true,
      },
    },
    expectFrontRails: 2,
  },
];

function makeParams(c: Case): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      relieveInterior: false,
    },
    ...c.overrides,
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid click rails keep lip to grip', () => {
  it.each(CASES)(
    '$name',
    async (c) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = makeParams(c);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin) throw new Error('expected the bin to build');
      if (!lid) throw new Error('expected the lid to build');
      const dz = lidZOffset(params);

      // The point of the file: every millimetre of rail has bin lip above it.
      expect(ungrippedRailMm(bin, lid, params, dz)).toBe(0);

      // Controls. Segmenting must not have moved a rail into something.
      expect(worstRailInterference(bin, lid, dz)).toBeLessThan(0.05);
      if (c.fullSweep) {
        const plain = { ...params, walls: DEFAULT_BIN_PARAMS.walls, handles: handles([]) };
        const plainBin = getGenerateBin()(plain, undefined, false);
        const plainLid = generateLid(plain);
        if (!plainBin || !plainLid) throw new Error('expected the plain pair to build');
        const baseline = worstSeatInterference(plainBin, plainLid, lidZOffset(plain)).mm;
        expect(worstSeatInterference(bin, lid, dz).mm).toBeLessThan(baseline + 0.05);
      }

      const { railPlacements } = await import('./lidClickRail');
      const { resolveLidInputs } = await import('./lidInputs');
      const onFront = railPlacements(resolveLidInputs(params)).filter((p) => p.rotationDeg === 180);
      expect(onFront).toHaveLength(c.expectFrontRails);
    },
    300000
  );

  it('the probe can see a rail with no lip under it', async () => {
    // Control for every assertion above, and the only way to know the probe is
    // wired to anything: a bin WITH a full-width front cutout, and a lid built
    // as though it had none — which is exactly what the older code would
    // have produced had it segmented rather than disabling the wall.
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({
      name: 'control',
      overrides: { walls: cutouts(['front'], 100) },
      expectFrontRails: 0,
    });
    const bin = getGenerateBin()(params, undefined, false);
    const blindLid = generateLid({ ...params, walls: DEFAULT_BIN_PARAMS.walls });
    if (!bin) throw new Error('expected the bin to build');
    if (!blindLid) throw new Error('expected the lid to build');

    const dz = lidZOffset(params);
    // The whole front rail hangs over the opening. Interference sees none of
    // it, which is the reason this probe exists.
    expect(ungrippedRailMm(bin, blindLid, params, dz)).toBeGreaterThan(30);
    expect(worstRailInterference(bin, blindLid, dz)).toBeLessThan(0.05);
  }, 300000);
});
