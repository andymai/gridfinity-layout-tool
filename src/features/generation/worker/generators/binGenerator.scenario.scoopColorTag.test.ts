// @vitest-environment node
/**
 * Regression for GH #1654 (multi-color scoop): the concave scoop ramp must keep
 * the SCOOP face tag through the body fuse so multi-color bins paint the scoop
 * surface its own color rather than the body color.
 *
 * The ramp's UPPER ARC (faces curving up into the front wall) is the hard case:
 * the boolean regenerates those faces and the kernel's evolution decides whose
 * origin they inherit. The OCCT path attributes them to the untagged wall
 * (origin 0 = body) — the shelved occt-wasm gap. brepkit's faithful
 * shape-evolution (brepkit-wasm >= 2.116, un-skipped in brepjs 18.101) reports
 * each result face's true source, so the arc keeps its SCOOP origin.
 *
 * Under brepkit this asserts ZERO body faces on the arc (locks the upstream
 * fix). Under occt-wasm it only asserts the scoop is tagged at all — the arc
 * still leaks to body there, which is the known, separately-tracked gap.
 */
import { describe, it, beforeAll, expect } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './__kernel-tests__/wasmInit';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { FeatureTag } from './featureTags';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/** Geometric unit normal of a triangle from its three vertices. */
function triNormal(
  verts: ArrayLike<number>,
  a: number,
  b: number,
  c: number
): [number, number, number] {
  const ux = verts[b * 3] - verts[a * 3];
  const uy = verts[b * 3 + 1] - verts[a * 3 + 1];
  const uz = verts[b * 3 + 2] - verts[a * 3 + 2];
  const vx = verts[c * 3] - verts[a * 3];
  const vy = verts[c * 3 + 1] - verts[a * 3 + 1];
  const vz = verts[c * 3 + 2] - verts[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

interface ArcCensus {
  /** Arc faces correctly tagged SCOOP. */
  scoop: number;
  /** Arc faces leaked to the untagged wall (UNKNOWN/BASE) — the #1654 bug, whole arc. */
  bodyFullArc: number;
  /**
   * Faces in the sub-lip slice (cz <= 14) tagged anything OTHER than SCOOP.
   * That slice is pure-scoop territory — no other feature legitimately owns a
   * face there — so a non-zero count means a face escaped to ANY tag (body or,
   * e.g., LIP), which a body-only check would miss.
   */
  nonScoopSubLip: number;
}

/** Tag census of the scoop ramp's curved arc surface (front, up-and-back faces). */
function scoopArcAttribution(params: BinParams): ArcCensus {
  const m = getGenerateBin()(params);
  const verts = m.vertices;
  const idx = m.indices;
  const fgs = m.faceGroups ?? [];
  expect(verts.length).toBeGreaterThan(0);
  expect(idx.length / 3).toBeGreaterThan(800);

  let scoop = 0;
  let bodyFullArc = 0;
  let nonScoopSubLip = 0;
  for (const fg of fgs) {
    for (let t = 0; t < fg.count / 3; t++) {
      const a = idx[fg.start + t * 3];
      const b = idx[fg.start + t * 3 + 1];
      const c = idx[fg.start + t * 3 + 2];
      const cy = (verts[a * 3 + 1] + verts[b * 3 + 1] + verts[c * 3 + 1]) / 3;
      const cz = (verts[a * 3 + 2] + verts[b * 3 + 2] + verts[c * 3 + 2]) / 3;
      // Front region, above the lower ramp; up-and-back normal isolates the
      // curved arc surface from the vertical wall (nz~0) and the floor (nz~1).
      if (cy >= -20 || cz < 8) continue;
      const [, ny, nz] = triNormal(verts, a, b, c);
      if (ny <= 0.45 || nz <= 0.15 || nz >= 0.85) continue;
      const isScoop = fg.tag === FeatureTag.SCOOP;
      if (isScoop) scoop++;
      else if (fg.tag === FeatureTag.UNKNOWN || fg.tag === FeatureTag.BASE) bodyFullArc++;
      // Sub-lip slice is pure scoop: any non-SCOOP tag (incl. a stray LIP) leaks.
      if (cz <= 14 && !isScoop) nonScoopSubLip++;
    }
  }
  return { scoop, bodyFullArc, nonScoopSubLip };
}

describe('scoop arc keeps the SCOOP tag through the body fuse (#1654)', () => {
  const base: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 3,
    scoop: { enabled: true, radius: 'auto' },
    compartments: { cols: 1, rows: 1, cells: [0], thickness: 1.2 },
  };

  it.each([
    ['stacking lip', true],
    ['no lip', false],
  ])(
    'scoop arc is tagged SCOOP (%s)',
    (_label, stackingLip) => {
      const { scoop, bodyFullArc, nonScoopSubLip } = scoopArcAttribution({
        ...base,
        base: { ...base.base, stackingLip },
      });

      expect(scoop).toBeGreaterThan(0);
      // brepkit's faithful evolution keeps the whole arc on the scoop origin:
      // no face leaks to the wall (body), and the pure-scoop sub-lip slice holds
      // no foreign tag at all. occt-wasm still leaks the regenerated arc faces
      // (#1654 gap), so these strict checks are brepkit-only.
      if (getKernelName() === 'brepkit') {
        expect(bodyFullArc).toBe(0);
        expect(nonScoopSubLip).toBe(0);
      }
    },
    120_000
  );
});
