/**
 * Lid-vs-bin magnet seating.
 *
 * The bin's corner pads and the lid's corner bosses are built by different
 * passes from one seat-plane expression, so every test written in terms of that
 * expression proves the two agree with each other and nothing about where they
 * agree. Both meshes stay watertight and plausibly sized with the pads at any
 * height at all. Mating the two and measuring the magnet interface is the only
 * check that sees the plane itself.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidMagnetSeating.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { lidZOffset, magnetSeatGap, worstSeatInterference } from './__kernel-tests__/lidSeating';
import { LID_MAGNET_SEAT_GAP } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, LidConfig } from '@/features/bin-designer/types';

function makeParams(over: Partial<BinParams> = {}, lid: Partial<LidConfig> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    ...over,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, ...over.base },
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, attachment: 'magnetic', ...lid },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('a magnetic lid seats on its bin with the magnets a seat gap apart', () => {
  const CASES: ReadonlyArray<readonly [string, Partial<BinParams>, Partial<LidConfig>]> = [
    ['default socketed bin', {}, {}],
    ['flat base', { base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true } }, {}],
    ['exterior wall collar', { extraWallHeightMm: 9 }, {}],
    ['tall bin', { height: 8 }, {}],
    ['deep cavity + thick plate', {}, { topThicknessMm: 2.6, extraHeightMm: 8 }],
    [
      'deeper magnet',
      { height: 5 },
      { retentionMagnet: { diameter: 8, depth: 3, edgeMagnets: 0 } },
    ],
    [
      'edge magnets on a large footprint',
      { width: 4, depth: 3 },
      { retentionMagnet: { diameter: 6, depth: 2, edgeMagnets: 1 } },
    ],
  ];

  it.each(CASES)(
    '%s',
    async (_label, over, lidOver) => {
      const { generateLid } = await import('./lidOrchestrator');
      const params = makeParams(over, lidOver);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin) throw new Error('expected the bin to build');
      if (!lid) throw new Error('expected the lid to build');

      const dz = lidZOffset(params);

      // A pad even a tenth of a millimetre proud of this holds the lid off its
      // lip; the reported defect left the pads 0.5mm inside the bosses.
      // A gap much wider costs holding force — 4.5mm was the shipped value
      // moved it the other way.
      expect(magnetSeatGap(bin, lid, params, dz)).toBeCloseTo(LID_MAGNET_SEAT_GAP, 1);

      //...and the magnets meeting is not the lid closing.'s fix put the
      // magnet faces exactly right and still shipped a lid that could not shut:
      // raising the pads to the corrected plane drove their outboard half —
      // the part that welds into the wall — 2.8mm into the mating skirt, which
      // every aimed probe above sails straight past.
      const clash = worstSeatInterference(bin, lid, dz);
      expect(
        clash.mm,
        `${clash.mm.toFixed(2)}mm of bin and lid share a column at (${clash.x.toFixed(1)}, ${clash.y.toFixed(1)})`
      ).toBeLessThan(0.01);
    },
    300000
  );
});
