// @vitest-environment node
/**
 * A repeated boolean group must cut the SAME boolean at every copy.
 *
 * The tempting implementation, expanding the members and running one boolean
 * over the whole flattened pile, is wrong for every op the feature exists for:
 * Intersect across copies that do not touch is empty, Subtract lets the
 * frontmost copy carve all the others, and Exclude (union minus the
 * intersection of ALL members) degrades to a plain union. So the assertions
 * here are about the op surviving replication, not merely about a mesh
 * appearing.
 *
 * The shape under test is the one from the request: two nested rectangles
 * excluded into a recessed ring, then repeated.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout, CutoutArrayConfig, GroupOp } from '@/shared/types/bin';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';

beforeAll(async () => {
  await initBrepjs();
}, 60000);

const ROW: CutoutArrayConfig = {
  mode: 'grid',
  cols: 3,
  rows: 1,
  pitchX: 34,
  pitchY: 34,
  count: 3,
  radius: 20,
  startAngle: 0,
  rotateToCenter: false,
};

const member = (over: Partial<Cutout>): Cutout => ({
  id: 'x',
  shape: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  depth: 10,
  cutDepth: 4,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: 'g1',
  ...over,
});

/** Outer ring minus inner island: a pocket a lid can sit into. */
function ringBin(op: GroupOp, array?: CutoutArrayConfig): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 4,
    depth: 1,
    height: 3,
    style: 'solid',
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    cutoutConfig: { topOffset: 0 },
    cutouts: [
      member({ id: 'outer', x: 8, y: 10, width: 26, depth: 20, groupOp: op, zIndex: 0, array }),
      member({ id: 'inner', x: 14, y: 14, width: 14, depth: 12, groupOp: op, zIndex: 1, array }),
    ],
  };
}

/** Surface a bin's cutouts add, over a bin with none. */
function cutSurface(params: BinParams): number {
  const withCuts = getGenerateBin()(params).triangleCount;
  const bare = getGenerateBin()({ ...params, cutouts: [] }).triangleCount;
  return withCuts - bare;
}

describe('repeated boolean group', () => {
  it('cuts each copy identically, for every op', () => {
    // The load-bearing assertion: three copies cut exactly three times the
    // surface one does, so each copy is the same boolean result placed
    // elsewhere. One boolean over the expanded members would not land here for
    // any op but union, and would cut nothing at all for intersect.
    for (const op of ['union', 'subtract', 'intersect', 'exclude'] as GroupOp[]) {
      const single = cutSurface(ringBin(op));
      const repeated = cutSurface(ringBin(op, ROW));
      expect(single, op).toBeGreaterThan(0);
      expect(repeated, op).toBe(single * 3);
    }
  }, 240000);

  it('keeps the island in a repeated exclude, rather than degrading to a union', () => {
    // Exclude leaves the inner rectangle standing inside the pocket; union
    // swallows it. One exclude over all six expanded members would find an
    // empty all-member intersection and come out as a plain union, which is
    // the specific regression this pins.
    expect(cutSurface(ringBin('exclude', ROW))).not.toBe(cutSurface(ringBin('union', ROW)));
  }, 240000);

  it('intersects within each copy, not across copies', () => {
    // Copies do not touch, so an intersection taken across ALL of them is
    // empty and cuts nothing. Per copy it is the overlap of the two
    // rectangles, which is the smaller of the two.
    expect(cutSurface(ringBin('intersect', ROW))).toBeGreaterThan(0);
  }, 240000);

  it('produces a sound mesh', () => {
    const mesh = getGenerateBin()(ringBin('exclude', ROW));
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.vertices.some((v) => !Number.isFinite(v))).toBe(false);
  }, 240000);
});
