/**
 * Lid-vs-compartment-divider clearance.
 *
 * A divider is built from the cavity floor to the interior ceiling, whose top
 * sits 0.7mm below the bin's wall top, and a seated click rail hangs 3.05mm
 * below that same plane while reaching 2.8mm inboard of the inner wall face.
 * Every point where a divider meets a perimeter wall was therefore 3.1mm of
 * solid-on-solid overlap: any bin with a compartment grid and the default
 * click-rail lid could not be closed at all.
 *
 * Neither mesh says so on its own — both are watertight, both have plausible
 * triangle counts, and every bounding-box assertion passes (CLAUDE.md gotcha
 * #10). Mating the two and probing inside the assembly is the only way to see
 * it. The probes here are unaimed along the run: `worstRailInterference` sweeps
 * the whole rail line at 1mm, which cannot step over a 1.2mm divider, and the
 * headline cases add `worstSeatInterference`, which sweeps the entire footprint
 * and knows nothing about where a divider is supposed to be.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidDividerClearance.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  lidZOffset,
  worstRailInterference,
  worstSeatInterference,
} from './__kernel-tests__/lidSeating';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, CompartmentConfig } from '@/features/bin-designer/types';

interface Case {
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly coverage: number;
  readonly compartments: CompartmentConfig;
  readonly overrides?: Partial<BinParams>;
  /**
   * Rails expected on the front wall. Set where the point of the case is that
   * something SURVIVES or that nothing was taken: absence-of-collision is
   * satisfied by building no rail at all, which would make the whole matrix
   * pass while shipping a friction-fit lid.
   */
  readonly expectFrontRails?: number;
  /**
   * Also sweep the whole footprint, against the same bin with its compartments
   * collapsed to one. Slower (a second bin and lid), and stated as a delta
   * because the sweep has a non-zero floor on ANY bin — 0.5mm of lip-in-cavity
   * fit, 1.1mm under asymmetric overhang — which is not a defect and would
   * otherwise have to be encoded as a magic threshold.
   */
  readonly fullSweep?: boolean;
}

const grid = (cols: number, rows: number, thickness = 1.2): CompartmentConfig => ({
  cols,
  rows,
  thickness,
  cells: Array.from({ length: cols * rows }, (_, i) => i),
});

const ONE: CompartmentConfig = { cols: 1, rows: 1, thickness: 1.2, cells: [0] };

const BACK_TABS: BinParams['label'] = {
  ...DEFAULT_BIN_PARAMS.label,
  enabled: true,
  support: 'bracket',
  depth: 12,
  width: 100,
  alignment: 'center',
  edges: 'back',
};

const CASES: readonly Case[] = [
  {
    // Control for the whole file in the other direction: a bin with no
    // dividers must keep all four full-length rails, or the notching is
    // over-blocking and every clean result below is meaningless.
    name: 'no dividers keeps its rails',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: ONE,
    expectFrontRails: 1,
  },
  {
    name: 'the reported 3x2 grid',
    width: 3,
    depth: 2,
    coverage: 100,
    compartments: grid(3, 2),
    expectFrontRails: 3,
    fullSweep: true,
  },
  {
    name: 'a 2x1 grid at the default 50% coverage',
    width: 2,
    depth: 2,
    coverage: 50,
    compartments: grid(2, 1),
    expectFrontRails: 2,
  },
  {
    name: 'a 2x2 grid at 100% coverage',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: grid(2, 2),
    expectFrontRails: 2,
  },
  {
    // The merged pair leaves the column boundary reaching the back wall only,
    // so the front rail is whole and the back one is cut.
    name: 'merged compartments leave partial runs',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 0, 1, 2] },
    expectFrontRails: 1,
  },
  {
    name: 'a tilted divider',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: {
      ...grid(2, 1),
      dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 12, offsetEnd: -12 }],
    },
    expectFrontRails: 2,
  },
  {
    // The lean pivots on the divider's TOP, so the notch would be identical to
    // an upright divider's if it were measured at the rim. A rail is a bar in
    // a 2.45mm band below that, over which the wall travels 2.45mm at 45
    // degrees: past the 1mm margin, so a notch cut for the top edge alone
    // leaves the rail driving into solid divider a couple of mm down.
    name: 'a leaning divider',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: {
      ...grid(2, 1),
      dividerOverrides: [
        { compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: 0, rakeDeg: 45 },
      ],
    },
    expectFrontRails: 2,
    fullSweep: true,
  },
  {
    // Leaning AND diagonal in plan: the notch has to follow the tilt to the
    // divider's real endpoints and widen for the lean on top of that.
    name: 'a divider both tilted and leaning',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: {
      ...grid(2, 1),
      dividerOverrides: [
        { compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -10, rakeDeg: 30 },
      ],
    },
    expectFrontRails: 2,
  },
  {
    // Below the band, so the rails are whole — the notch must not be charged
    // for a divider the lid passes over.
    name: 'a divider shortened clear of the band',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: { ...grid(2, 1), dividerHeight: 12 },
    expectFrontRails: 1,
  },
  {
    // Same, from the other side: the collar lifts the rail band rather than
    // lowering the divider.
    name: 'a collar that lifts the band clear',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: grid(2, 1),
    overrides: { extraWallHeightMm: 4 },
    expectFrontRails: 1,
  },
  {
    name: 'a non-square grid pitch',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: grid(2, 2),
    overrides: { gridUnitMmY: 36 },
    expectFrontRails: 2,
  },
  {
    name: 'symmetric overhang',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: grid(2, 2),
    overrides: { overhang: { left: 4, right: 4, front: 4, back: 4, feet: false } },
    expectFrontRails: 2,
  },
  {
    // The overhang translates the cavity and the lid's perimeter by the same
    // amount, so the notch must NOT be corrected for it. A correction either
    // way lands 3mm off here.
    name: 'asymmetric overhang',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: grid(2, 2),
    overrides: { overhang: { left: 0, right: 6, front: 2, back: 0, feet: false } },
    expectFrontRails: 2,
    fullSweep: true,
  },
  {
    // Both obstructions at once. The tab pass cuts each run first and the
    // divider pass cuts what is left. This case is also what caught the
    // interior-row tab defect: on a 2-row grid the front row gets a tab
    // hanging from the row divider, which spans its compartment wall to wall
    // and so runs into the LEFT and RIGHT rails, 1.25mm deep, while the rail
    // on the wall it faces is a row away and clears it fine.
    name: 'label tabs and dividers together',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: grid(2, 2),
    overrides: { label: BACK_TABS },
    expectFrontRails: 2,
    fullSweep: true,
  },
  {
    // The same interior tab without any divider to blame it on: a merged
    // back row leaves one row boundary the tabs hang from and no column
    name: 'an interior-row label tab with no column divider',
    width: 2,
    depth: 2,
    coverage: 100,
    compartments: { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 2] },
    overrides: { label: BACK_TABS },
  },
  {
    // Tabs on both edges of a 3-row grid: two interior rows, each with a tab
    // reaching both side walls, plus the outer pair.
    name: 'tabs on both edges of a three-row grid',
    width: 2,
    depth: 3,
    coverage: 100,
    compartments: grid(2, 3),
    overrides: { label: { ...BACK_TABS, edges: 'both', depth: 10 } },
  },
  {
    // Eight columns at 50% coverage leave every surviving stretch under the
    // 4mm minimum, so the front and back walls go friction-fit while the side
    // walls (which no divider reaches) keep theirs.
    name: 'a grid fine enough to drop a wall to friction-fit',
    width: 2,
    depth: 2,
    coverage: 50,
    compartments: grid(8, 1),
    expectFrontRails: 0,
  },
];

function makeParams(c: Case): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: c.width,
    depth: c.depth,
    height: 6,
    compartments: c.compartments,
    ...c.overrides,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: c.coverage,
      // Pins the NOTCHING path: `relieveInterior` defaults on for new
      // designs, which steps the interior aside and makes the rails whole, so
      // leaving it would test a different mechanism than this file is about.
      relieveInterior: false,
    },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid click rails clear compartment dividers', () => {
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

      // 0.05mm absorbs mesh tessellation noise on the curved corner blends;
      // the defect this guards against measured 3.10mm.
      expect(worstRailInterference(bin, lid, dz)).toBeLessThan(0.05);

      if (c.fullSweep) {
        const plain = { ...params, compartments: ONE };
        const plainBin = getGenerateBin()(plain, undefined, false);
        const plainLid = generateLid(plain);
        if (!plainBin || !plainLid) throw new Error('expected the dividerless pair to build');
        const baseline = worstSeatInterference(plainBin, plainLid, lidZOffset(plain)).mm;
        expect(worstSeatInterference(bin, lid, dz).mm).toBeLessThan(baseline + 0.05);
      }

      if (c.expectFrontRails !== undefined) {
        const { railPlacements } = await import('./lidClickRail');
        const { resolveLidInputs } = await import('./lidInputs');
        const onFrontWall = railPlacements(resolveLidInputs(params)).filter(
          (p) => p.rotationDeg === 180
        );
        expect(onFrontWall).toHaveLength(c.expectFrontRails);
      }
    },
    300000
  );

  it('the probe can see a real clash', async () => {
    // Control for every assertion above. Builds the pre-fix pairing by hand: a
    // bin WITH dividers, and a lid generated as though it had none. If the
    // probe stops finding either solid, or `lidZOffset` drifts, the rest of
    // this file passes while guarding nothing.
    const { generateLid } = await import('./lidOrchestrator');
    const params = makeParams({
      name: 'control',
      width: 3,
      depth: 2,
      coverage: 100,
      compartments: grid(3, 2),
    });
    const bin = getGenerateBin()(params, undefined, false);
    const blindLid = generateLid({ ...params, compartments: ONE });
    if (!bin) throw new Error('expected the bin to build');
    if (!blindLid) throw new Error('expected the lid to build');

    const dz = lidZOffset(params);
    // 2.8mm on the rail lines; the footprint sweep sees the same clash plus
    // the 0.5mm lip fit every bin has.
    expect(worstRailInterference(bin, blindLid, dz)).toBeGreaterThan(2.5);
    expect(worstSeatInterference(bin, blindLid, dz).mm).toBeGreaterThan(2.5);
  }, 300000);
});
