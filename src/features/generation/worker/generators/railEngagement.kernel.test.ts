/**
 * Pins the datum every rail-clearance assertion is stated against.
 *
 * `worstRailInterference` does not read zero on a bin that seats perfectly: the
 * click rail's bump protrudes past its spine and sits inside the stacking lip's
 * undercut, which is the snap fit engaging. Every clearance suite therefore
 * asserts `< RAIL_ENGAGEMENT_CEILING + tolerance`, and that only means anything
 * while the ceiling matches what a feature-free bin actually measures.
 *
 * If this fails, the rail profile or the probe moved. Re-measure and update the
 * constant deliberately — do not widen the tolerances that depend on it.
 *
 *   pnpm run test:run src/features/generation/worker/generators/railEngagement.kernel
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import {
  interferenceAt,
  lidZOffset,
  railKeepoutIntrusionMm,
  RAIL_ENGAGEMENT_CEILING,
  worstRailInterference,
} from './__kernel-tests__/lidSeating';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import { LID_FIT_CLEARANCE, LID_CORNER_RADIUS } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 180_000);

/** A bin with a click-rail lid and nothing inside it to clash with. */
function featureFree(width: number, depth: number): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width,
    depth,
    height: 6,
    lid: {
      ...DEFAULT_BIN_PARAMS.lid,
      enabled: true,
      attachment: 'clickRails',
      clickRails: { front: true, back: true, left: true, right: true },
      relieveInterior: false,
    },
  };
}

async function floorFor(width: number, depth: number): Promise<number> {
  const { generateLid } = await import('./lidOrchestrator');
  const params = featureFree(width, depth);
  const bin = getGenerateBin()(params, undefined, false);
  const lid = generateLid(params);
  if (!bin || !lid) throw new Error(`expected the ${width}x${depth} pair to build`);
  return worstRailInterference(bin, lid, lidZOffset(params));
}

/** Worst reading on each of the four rail lines, taken separately. */
function wallReadings(bin: MeshData, lid: MeshData, dz: number): number[] {
  const bb = boundingBox(lid.vertices);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const inset = LID_CORNER_RADIUS - LID_FIT_CLEARANCE;
  const sx = (bb.maxX - bb.minX) / 2 - inset;
  const sy = (bb.maxY - bb.minY) / 2 - inset;
  const walls = [0, 0, 0, 0];
  for (const off of [-0.6, -0.2, 0, 0.6, 1.4]) {
    for (let s = -sx; s <= sx; s += 1) {
      walls[0] = Math.max(walls[0], interferenceAt(bin, lid, cx + s, cy - sy - off, dz));
      walls[1] = Math.max(walls[1], interferenceAt(bin, lid, cx + s, cy + sy + off, dz));
    }
    for (let s = -sy; s <= sy; s += 1) {
      walls[2] = Math.max(walls[2], interferenceAt(bin, lid, cx - sx - off, cy + s, dz));
      walls[3] = Math.max(walls[3], interferenceAt(bin, lid, cx + sx + off, cy + s, dz));
    }
  }
  return walls;
}

describe('rail engagement datum', () => {
  it.each([
    [2, 2],
    [2, 3],
    [3, 2],
    [3, 3],
  ])(
    'a feature-free %ix%i reads the ceiling',
    async (w, d) => {
      expect(await floorFor(w, d)).toBeCloseTo(RAIL_ENGAGEMENT_CEILING, 2);
    },
    300_000
  );

  it('the keep-out sweep answers the same on a preview and an export mesh', async () => {
    // Every suite that uses the sweep hands it the preview mesh, whose base
    // socket rides unfused: a column over a foot crosses that seam and would
    // pair into spans reporting the cavity solid. Reading the topmost crossing
    // is what makes the answer independent of which mesh arrives, and nothing
    // else asserts that. Both a clean pairing and an obstructed one, since
    // agreeing on zero would prove nothing.
    const { generateLid } = await import('./lidOrchestrator');
    const clean = featureFree(3, 2);
    const obstructed: BinParams = {
      ...clean,
      compartments: { cols: 3, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4, 5] },
    };
    // Built from `clean`, so the lid keeps whole rails over dividers it does
    // not know about. Rails notched around them would gate the sweep out.
    const lid = generateLid(clean);
    if (!lid) throw new Error('expected the lid to build');

    const readings = [clean, obstructed].map((params) => {
      const preview = getGenerateBin()(params, undefined, false);
      const exported = getGenerateBin()(params, undefined, true);
      if (!preview || !exported) throw new Error('expected both meshes to build');
      const dz = lidZOffset(params);
      return {
        preview: railKeepoutIntrusionMm(preview, lid, params, dz),
        exported: railKeepoutIntrusionMm(exported, lid, params, dz),
      };
    });

    expect(readings[0]).toEqual({ preview: 0, exported: 0 });
    expect(readings[1].preview).toBeCloseTo(readings[1].exported, 2);
    expect(readings[1].preview).toBeGreaterThan(1);
  }, 300_000);

  it('reads the same on all four walls, which a clash would not', async () => {
    // What identifies the figure as the rail's own profile rather than a clash
    // someone tuned a threshold around. A clash sits on the wall that carries
    // the feature causing it; the snap fit is on every wall that carries rail.
    const { generateLid } = await import('./lidOrchestrator');
    const params = featureFree(3, 2);
    const bin = getGenerateBin()(params, undefined, false);
    const lid = generateLid(params);
    if (!bin || !lid) throw new Error('expected the pair to build');
    for (const mm of wallReadings(bin, lid, lidZOffset(params))) {
      expect(mm).toBeCloseTo(RAIL_ENGAGEMENT_CEILING, 2);
    }
  }, 300_000);
});
