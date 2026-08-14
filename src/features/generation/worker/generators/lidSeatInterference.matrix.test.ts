/**
 * Standing assembly check: nothing may intrude into the lid's seating volume.
 *
 * Four defects in this family shipped (#3401, #3434, #3450, #3477), each caught
 * only after a user reported a lid that would not close, and each guarded
 * afterwards by a test aimed at the feature someone already suspected. A bin
 * and its lid are separate solids, so every ordinary assertion — watertight,
 * triangle count, bounding box — passes while the pair cannot be assembled
 * (CLAUDE.md gotchas #10 and #18).
 *
 * This is the combinatorial version, and it is meant to fail for features that
 * do not exist yet. The probe sweeps each rail line end to end rather than
 * looking where someone already suspects, and the cases come from an all-pairs
 * product over every axis that can reach the band, so a new feature interacting
 * with an old one is covered without anyone having thought of the combination.
 *
 * The measurement is `worstRailInterferenceDelta` against the SAME
 * configuration with its interior emptied, position by position. Three things
 * make it that shape rather than something simpler:
 *
 * 1. Not the whole-footprint `worstSeatInterference`: a rail bump hooking the
 *    lip's undercut is overlap in the nominal solid model, because that is what
 *    a snap fit is. It reads 0.5-1.1mm on a perfectly good bin.
 * 2. Not an absolute rail threshold either. The rail sweep's outer offsets
 *    sample that same snap, so it is 0 on a 2x2 and 0.7mm on a 1x2 with no
 *    interior features at all — a property of the footprint, and a matrix that
 *    varies the footprint cannot use one number.
 * 3. Not max-against-max. That hides a small clash behind a larger floor, and
 *    over a 2D grid it also reports where the two grids happened to land
 *    (0.2-0.8mm on configurations with no defect). Matching rail positions have
 *    neither problem: the set is discrete and identical for one footprint.
 *
 * The scope this buys is the rail band, where three of the four defects lived
 * (#3401, #3434, #3477). A pad on the skirt line away from any rail (#3450)
 * needs the footprint sweep, and keeps its own dedicated test. Widening this
 * gate to cover that too means first making `verticalSolidSpans` robust to the
 * odd crossing counts that interior features leave at coincident faces — its
 * own known weakness, and its own piece of work.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidSeatInterference.matrix
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  lidZOffset,
  worstRailInterferenceDelta,
  type SeatedPair,
} from './__kernel-tests__/lidSeating';
import { allPairs, uncoveredPairs, type Axis } from '@/test/pairwise';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, CompartmentConfig } from '@/features/bin-designer/types';
/**
 * Tolerance (mm). Absorbs tessellation noise on the curved corner blends; the
 * defects this guards against measured 1.25mm (#3401), 2.8mm (#3450) and
 * 3.10mm (#3477).
 */
const TOLERANCE_MM = 0.05;

const grid = (cols: number, rows: number): CompartmentConfig => ({
  cols,
  rows,
  thickness: 1.2,
  cells: Array.from({ length: cols * rows }, (_, i) => i),
});

const ONE: CompartmentConfig = { cols: 1, rows: 1, thickness: 1.2, cells: [0] };

/**
 * Axes are ordered largest first: all-pairs seeds on the product of the first
 * two, so this bounds the case count. Every value must be reachable through the
 * UI — a combination the constraint engine forbids would assert nothing.
 */
const AXES = [
  { name: 'footprint', values: ['2x2', '3x2', '2x3', '1x2'] },
  { name: 'compartments', values: ['1x1', '2x2', '3x2', '8x1'] },
  { name: 'label', values: ['off', 'back', 'both'] },
  { name: 'scoop', values: ['off', 'auto', 'typed'] },
  { name: 'attachment', values: ['clickRails', 'friction', 'magnetic'] },
  { name: 'grip', values: ['none', 'scallopDip'] },
  { name: 'collar', values: ['0', '4'] },
  { name: 'overhang', values: ['none', 'asym'] },
  { name: 'coverage', values: ['50', '100'] },
  { name: 'cutouts', values: ['off', 'front'] },
  { name: 'handles', values: ['off', 'front'] },
] as const satisfies readonly Axis<string>[];

type Case = Record<(typeof AXES)[number]['name'], string>;

const FOOTPRINTS: Record<string, { width: number; depth: number }> = {
  '2x2': { width: 2, depth: 2 },
  '3x2': { width: 3, depth: 2 },
  '2x3': { width: 2, depth: 3 },
  '1x2': { width: 1, depth: 2 },
};

const COMPARTMENTS: Record<string, CompartmentConfig> = {
  '1x1': ONE,
  '2x2': grid(2, 2),
  '3x2': grid(3, 2),
  '8x1': grid(8, 1),
};

function paramsFor(c: Case): BinParams {
  const { width, depth } = FOOTPRINTS[c.footprint];
  return {
    ...DEFAULT_BIN_PARAMS,
    width,
    depth,
    height: 6,
    compartments: COMPARTMENTS[c.compartments],
    extraWallHeightMm: Number(c.collar),
    overhang:
      c.overhang === 'asym'
        ? { left: 0, right: 6, front: 2, back: 0, feet: false }
        : DEFAULT_BIN_PARAMS.overhang,
    label:
      c.label === 'off'
        ? DEFAULT_BIN_PARAMS.label
        : {
            ...DEFAULT_BIN_PARAMS.label,
            enabled: true,
            support: 'bracket',
            depth: 12,
            width: 100,
            alignment: 'center',
            edges: c.label === 'both' ? 'both' : 'back',
          },
    scoop:
      c.scoop === 'off'
        ? DEFAULT_BIN_PARAMS.scoop
        : // A typed radius is the one the `autoScoopCeiling` clamp does not
          // hold clear of the rail band (#3434), so it is its own value here.
          { ...DEFAULT_BIN_PARAMS.scoop, enabled: true, radius: c.scoop === 'auto' ? 'auto' : 20 },
    walls:
      c.cutouts === 'off'
        ? DEFAULT_BIN_PARAMS.walls
        : {
            ...DEFAULT_BIN_PARAMS.walls,
            enabled: true,
            front: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: true, width: 40 },
            back: { ...DEFAULT_BIN_PARAMS.walls.front, enabled: false },
            left: { ...DEFAULT_BIN_PARAMS.walls.left, enabled: false },
            right: { ...DEFAULT_BIN_PARAMS.walls.right, enabled: false },
          },
    handles:
      c.handles === 'off'
        ? DEFAULT_BIN_PARAMS.handles
        : {
            ...DEFAULT_BIN_PARAMS.handles,
            enabled: true,
            front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
            back: { ...DEFAULT_BIN_PARAMS.handles.back, enabled: false },
            left: { ...DEFAULT_BIN_PARAMS.handles.left, enabled: false },
            right: { ...DEFAULT_BIN_PARAMS.handles.right, enabled: false },
          },
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: c.attachment as BinParams['lid']['attachment'],
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: Number(c.coverage),
      grip:
        c.grip === 'none'
          ? DEFAULT_BIN_PARAMS.lid.grip
          : {
              ...DEFAULT_BIN_PARAMS.lid.grip,
              mode: 'scallop',
              // `binDip` is what lets a relief interrupt the rails, so the
              // scallop value exercises the split rather than just the cut.
              binDip: true,
            },
    },
  };
}

/** Axes describing the bin's interior; emptied to get a case's floor. */
const INTERIOR_AXES = ['compartments', 'label', 'scoop', 'cutouts', 'handles'] as const;

/** The same case with every interior feature switched off. */
function emptied(c: Case): Case {
  const out = { ...c };
  for (const axis of INTERIOR_AXES) out[axis] = AXES.find((a) => a.name === axis)?.values[0] ?? '';
  return out;
}

const key = (c: Case): string => AXES.map((a) => `${a.name}=${c[a.name]}`).join(',');

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('nothing intrudes into the lid seating volume', () => {
  const CASES = allPairs<string>([...AXES]) as Case[];

  it('the matrix is pairwise-complete', () => {
    // Without this, a generator bug that dropped pairs would shrink the matrix
    // and read as a speed-up rather than as lost coverage.
    expect(uncoveredPairs<string>([...AXES], CASES)).toEqual([]);
  });

  it('the probe can see a real clash', async () => {
    // Control for the whole matrix, and not optional: two earlier versions of
    // this measurement reported confidently on things that were not defects,
    // and a lip filter that excluded too much would make every case below pass
    // by measuring nothing. Rebuilds the pre-#3477 pairing by hand — a bin with
    // dividers, and a lid generated as though it had none.
    const { generateLid } = await import('./lidOrchestrator');
    const params = paramsFor({
      footprint: '3x2',
      compartments: '3x2',
      label: 'off',
      scoop: 'off',
      attachment: 'clickRails',
      grip: 'none',
      collar: '0',
      overhang: 'none',
      coverage: '100',
      cutouts: 'off',
      handles: 'off',
    });
    const bin = getGenerateBin()(params, undefined, false);
    const blindLid = generateLid({ ...params, compartments: ONE });
    if (!bin || !blindLid) throw new Error('expected the control pair to build');

    const dz = lidZOffset(params);
    const plain = { ...params, compartments: ONE };
    const plainBin = getGenerateBin()(plain, undefined, false);
    if (!plainBin) throw new Error('expected the emptied bin to build');
    expect(
      worstRailInterferenceDelta({ bin, lid: blindLid, dz }, { bin: plainBin, lid: blindLid, dz })
    ).toBeGreaterThan(2.5);
  }, 300000);

  it("no case puts bin material in a rail's path", async () => {
    const { generateLid } = await import('./lidOrchestrator');
    const build = (c: Case): SeatedPair | null => {
      const params = paramsFor(c);
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      return bin && lid ? { bin, lid, dz: lidZOffset(params) } : null;
    };

    const baselines = new Map<string, SeatedPair>();
    const skipped: string[] = [];
    const intruding: Array<{ case: string; mm: number }> = [];

    for (const c of CASES) {
      const built = build(c);
      // A blocked configuration (corner magnets on a bin too small, cutouts on
      // every wall) generates no lid at all. Counted, not silently passed.
      if (!built) {
        skipped.push(key(c));
        continue;
      }
      const baseKey = key(emptied(c));
      let baseline = baselines.get(baseKey);
      if (baseline === undefined) {
        baseline = build(emptied(c)) ?? undefined;
        if (!baseline) throw new Error(`baseline failed to build: ${baseKey}`);
        baselines.set(baseKey, baseline);
      }
      const mm = worstRailInterferenceDelta(built, baseline);
      if (mm >= TOLERANCE_MM) intruding.push({ case: key(c), mm: Number(mm.toFixed(3)) });
    }

    // A case list that mostly fails to build would satisfy the assertion below
    // by measuring almost nothing.
    expect(skipped.length).toBeLessThan(CASES.length / 4);
    expect(intruding).toEqual([]);
  }, 900000);
});
