/**
 * Integration check for the multi-color lip splitter on a real generated bin.
 *
 * Verifies the invariant the whole feature rests on: the preview path (indexed
 * worker mesh) and the export path (flat STL soup) feed the SAME shared
 * `computeLipColoredMesh`, so they must produce identical per-triangle cell
 * assignments and geometry. Also guards that splitting conserves lip surface
 * area (no holes/overlaps introduced) and that band seams stay within the lip's
 * Z extent.
 *
 * Lives in `generators/` (not `__kernel-tests__/`, whose test files vitest
 * excludes). Heavy WASM — run with dangerouslyDisableSandbox; the sandbox kills
 * it with exit 144.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { computeLipGeom } from '@/features/bin-designer/utils/lipCornerClassifier';
import { computeLipColoredMesh } from '@/features/bin-designer/utils/lipSeamSplitter';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { FeatureTag } from './featureTags';
import type { LipAxisCount } from '@/features/bin-designer/types/featureColors';

function triArea(t: ArrayLike<number>, o = 0): number {
  const ux = t[o + 3] - t[o];
  const uy = t[o + 4] - t[o + 1];
  const uz = t[o + 5] - t[o + 2];
  const vx = t[o + 6] - t[o];
  const vy = t[o + 7] - t[o + 1];
  const vz = t[o + 8] - t[o + 2];
  const cx = uy * vz - uz * vy;
  const cy = uz * vx - ux * vz;
  const cz = ux * vy - uy * vx;
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
}

describe('lip multi-color splitter (generated bin)', () => {
  beforeAll(async () => {
    await initBrepjs();
  }, 30_000);

  it('preview and export paths agree, conserve lip area, and keep bands in range', () => {
    const generateBin = getGenerateBin();
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
    });
    const mesh = generateBin(params, undefined, true);
    const { vertices, indices, faceGroups, triangleCount } = mesh;
    expect(triangleCount).toBeGreaterThan(0);
    expect(faceGroups?.some((g) => g.tag === FeatureTag.LIP)).toBe(true);

    const counts = { corners: 2 as LipAxisCount, bands: 2 as LipAxisCount };

    // Indexed accessor (preview path).
    const getIndexed = (i: number): number[] => {
      const b = i * 3;
      const a = indices[b] * 3;
      const c = indices[b + 1] * 3;
      const d = indices[b + 2] * 3;
      return [
        vertices[a],
        vertices[a + 1],
        vertices[a + 2],
        vertices[c],
        vertices[c + 1],
        vertices[c + 2],
        vertices[d],
        vertices[d + 1],
        vertices[d + 2],
      ];
    };

    // Flat de-indexed soup (export path) — same triangle order.
    const flat = new Float32Array(triangleCount * 9);
    for (let i = 0; i < triangleCount; i++) flat.set(getIndexed(i), i * 9);
    const getFlat = (i: number): number[] => Array.from(flat.subarray(i * 9, i * 9 + 9));

    const geom = computeLipGeom(faceGroups ?? [], (i) => {
      const t = getIndexed(i);
      return {
        x: (t[0] + t[3] + t[6]) / 3,
        y: (t[1] + t[4] + t[7]) / 3,
        z: (t[2] + t[5] + t[8]) / 3,
      };
    });
    expect(geom).not.toBeNull();

    const preview = computeLipColoredMesh({
      triangleCount,
      faceGroups: faceGroups ?? [],
      getTriangle: getIndexed,
      geom,
      counts,
    });
    const exportMesh = computeLipColoredMesh({
      triangleCount,
      faceGroups: faceGroups ?? [],
      getTriangle: getFlat,
      geom,
      counts,
    });

    // 1. Preview == export: identical cell assignment + geometry.
    expect(exportMesh.triZones).toEqual(preview.triZones);
    expect(preview.positions).not.toBeNull();
    expect(Array.from(exportMesh.positions!)).toEqual(Array.from(preview.positions!));

    // 2. All four cells of the 2×2 grid are actually painted.
    const lipCells = new Set(preview.triZones.filter((z) => z.startsWith('lip:')));
    expect(lipCells).toEqual(
      new Set(['lip:frontLeft:0', 'lip:frontLeft:1', 'lip:backLeft:0', 'lip:backLeft:1'])
    );

    // 3. Lip surface area is conserved by the split (no holes/overlaps), and
    //    split vertices never escape the original lip's vertex Z bounds
    //    (subdivision only — it adds no out-of-bounds geometry).
    let inputLipArea = 0;
    let origMinZ = Infinity;
    let origMaxZ = -Infinity;
    for (let i = 0; i < triangleCount; i++) {
      const inLip = faceGroups!.some(
        (g) => g.tag === FeatureTag.LIP && i * 3 >= g.start && i * 3 < g.start + g.count
      );
      if (!inLip) continue;
      const t = getIndexed(i);
      inputLipArea += triArea(t);
      for (let v = 0; v < 3; v++) {
        origMinZ = Math.min(origMinZ, t[v * 3 + 2]);
        origMaxZ = Math.max(origMaxZ, t[v * 3 + 2]);
      }
    }
    let outputLipArea = 0;
    for (let i = 0; i < preview.triZones.length; i++) {
      if (!preview.triZones[i].startsWith('lip:')) continue;
      outputLipArea += triArea(preview.positions!, i * 9);
      for (let v = 0; v < 3; v++) {
        const z = preview.positions![i * 9 + v * 3 + 2];
        expect(z).toBeGreaterThanOrEqual(origMinZ - 1e-3);
        expect(z).toBeLessThanOrEqual(origMaxZ + 1e-3);
      }
    }
    expect(outputLipArea).toBeCloseTo(inputLipArea, 2);

    // 4. Band classification stayed within the measured lip Z extent.
    expect(geom!.minZ).toBeGreaterThanOrEqual(origMinZ - 1e-3);
    expect(geom!.maxZ).toBeLessThanOrEqual(origMaxZ + 1e-3);
  }, 60_000);
});
