import { describe, it, expect } from 'vitest';
import { splitLipMesh, lipGridIsNonTrivial, computeLipColoredMesh } from './lipSeamSplitter';
import { FeatureTag } from '@/shared/types/generation';
import type { FaceGroupData } from '@/shared/types/generation';
import type { LipGeom } from './lipCornerClassifier';

function triArea(t: ArrayLike<number>): number {
  const ux = t[3] - t[0],
    uy = t[4] - t[1],
    uz = t[5] - t[2];
  const vx = t[6] - t[0],
    vy = t[7] - t[1],
    vz = t[8] - t[2];
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

/** A back wall quad (y=5, x∈[-10,10], z∈[0,10]) as two lip triangles. */
const QUAD: number[][] = [
  [-10, 5, 0, 10, 5, 0, 10, 5, 10],
  [-10, 5, 0, 10, 5, 10, -10, 5, 10],
];
const GEOM: LipGeom = { cx: 0, cy: 0, minZ: 0, maxZ: 10 };
const FACE_GROUPS: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.LIP }];

function run(counts: { corners: 1 | 2 | 4; bands: 1 | 2 | 4 }) {
  return splitLipMesh({
    triangleCount: QUAD.length,
    faceGroups: FACE_GROUPS,
    getTriangle: (i) => QUAD[i],
    geom: GEOM,
    counts,
  });
}

describe('lipSeamSplitter', () => {
  it('flags non-trivial grids only when an axis exceeds 1', () => {
    expect(lipGridIsNonTrivial({ corners: 1, bands: 1 })).toBe(false);
    expect(lipGridIsNonTrivial({ corners: 2, bands: 1 })).toBe(true);
    expect(lipGridIsNonTrivial({ corners: 1, bands: 2 })).toBe(true);
  });

  it('conserves total area when splitting (2 corners × 2 bands)', () => {
    const inputArea = QUAD.reduce((s, t) => s + triArea(t), 0);
    const { positions, triZones } = run({ corners: 2, bands: 2 });
    let outArea = 0;
    for (let i = 0; i < triZones.length; i++)
      outArea += triArea(positions.subarray(i * 9, i * 9 + 9));
    expect(outArea).toBeCloseTo(inputArea, 4);
  });

  it('emits sub-triangles that each lie wholly in one cell (no straddling seams)', () => {
    const { positions, triZones } = run({ corners: 4, bands: 2 });
    // Seam planes for this quad: x=0 (corners=4) and z=5 (bands=2). y=0 split
    // doesn't bisect the all-back quad. Every sub-triangle must stay on one
    // side of x=0 and z=5.
    for (let i = 0; i < triZones.length; i++) {
      const t = positions.subarray(i * 9, i * 9 + 9);
      const xs = [t[0], t[3], t[6]];
      const zs = [t[2], t[5], t[8]];
      const allXNeg = xs.every((x) => x <= 1e-6);
      const allXPos = xs.every((x) => x >= -1e-6);
      const allZLo = zs.every((z) => z <= 5 + 1e-6);
      const allZHi = zs.every((z) => z >= 5 - 1e-6);
      expect(allXNeg || allXPos).toBe(true);
      expect(allZLo || allZHi).toBe(true);
    }
  });

  it('produces all four expected cells for the back wall (2×2)', () => {
    const { triZones } = run({ corners: 4, bands: 2 });
    const unique = new Set(triZones);
    expect(unique).toContain('lip:backLeft:0');
    expect(unique).toContain('lip:backLeft:1');
    expect(unique).toContain('lip:backRight:0');
    expect(unique).toContain('lip:backRight:1');
  });

  it('passes non-lip triangles through unchanged with their tag zone', () => {
    const res = splitLipMesh({
      triangleCount: 1,
      faceGroups: [{ start: 0, count: 3, tag: FeatureTag.SCOOP }],
      getTriangle: () => [0, 0, 0, 1, 0, 0, 0, 1, 0],
      geom: GEOM,
      counts: { corners: 4, bands: 4 },
    });
    expect(res.triZones).toEqual(['scoop']);
    expect(Array.from(res.positions)).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it('does not duplicate a triangle lying on a seam plane', () => {
    // Horizontal quad at z=5, coincident with the bands=2 seam (z = minZ + 5).
    // An inclusive-both halfspace test would emit it in both halves, doubling area.
    const onSeam: number[][] = [
      [-10, 5, 5, 10, 5, 5, 10, -5, 5],
      [-10, 5, 5, 10, -5, 5, -10, -5, 5],
    ];
    const res = splitLipMesh({
      triangleCount: onSeam.length,
      faceGroups: [{ start: 0, count: 6, tag: FeatureTag.LIP }],
      getTriangle: (i) => onSeam[i],
      geom: GEOM,
      counts: { corners: 1, bands: 2 },
    });
    const inputArea = onSeam.reduce((s, t) => s + triArea(t), 0);
    let outArea = 0;
    for (let i = 0; i < res.triZones.length; i++)
      outArea += triArea(res.positions.subarray(i * 9, i * 9 + 9));
    expect(outArea).toBeCloseTo(inputArea, 4);
  });

  it('skips the split when the grid is uniform (lipUniform), classifying in place', () => {
    const base = {
      triangleCount: QUAD.length,
      faceGroups: FACE_GROUPS,
      getTriangle: (i: number) => QUAD[i],
      geom: GEOM,
      counts: { corners: 2 as const, bands: 2 as const },
    };
    // Differing colors → re-tessellate (positions populated).
    expect(computeLipColoredMesh(base).positions).not.toBeNull();
    // Uniform → no seams to honor: classify in place (positions null), one zone
    // per original triangle.
    const uniform = computeLipColoredMesh({ ...base, lipUniform: true });
    expect(uniform.positions).toBeNull();
    expect(uniform.triZones).toHaveLength(QUAD.length);
  });
});

describe('top accent cut', () => {
  // A back wall quad tagged as plain body (no lip), y=5, x∈[-10,10], z∈[0,10].
  const BODY_QUAD: number[][] = [
    [-10, 5, 0, 10, 5, 0, 10, 5, 10],
    [-10, 5, 0, 10, 5, 10, -10, 5, 10],
  ];
  const BODY_FG: FaceGroupData[] = [{ start: 0, count: 6, tag: FeatureTag.UNKNOWN }];

  it('splits body geometry at the cut plane and colors above it top-accent (no lip)', () => {
    const cutZ = 7;
    const { triZones, positions } = computeLipColoredMesh({
      triangleCount: BODY_QUAD.length,
      faceGroups: BODY_FG,
      getTriangle: (i) => BODY_QUAD[i],
      geom: null,
      counts: { corners: 1, bands: 1 },
      topAccentCutZ: cutZ,
    });
    expect(positions).not.toBeNull(); // the cut forces re-tessellation
    // Every output triangle sits wholly on one side of the cut plane and is
    // colored accordingly.
    for (let i = 0; i < triZones.length; i++) {
      const t = positions!.subarray(i * 9, i * 9 + 9);
      const cz = (t[2] + t[5] + t[8]) / 3;
      expect(triZones[i]).toBe(cz > cutZ ? 'topAccent' : 'body');
    }
    expect(triZones).toContain('topAccent');
    expect(triZones).toContain('body');
  });

  it('conserves area across the cut', () => {
    const inputArea = BODY_QUAD.reduce((s, t) => s + triArea(t), 0);
    const { triZones, positions } = computeLipColoredMesh({
      triangleCount: BODY_QUAD.length,
      faceGroups: BODY_FG,
      getTriangle: (i) => BODY_QUAD[i],
      geom: null,
      counts: { corners: 1, bands: 1 },
      topAccentCutZ: 4.2,
    });
    let outArea = 0;
    for (let i = 0; i < triZones.length; i++)
      outArea += triArea(positions!.subarray(i * 9, i * 9 + 9));
    expect(outArea).toBeCloseTo(inputArea, 4);
  });

  it('top accent wins over lip cells above the cut plane', () => {
    // Lip skirt z∈[0,10]; cut at 7 → lip pieces above 7 become top-accent,
    // below stay their lip cell.
    const { triZones, positions } = computeLipColoredMesh({
      triangleCount: QUAD.length,
      faceGroups: FACE_GROUPS,
      getTriangle: (i) => QUAD[i],
      geom: GEOM,
      counts: { corners: 1, bands: 1 },
      topAccentCutZ: 7,
    });
    for (let i = 0; i < triZones.length; i++) {
      const t = positions!.subarray(i * 9, i * 9 + 9);
      const cz = (t[2] + t[5] + t[8]) / 3;
      expect(triZones[i]).toBe(cz > 7 ? 'topAccent' : 'lip:frontLeft:0');
    }
    expect(triZones).toContain('topAccent');
    expect(triZones).toContain('lip:frontLeft:0');
  });

  it('classifies in place (no split) when allowSplit is false, using the centroid', () => {
    // The hit-test path keeps triZones 1:1 with input triangles. tri0 centroid
    // z≈3.3 (below), tri1 centroid z≈6.7 (above) for a cut at 5.
    const { triZones, positions } = computeLipColoredMesh({
      triangleCount: BODY_QUAD.length,
      faceGroups: BODY_FG,
      getTriangle: (i) => BODY_QUAD[i],
      geom: null,
      counts: { corners: 1, bands: 1 },
      topAccentCutZ: 5,
      allowSplit: false,
    });
    expect(positions).toBeNull();
    expect(triZones).toEqual(['body', 'topAccent']);
  });
});
