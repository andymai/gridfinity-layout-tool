// @vitest-environment node
/**
 * GH #2443 — overlapping shadow-board cutouts must keep their floor color.
 *
 * The reporter's "6GT Sizing Die": three ungrouped, same-color cutouts of
 * different depths, two overlapping. A deep cutout overlapping a wide one used
 * to strip the wide cutout's floor of its color tag (the boolean split it into
 * pieces the kernel's origin fallback couldn't match), so that floor rendered
 * in the body color. Fixed in brepjs 18.118.3's coplanar origin matching.
 *
 * Invariants at each cutout's floor depth: (1) no untagged (body-colored)
 * up-facing floor remains, and (2) each cutout contributes floor area under its
 * own color ordinal — so no cutout loses its floor tag.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { makeCutout } from './__kernel-tests__/scenarioTypes';
import { triangleNormalZ, triangleArea } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { cutoutOrdinalFromTag } from '@/shared/generation/cutoutColorUnits';
import type { BinParams, Cutout } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const base: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 1,
  depth: 3,
  height: 4,
  style: 'solid',
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
  cutoutConfig: { topOffset: 0 },
};

const RED = '#ef4444';

describe('GH #2443 overlapping cutout floor color', () => {
  it('keeps every cutout floor tagged, with none reverting to body color', () => {
    const cutouts: Cutout[] = [
      makeCutout({
        id: '0a8fe52b-4737-492f-bf3c-207dd86255bc',
        x: 6.775,
        y: 45.375,
        width: 25.55,
        depth: 59.35,
        cutDepth: 17.53,
        color: RED,
        colorScope: 'floorAndWalls',
      }),
      makeCutout({
        id: '3fcc5493-e07c-46e7-a0fe-d0794ae90220',
        x: 1.825,
        y: 37.3,
        width: 35.5,
        depth: 8.6,
        cutDepth: 21.15,
        color: RED,
        colorScope: 'floorAndWalls',
      }),
      makeCutout({
        id: '07e7b910-9925-41e4-bfaf-a1036663b66c',
        x: 6.775,
        y: 6.3,
        width: 25.55,
        depth: 31,
        cutDepth: 15.53,
        color: RED,
        colorScope: 'floorAndWalls',
      }),
    ];
    // The solid fill surface a cutout is sunk into (cutoutBuilder.ts): wall
    // height minus the global top offset. Each cutout floor sits cutDepth below.
    const solidSurfaceZ = base.height * base.heightUnitMm - base.cutoutConfig.topOffset;
    const floorZs = cutouts.map((c) => solidSurfaceZ - c.cutDepth);

    const m = getGenerateBin()({ ...base, cutouts });
    const verts = m.vertices;
    const idx = m.indices;
    const fgs = m.faceGroups ?? [];
    expect(verts.length).toBeGreaterThan(0);

    // Floor area per cutout ordinal, plus any up-facing floor with no cutout tag.
    const taggedFloorByOrdinal = new Map<number, number>();
    let untaggedFloorArea = 0;
    for (const fg of fgs) {
      const ordinal = cutoutOrdinalFromTag(fg.tag);
      for (let t = 0; t < fg.count / 3; t++) {
        const a = idx[fg.start + t * 3];
        const b = idx[fg.start + t * 3 + 1];
        const c = idx[fg.start + t * 3 + 2];
        if (triangleNormalZ(verts, a, b, c) <= 0.8) continue; // up-facing only
        const cz = (verts[a * 3 + 2] + verts[b * 3 + 2] + verts[c * 3 + 2]) / 3;
        // Restrict to the cutout floor planes (avoid the bin's own surfaces).
        if (!floorZs.some((z) => Math.abs(cz - z) < 0.3)) continue;
        const area = triangleArea(verts, a, b, c);
        if (ordinal === null) {
          untaggedFloorArea += area;
        } else {
          taggedFloorByOrdinal.set(ordinal, (taggedFloorByOrdinal.get(ordinal) ?? 0) + area);
        }
      }
    }

    // Every cutout (ordinals 0..2) keeps a tagged floor.
    for (let ord = 0; ord < cutouts.length; ord++) {
      expect(taggedFloorByOrdinal.get(ord) ?? 0, `cutout ${ord} tagged floor area`).toBeGreaterThan(
        0
      );
    }
    // Before the brepjs fix, cutout 0's ~1500 mm² floor was untagged. Allow a
    // sliver for meshing noise; a real regression reintroduces hundreds of mm².
    expect(untaggedFloorArea).toBeLessThan(5);
  });
});
