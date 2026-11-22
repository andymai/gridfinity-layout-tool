// @vitest-environment node
/**
 * The stacking lip's underside chamfer has to reach the wall at every wall
 * thickness.
 *
 * The support under the lip's jut is a 45° face, from the bottom of the throat
 * down and out. Where it stops short of the wall's inner face, the jut's
 * underside between the two is a flat ledge over the cavity, which a slicer
 * prints as a loose strand. A bin with that ledge is watertight and correctly
 * sized, so only a probe under the jut sees it.
 *
 * Measured on the export mesh: the ceiling over each column between the wall's
 * inner face and the throat is the support face, and on a 45° face its height
 * below the wall top is `LIP_SUPPORT_DROP + LIP_TAPER_WIDTH - inset`.
 *
 *   pnpm run test:run src/features/generation/worker/generators/lipSupportThinWall.kernel
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { initTestKernel } from '@/test/initTestKernel';
import { columnCrossings } from './__kernel-tests__/meshAssertions';
import { deriveDimensions } from './pipeline/context';

let generateBin: (params: BinParams, onProgress?: undefined, forExport?: boolean) => MeshData;

beforeAll(async () => {
  await initTestKernel();
  generateBin = (await import('./binOrchestrator')).generateBin;
}, 120000);

const { LIP_SMALL_TAPER, LIP_BIG_TAPER, LIP_SUPPORT_DROP, TOLERANCE } = GRIDFINITY_SPEC;
const LIP_TAPER_WIDTH = LIP_SMALL_TAPER + LIP_BIG_TAPER;

const binWithWall = (wallThickness: number): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  width: 1,
  depth: 1,
  height: 3,
  wallThickness,
  base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
});

/**
 * Height of the cavity's ceiling below the wall top, `inset` in from the front
 * wall's outer face. Off the X axis, which the fan triangulation lines with
 * shared edges.
 */
function ceilingBelowWallTop(mesh: MeshData, params: BinParams, inset: number): number {
  const dim = deriveDimensions(params, true);
  const y = -(params.depth * params.gridUnitMm - TOLERANCE) / 2 + inset;
  const floorTop = dim.wallTopZ - dim.wallHeight + dim.floorThickness;
  const ceiling = columnCrossings(mesh, 0.37, y).find((z) => z > floorTop + 0.05);
  if (ceiling === undefined) throw new Error(`no ceiling over inset ${inset}`);
  return dim.wallTopZ - ceiling;
}

describe('stacking lip support on a thin wall', () => {
  // 1.2mm is the default wall, and the support's foot sits exactly on its inner
  // face; 1.6mm buries the foot in the wall.
  it.each([0.4, 0.6, 0.8, 1.2, 1.6])(
    'runs the underside chamfer at 45 degrees down to a %smm wall',
    (wallThickness) => {
      const params = binWithWall(wallThickness);
      const mesh = generateBin(params, undefined, true);

      const insets: number[] = [];
      for (let inset = wallThickness + 0.05; inset < LIP_TAPER_WIDTH - 0.04; inset += 0.1) {
        insets.push(inset);
      }
      expect(insets.length).toBeGreaterThan(5);

      for (const inset of insets) {
        const expected = LIP_SUPPORT_DROP + LIP_TAPER_WIDTH - inset;
        expect(ceilingBelowWallTop(mesh, params, inset), `inset ${inset.toFixed(2)}`).toBeCloseTo(
          expected,
          2
        );
      }
    },
    300000
  );
});
