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
 * Invariant: every up-facing face at a cutout's floor depth carries that
 * cutout's color tag — no untagged (body-colored) floor at those depths.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { makeCutout } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { cutoutOrdinalFromTag } from '@/shared/generation/cutoutColorUnits';
import type { BinParams, Cutout } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

function triNz(v: ArrayLike<number>, a: number, b: number, c: number): number {
  const ux = v[b * 3] - v[a * 3];
  const uy = v[b * 3 + 1] - v[a * 3 + 1];
  const uz = v[b * 3 + 2] - v[a * 3 + 2];
  const vx = v[c * 3] - v[a * 3];
  const vy = v[c * 3 + 1] - v[a * 3 + 1];
  const vz = v[c * 3 + 2] - v[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return nz / (Math.hypot(nx, ny, nz) || 1);
}

function triArea(v: ArrayLike<number>, a: number, b: number, c: number): number {
  const ux = v[b * 3] - v[a * 3];
  const uy = v[b * 3 + 1] - v[a * 3 + 1];
  const uz = v[b * 3 + 2] - v[a * 3 + 2];
  const vx = v[c * 3] - v[a * 3];
  const vy = v[c * 3 + 1] - v[a * 3 + 1];
  const vz = v[c * 3 + 2] - v[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  return Math.hypot(nx, ny, nz) / 2;
}

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
  it('leaves no untagged floor at any cutout depth', () => {
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
    // Floor plane z per cutout: solidSurfaceZ (28) − cutDepth.
    const floorZs = cutouts.map((c) => 28 - c.cutDepth);

    const m = getGenerateBin()({ ...base, cutouts });
    const verts = m.vertices;
    const idx = m.indices;
    const fgs = m.faceGroups ?? [];
    expect(verts.length).toBeGreaterThan(0);

    let taggedFloorArea = 0;
    let untaggedFloorArea = 0;
    for (const fg of fgs) {
      const tagged = cutoutOrdinalFromTag(fg.tag) !== null;
      for (let t = 0; t < fg.count / 3; t++) {
        const a = idx[fg.start + t * 3];
        const b = idx[fg.start + t * 3 + 1];
        const c = idx[fg.start + t * 3 + 2];
        if (triNz(verts, a, b, c) <= 0.8) continue; // up-facing only
        const cz = (verts[a * 3 + 2] + verts[b * 3 + 2] + verts[c * 3 + 2]) / 3;
        // Restrict to the cutout floor planes (avoid the bin's own surfaces).
        if (!floorZs.some((z) => Math.abs(cz - z) < 0.3)) continue;
        const area = triArea(verts, a, b, c);
        if (tagged) taggedFloorArea += area;
        else untaggedFloorArea += area;
      }
    }

    expect(taggedFloorArea).toBeGreaterThan(0);
    // Before the brepjs fix, cutout A's ~1500 mm² floor was untagged. Allow a
    // sliver for meshing noise; a real regression reintroduces hundreds of mm².
    expect(untaggedFloorArea).toBeLessThan(5);
  });
});
