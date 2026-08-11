/**
 * Lid-vs-finger-scoop clearance (#3426).
 *
 * A scoop against an outer wall does not just ramp the floor: with a stacking
 * lip it is offset inward by the lip's overhang and fills the wall solid from
 * the ramp up to the lip base, so items slide out without catching. That fill
 * closes the pocket under the lip, which is the pocket the click rail's bump
 * drops into. The rail on the scooped wall then sits 1.1mm inside bin material
 * (measured at the probe below on a 2x2x4), so that edge never clicks and the
 * lid is propped off the rim.
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
      ...over.lid,
    },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid click rails clear the scoop lip fill', () => {
  it.each(SIDES)(
    'a %s scoop leaves the seated lid clear',
    async (side) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = makeParams({
        scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto', side },
      });
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin) throw new Error('expected the bin to build');
      if (!lid) throw new Error('expected the lid to build');

      // 0.15mm covers tessellation noise plus the 0.1mm ledge the fill leaves
      // where it runs to the wall top while the lip fuses LIP_OVERLAP below it.
      // The defect this guards against measured 1.1mm.
      expect(worstRailInterference(bin, lid, lidZOffset(params))).toBeLessThan(0.15);
    },
    300000
  );

  it.each(SIDES)('a %s scoop drops the rail on its own wall only', async (side) => {
    const { railPlacements } = await import('./lidClickRail');
    const { resolveLidInputs } = await import('./lidInputs');
    const params = makeParams({
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: 'auto', side },
    });
    const rotations = railPlacements(resolveLidInputs(params)).map((p) => p.rotationDeg);

    expect(rotations).not.toContain(ROTATION[side]);
    // The other three walls keep theirs, so the lid still snaps on.
    expect(new Set(rotations).size).toBe(3);
  });

  it('keeps every rail when the scoop cannot reach the lip', async () => {
    const { railPlacements } = await import('./lidClickRail');
    const { resolveLidInputs } = await import('./lidInputs');
    // A wall as thick as the lip's inset leaves no overhang to fill, so the
    // scoop meets the wall flush and the rail keeps its pocket.
    const params = makeParams({ wallThickness: 2.6 });

    expect(new Set(railPlacements(resolveLidInputs(params)).map((p) => p.rotationDeg)).size).toBe(
      4
    );
  });

  it('the probe can see a real clash', async () => {
    // Control for the four seating assertions above: a scooped bin paired with
    // a lid built as though the scoop were not there, which is what shipped
    // before this fix. Without it, every case above passes if the probe stops
    // finding a solid or `lidZOffset` drifts.
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams();
    const bin = getGenerateBin()(params, undefined, false);
    const blindLid = generateLid({
      ...params,
      scoop: { ...params.scoop, enabled: false },
    });
    if (!bin) throw new Error('expected the bin to build');
    if (!blindLid) throw new Error('expected the lid to build');

    expect(worstRailInterference(bin, blindLid, lidZOffset(params))).toBeGreaterThan(1);
  }, 300000);
});
