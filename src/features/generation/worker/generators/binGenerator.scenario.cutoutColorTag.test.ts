// @vitest-environment node
/**
 * Per-cutout shadow-board color face tagging (#2439, stage 2).
 *
 * Verifies the tag contract the paint layer depends on: every cutout cavity is
 * stamped `CUTOUT_COLOR_TAG_BASE + <unit ordinal>` (from the shared
 * `enumerateCutoutColorUnits`) and that stamp survives the boolean cut into
 * distinct face groups. Specifically:
 *  - N ungrouped cutouts -> N distinct cutout tags matching the unit ordinals.
 *  - Each cutout tag carries BOTH floor (|nz|~1) and wall (|nz|~0) faces, so the
 *    floor-vs-wall classification stage 3 does is actually feasible.
 *  - A boolean group collapses to ONE tag (one merged cavity, one color).
 *  - Cutouts are tagged even when uncolored, so toggling a color never changes
 *    geometry (the instant-recolor property).
 *
 * NB: a bin is solid (cutouts actually cut) iff `base.solid` is true — the
 * top-level `style` field does not drive it.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { makeCutout } from './__kernel-tests__/scenarioTypes';
import { triangleNormalZ } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import {
  enumerateCutoutColorUnits,
  cutoutColorTag,
  cutoutOrdinalFromTag,
} from '@/shared/generation/cutoutColorUnits';
import type { BinParams, Cutout } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

interface TagCensus {
  readonly cutoutTags: Map<number, { floor: number; wall: number }>;
}

function census(params: BinParams): TagCensus {
  const m = getGenerateBin()(params);
  const verts = m.vertices;
  const idx = m.indices;
  const fgs = m.faceGroups ?? [];
  expect(verts.length).toBeGreaterThan(0);

  const cutoutTags = new Map<number, { floor: number; wall: number }>();
  for (const fg of fgs) {
    const ordinal = cutoutOrdinalFromTag(fg.tag);
    if (ordinal === null) continue;
    for (let t = 0; t < fg.count / 3; t++) {
      const a = idx[fg.start + t * 3];
      const b = idx[fg.start + t * 3 + 1];
      const c = idx[fg.start + t * 3 + 2];
      const nz = Math.abs(triangleNormalZ(verts, a, b, c));
      const bucket = cutoutTags.get(ordinal) ?? { floor: 0, wall: 0 };
      if (nz > 0.8) bucket.floor++;
      else if (nz < 0.35) bucket.wall++;
      cutoutTags.set(ordinal, bucket);
    }
  }
  return { cutoutTags };
}

const solidBase: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 3,
  height: 5,
  style: 'solid',
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
  cutoutConfig: { topOffset: 0 },
};

describe('per-cutout color face tagging (#2439)', () => {
  it('gives two ungrouped cutouts distinct tags, each with floor + wall faces', () => {
    const cutouts: Cutout[] = [
      makeCutout({ id: 'a', x: 8, y: 40, width: 24, depth: 24, cutDepth: 8, color: '#ef4444' }),
      makeCutout({ id: 'b', x: 70, y: 40, width: 24, depth: 24, cutDepth: 8, color: '#3b82f6' }),
    ];
    const { cutoutTags } = census({ ...solidBase, cutouts });

    expect(enumerateCutoutColorUnits(cutouts)).toHaveLength(2);
    expect(new Set(cutoutTags.keys())).toEqual(new Set([0, 1]));
    expect(cutoutColorTag(0)).toBeGreaterThanOrEqual(1000);
    for (const [, faces] of cutoutTags) {
      expect(faces.floor).toBeGreaterThan(0);
      expect(faces.wall).toBeGreaterThan(0);
    }
  });

  it('collapses a boolean group to a single tag (one merged cavity, one color)', () => {
    const cutouts: Cutout[] = [
      makeCutout({
        id: 'a',
        x: 20,
        y: 40,
        width: 24,
        depth: 20,
        cutDepth: 8,
        groupId: 'g1',
        groupOp: 'union',
        color: '#22c55e',
      }),
      makeCutout({
        id: 'b',
        x: 40,
        y: 40,
        width: 24,
        depth: 20,
        cutDepth: 8,
        groupId: 'g1',
        groupOp: 'union',
        color: '#22c55e',
      }),
    ];
    const { cutoutTags } = census({ ...solidBase, cutouts });

    expect(enumerateCutoutColorUnits(cutouts)).toHaveLength(1);
    expect(new Set(cutoutTags.keys())).toEqual(new Set([0]));
  });

  it('tags cutouts even when uncolored (recolor never regenerates geometry)', () => {
    const cutouts: Cutout[] = [
      makeCutout({ id: 'a', x: 8, y: 40, width: 24, depth: 24, cutDepth: 8 }),
      makeCutout({ id: 'b', x: 70, y: 40, width: 24, depth: 24, cutDepth: 8 }),
    ];
    const { cutoutTags } = census({ ...solidBase, cutouts });
    expect(new Set(cutoutTags.keys())).toEqual(new Set([0, 1]));
  });
});
