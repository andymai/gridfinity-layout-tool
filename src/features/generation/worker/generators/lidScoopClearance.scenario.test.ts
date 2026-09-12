/**
 * Lid-vs-finger-scoop clearance.
 *
 * A scoop against an outer wall of a lipped bin rises toward the lip. Where its
 * arc reaches the top ~3.05mm of the wall it fills the pocket the lid's click
 * rail bump drops into, so that edge never clicks and the lid is propped off
 * the rim. `autoScoopCeiling` holds an auto scoop clear of that band, and
 * `checkLidCompatibility` drops the rail only for a height the user typed that
 * still reaches it.
 *
 * The ramp's inward offset and the chute above it are NOT what does the damage,
 * and what makes that true is WHERE the chute stands rather than how thin it is:
 * its face is on the lip's inner face, the plane the rail has already been
 * deflected past by the time it is that deep. So it fills the void under
 * the lip without asking the rail for a millimetre of extra travel. A ramp
 * taken to the wall top is a different shape: its arc carries material inboard
 * of that plane, where the rail cannot follow, and the rail is dropped on every
 * wall carrying one.
 *
 * Both meshes stay watertight and plausibly sized either way, so only mating
 * them shows it.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidScoopClearance.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  lidZOffset,
  railKeepoutIntrusionMm,
  RAIL_ENGAGEMENT_CEILING,
  RAIL_ENGAGEMENT_FLOOR,
  worstRailInterference,
} from './__kernel-tests__/lidSeating';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, ScoopSide } from '@/features/bin-designer/types';

const SIDES: readonly ScoopSide[] = ['front', 'back', 'left', 'right'];

/** Rail rotation `railPlacementsForRectangle` gives each wall. */
const ROTATION: Record<ScoopSide, number> = { back: 0, front: 180, right: -90, left: 90 };

function makeParams(over: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 4,
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto', side: 'front' },
    ...over,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, ...over.base },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: 100,
      // Pins the NOTCHING path: `relieveInterior` defaults on for new
      // designs, which steps the interior aside and makes the rails whole, so
      // leaving it on would exercise a different mechanism than this file.
      relieveInterior: false,
      ...over.lid,
    },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid click rails clear the scoop', () => {
  it.each(SIDES)(
    'a %s scoop keeps all four rails and still seats clear',
    async (side) => {
      const { generateLid } = await import('./lidOrchestrator');
      const { railPlacements } = await import('./lidClickRail');
      const { resolveLidInputs } = await import('./lidInputs');
      const params = makeParams({
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto', side },
      });
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin) throw new Error('expected the bin to build');
      if (!lid) throw new Error('expected the lid to build');

      // The rail the scoop used to cost is back.
      expect(new Set(railPlacements(resolveLidInputs(params)).map((p) => p.rotationDeg))).toContain(
        ROTATION[side]
      );
      // The chute stands ON the lip line, so the rail meets it already pushed
      // that far in and has nothing left to deflect for. This is what says the
      // scoop seats; the column reading below follows from it.
      expect(railKeepoutIntrusionMm(bin, lid, params, lidZOffset(params))).toBe(0);
      // Pinned from both sides. An AUTO scoop is held clear of the rail band by
      // `autoScoopCeiling`, so since the rail was reshaped to hook the lip its
      // nub no longer reaches the chute at all and this reads exactly what a
      // plain bin does — hence the floor, with no `RAIL_FLUSH_FILL_MM` term.
      // A typed radius still reaches it; `lidSeatInterference.matrix` carries
      // those cases and is where that figure is pinned.
      expect(worstRailInterference(bin, lid, lidZOffset(params))).toBeCloseTo(
        RAIL_ENGAGEMENT_FLOOR,
        1
      );
    },
    300000
  );

  it.each(SIDES)('a %s scoop taken to the wall top drops that rail only', async (side) => {
    const { railPlacements } = await import('./lidClickRail');
    const { resolveLidInputs } = await import('./lidInputs');
    // 40mm exceeds the 23mm wall, so it clamps to the wall top — squarely in
    // the rail's band. Auto never gets here; only a typed radius does.
    const params = makeParams({
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 40, side },
    });
    const rotations = railPlacements(resolveLidInputs(params)).map((p) => p.rotationDeg);

    expect(rotations).not.toContain(ROTATION[side]);
    // The other three walls keep theirs, so the lid still snaps on.
    expect(new Set(rotations).size).toBe(3);
  });

  it('a wall-top scoop with its rail dropped still seats clear', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 40, side: 'front' },
    });
    const bin = getGenerateBin()(params, undefined, false);
    const lid = generateLid(params);
    if (!bin) throw new Error('expected the bin to build');
    if (!lid) throw new Error('expected the lid to build');

    // The plain ceiling, not the scooped one: with the rail dropped from this
    // wall there is no bump on it to push through the extra material, which is
    // the clearest evidence that the extra reading is a rail-vs-scoop
    // interaction rather than the scoop's own geometry reaching the lid.
    expect(worstRailInterference(bin, lid, lidZOffset(params))).toBeCloseTo(
      RAIL_ENGAGEMENT_FLOOR,
      1
    );
  }, 300000);

  it('the probe can see a real clash', async () => {
    // Control for the seating assertions above: a bin scooped to the wall top
    // paired with a lid built as though the scoop were not there, which is what
    // shipped. Without it, every case above passes if the probe
    // stops finding a solid or `lidZOffset` drifts.
    //
    // The column metric cannot carry this alone any more: it saturates once a
    // column is solid through the whole band, so this pairing and a clean one
    // read alike. `railKeepoutIntrusionMm` is what still separates them.
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 40, side: 'front' },
    });
    const bin = getGenerateBin()(params, undefined, false);
    const blindLid = generateLid({
      ...params,
      scoop: { ...params.scoop, enabled: false },
    });
    if (!bin) throw new Error('expected the bin to build');
    if (!blindLid) throw new Error('expected the lid to build');

    // Asserted loosely: the arc only has to reach inboard of the lip line at
    // all for the zeroes above to mean anything, and pinning how far would make
    // any change to the ramp look like a broken probe.
    expect(railKeepoutIntrusionMm(bin, blindLid, params, lidZOffset(params))).toBeGreaterThan(0);
    // No column assertion to pair with it. Since the rail was reshaped to hook
    // the lip, its body no longer reaches down into the band the scoop's fill
    // occupies — this pairing reads `RAIL_ENGAGEMENT_FLOOR` on the rail lines,
    // the same as a clean bin. That is the geometry improving, not the probe
    // failing, and `railKeepoutIntrusionMm` is what still separates the two.
    expect(worstRailInterference(bin, blindLid, lidZOffset(params))).toBeLessThan(
      RAIL_ENGAGEMENT_CEILING
    );
  }, 300000);
});
