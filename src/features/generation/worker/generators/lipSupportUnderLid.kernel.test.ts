// @vitest-environment node
/**
 * Enabling a lid must not reshape the bin's stacking lip.
 *
 * `lid.relieveInterior` cuts the lid's seating envelope out of the cavity as a
 * ring whose top is the wall top. The lip reaches its deepest exactly there —
 * `LIP_TAPER_WIDTH` in from the outer face, a small taper further than the
 * `LIP_BIG_TAPER` line it holds higher up — so a ring started on the shallower
 * plane cuts through the lip's angled support and leaves its underside a flat
 * annulus at the wall top: a 90° overhang no printer can bridge (#4146).
 *
 * Nothing else sees it. Both bins are watertight, identically sized, and their
 * triangle counts differ by the handful the ring's own faces contribute. So
 * this states the lip as a DELTA against the same bin with the lid off, where
 * the lid is the only variable and no threshold has to be chosen.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lipSupportUnderLid.kernel
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { lidKeepoutRing } from '@/shared/constants/lidKeepout';
import { initTestKernel } from '@/test/initTestKernel';
import { boundingBox, verticalSolidSpans } from './__kernel-tests__/meshAssertions';

let generateBin: (params: BinParams) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 120000);

const BIN: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 3,
  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
};

const withLid = (params: BinParams, lid: Partial<BinParams['lid']>): BinParams => ({
  ...params,
  lid: { ...params.lid, ...lid },
});

/** Interior half-depth and wall-top Z, both read off the mesh where possible. */
function frame(mesh: MeshData, params: BinParams): { innerHalfD: number; wallTopZ: number } {
  return {
    innerHalfD:
      (params.depth * params.gridUnitMm - GRIDFINITY_SPEC.TOLERANCE) / 2 - params.wallThickness,
    wallTopZ: boundingBox(mesh.vertices).maxZ - GRIDFINITY_SPEC.LIP_HEIGHT,
  };
}

/**
 * Underside of the rim material at each sampled radius, relative to the wall
 * top. The lip's support is a 45° ramp, so a supported lip returns a
 * descending series and a sheared one returns zeros.
 */
function rimUnderside(mesh: MeshData, params: BinParams, radii: readonly number[]): number[] {
  const { innerHalfD, wallTopZ } = frame(mesh, params);
  return radii.map((inward) => {
    // Under the jut the column is the base socket low down and the rim up top,
    // and the rim's own top rides the lip's sloped inner face rather than
    // reaching the peak — so it is the highest span, not the tallest one.
    const spans = verticalSolidSpans(mesh, 0, innerHalfD - inward);
    const rim = spans.at(-1);
    return rim && rim[1] > wallTopZ ? rim[0] - wallTopZ : NaN;
  });
}

describe('stacking lip under a lid', () => {
  // Spans the band between the two candidate lip planes (0.7mm and 1.4mm in),
  // which is the material a ring on the shallower plane removes.
  const RADII = [1.2, 1.0, 0.8] as const;

  it('leaves the angled support identical to a bin with no lid', () => {
    const plain = rimUnderside(generateBin(BIN), BIN, RADII);
    // Every attachment cuts the same ring — the stage is deliberately blind to
    // which lid you picked — so one capping lid stands for all of them.
    const lidded = withLid(BIN, { enabled: true });
    const relieved = rimUnderside(generateBin(lidded), lidded, RADII);

    // A real ramp, not a flat underside that happens to match.
    expect(plain[0]).toBeLessThan(-1);
    expect(plain[0]).toBeGreaterThan(plain[2]);

    for (let i = 0; i < RADII.length; i++) {
      expect(relieved[i]).toBeCloseTo(plain[i], 3);
    }
  }, 300000);

  it('still relieves the cavity the rail seats in', () => {
    // The guard against "fixing" the lip by not cutting at all: a divider
    // rising to the interior ceiling must still be taken down to the ring's
    // floor wherever the ring passes over it.
    const params: BinParams = {
      ...BIN,
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
    };
    const lidded = withLid(params, { enabled: true });

    const mesh = generateBin(lidded);
    const { innerHalfD, wallTopZ } = frame(mesh, lidded);
    const ring = lidKeepoutRing(0, 0, params.wallThickness);

    // On the divider line, one ring width inboard of the wall: inside the band.
    const y = innerHalfD - (1.4 + ring.width / 2);
    const top = Math.max(...verticalSolidSpans(mesh, 0, y).map(([, hi]) => hi));
    expect(top).toBeLessThanOrEqual(wallTopZ - ring.depthBelowWallTop + 0.05);

    const plainTop = Math.max(...verticalSolidSpans(generateBin(params), 0, y).map(([, hi]) => hi));
    expect(plainTop).toBeGreaterThan(wallTopZ - GRIDFINITY_SPEC.LIP_SMALL_TAPER - 0.05);
  }, 300000);
});
