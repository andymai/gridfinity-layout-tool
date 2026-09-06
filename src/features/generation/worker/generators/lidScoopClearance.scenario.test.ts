/**
 * Lid-vs-finger-scoop clearance.
 *
 * A scoop against an outer wall of a lipped bin rises toward the lip. Where its
 * arc reaches the top ~3.15mm of the wall it fills the pocket the lid's click
 * rail bump drops into, so that edge never clicks and the lid is propped off
 * the rim. `autoScoopCeiling` holds an auto scoop clear of that band, and
 * `checkLidCompatibility` drops the rail only for a height the user typed that
 * still reaches it.
 *
 * The ramp's inward offset and the chute above it are NOT what does the damage:
 * they cost 0.07mm against a 0.64mm snap baseline, while a ramp taken to the
 * wall top costs 0.39mm. gated on the offset and dropped the rail on
 * every scooped wall for it.
 *
 * Both meshes stay watertight and plausibly sized either way, so only mating
 * them shows it.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidScoopClearance.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { lidZOffset, worstRailInterference } from './__kernel-tests__/lidSeating';
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
      // 0.15mm covers tessellation noise on the chute where it runs to the
      // wall top, which is the plane the lip's base now sits on.
      // The defect this guards against measured 1.1mm.
      expect(worstRailInterference(bin, lid, lidZOffset(params))).toBeLessThan(0.15);
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

    expect(worstRailInterference(bin, lid, lidZOffset(params))).toBeLessThan(0.15);
  }, 300000);

  it('the probe can see a real clash', async () => {
    // Control for the seating assertions above: a bin scooped to the wall top
    // paired with a lid built as though the scoop were not there, which is what
    // shipped. Without it, every case above passes if the probe
    // stops finding a solid or `lidZOffset` drifts.
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

    // The clash measures ~1.0mm. Asserted at 0.9 so the control still has room
    // to move: it only has to stay far clear of the 0.15mm the seating cases
    // above allow, and pinning it to its exact reading would make any change to
    // where the lid seats look like a broken probe.
    expect(worstRailInterference(bin, blindLid, lidZOffset(params))).toBeGreaterThan(0.9);
  }, 300000);
});
