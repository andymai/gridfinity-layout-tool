/**
 * Lid interior relief (#3477) — the envelope subtract, proven on real geometry.
 *
 * Three things have to hold together, and any two without the third is a worse
 * bin than before the change:
 *
 * 1. The rails come back. That is the entire point: with the interior stepped
 *    aside, a wall the notching path chopped into unusable stubs carries one
 *    unbroken rail again.
 * 2. Nothing intrudes. A relieved bin must still seat, or the rails it regained
 *    are rails driven through solid material.
 * 3. The snap survives. The ring stops at the stacking lip's inner face
 *    precisely so it cannot shave the undercut the rail bump hooks — the one
 *    failure here that leaves a bin looking perfect and holding nothing.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lidInteriorRelief.scenario
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { lidZOffset, worstRailInterference } from './__kernel-tests__/lidSeating';
import { columnCrossings } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, CompartmentConfig } from '@/features/bin-designer/types';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';

const grid = (cols: number, rows: number): CompartmentConfig => ({
  cols,
  rows,
  thickness: 1.2,
  cells: Array.from({ length: cols * rows }, (_, i) => i),
});

function makeParams(over: {
  compartments?: CompartmentConfig;
  relieve: boolean;
  coverage?: number;
  label?: boolean;
  width?: number;
}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: over.width ?? 2,
    depth: 2,
    height: 6,
    compartments: over.compartments ?? grid(2, 2),
    label: over.label
      ? {
          ...DEFAULT_BIN_PARAMS.label,
          enabled: true,
          support: 'bracket',
          depth: 12,
          width: 100,
          alignment: 'center',
          edges: 'back',
        }
      : DEFAULT_BIN_PARAMS.label,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      clickRailCoverage: over.coverage ?? 100,
      relieveInterior: over.relieve,
    },
  };
}

beforeAll(async () => {
  await initBrepjs();
}, 180000);

describe('lid interior relief', () => {
  it('gives a notched wall its rail back', async () => {
    const { railPlacements } = await import('./lidClickRail');
    const { resolveLidInputs } = await import('./lidInputs');
    const front = (p: BinParams): number =>
      railPlacements(resolveLidInputs(p)).filter((r) => r.rotationDeg === 180).length;

    // Three column dividers cut the front wall into four stretches.
    const notched = makeParams({ compartments: grid(4, 1), relieve: false });
    expect(front(notched)).toBe(4);
    expect(front({ ...notched, lid: { ...notched.lid, relieveInterior: true } })).toBe(1);
  });

  it('restores a wall the notching path dropped to friction-fit', async () => {
    const { railPlacements } = await import('./lidClickRail');
    const { resolveLidInputs } = await import('./lidInputs');
    const front = (p: BinParams): number =>
      railPlacements(resolveLidInputs(p)).filter((r) => r.rotationDeg === 180).length;

    // Eight columns at 50% coverage leaves every surviving stretch under the
    // 4mm minimum, so the wall goes friction-fit entirely.
    const dense = makeParams({ compartments: grid(8, 1), relieve: false, coverage: 50 });
    expect(front(dense)).toBe(0);
    expect(front({ ...dense, lid: { ...dense.lid, relieveInterior: true } })).toBe(1);
  });

  it('seats with nothing in the rails’ path', async () => {
    const { generateLid } = await import('./lidOrchestrator');
    for (const params of [
      makeParams({ compartments: grid(4, 2), relieve: true }),
      makeParams({ compartments: grid(2, 2), relieve: true, label: true }),
      makeParams({ compartments: grid(8, 1), relieve: true, coverage: 50 }),
    ]) {
      const bin = getGenerateBin()(params, undefined, false);
      const lid = generateLid(params);
      if (!bin || !lid) throw new Error('expected the pair to build');
      expect(worstRailInterference(bin, lid, lidZOffset(params))).toBeLessThan(0.05);
    }
  }, 300000);

  it('leaves the stacking lip’s undercut intact', async () => {
    // The failure this guards against is invisible: a ring that overshot
    // upward would shave the lip's inward jut, and the bin would look right,
    // stay watertight, and hold nothing — the rail bump would have no undercut
    // to hook.
    //
    // Probed in the jut itself, the band between the lip's inner face and the
    // wall's, where the lip is the ONLY material: above the rim it is solid,
    // below it is the open pocket the bump drops into. Asserted as identical
    // to the same bin with the relief off, which is stronger than any
    // threshold — the ring is supposed to leave this profile untouched, so any
    // difference at all is the defect.
    const relieved = makeParams({ compartments: grid(4, 2), relieve: true });
    const plain = { ...relieved, lid: { ...relieved.lid, relieveInterior: false } };
    const withRing = getGenerateBin()(relieved, undefined, false);
    const without = getGenerateBin()(plain, undefined, false);
    if (!withRing || !without) throw new Error('expected both bins to build');

    const outerHalfD = (relieved.depth * relieved.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE) / 2;
    const innerHalfD = outerHalfD - relieved.wallThickness;
    const lipInnerD = outerHalfD - GRIDFINITY_SPEC.LIP_BIG_TAPER;
    const probeY = (lipInnerD + innerHalfD) / 2;

    for (const x of [-20, 0, 20]) {
      const a = columnCrossings(withRing, x, probeY).at(-1);
      const b = columnCrossings(without, x, probeY).at(-1);
      expect(a).toBeDefined();
      expect(a ?? 0).toBeCloseTo(b ?? 0, 6);
      // And it really is the lip up there, not the wall top: anything less
      // would make the comparison above vacuous.
      expect(a ?? 0).toBeGreaterThan(relieved.height * relieved.heightUnitMm);
    }
  }, 300000);

  it('is off for a design that predates it, and keeps the notching', async () => {
    const { dividerRailBlocks } = await import('@/shared/utils/dividerRailPlan');
    const legacy = makeParams({ compartments: grid(4, 1), relieve: false });
    expect(dividerRailBlocks(legacy).length).toBeGreaterThan(0);
    expect(dividerRailBlocks({ ...legacy, lid: { ...legacy.lid, relieveInterior: true } })).toEqual(
      []
    );
  });
});
