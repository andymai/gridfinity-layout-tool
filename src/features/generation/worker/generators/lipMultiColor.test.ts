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
import { GRIDFINITY_SPEC } from '@/shared/printSettings';
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

    const geom = computeLipGeom(faceGroups ?? [], getIndexed);
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
    // Conservation is measured over LIP-tagged output, not over lip-celled
    // output: the color floor hands the support skirt to `body` while it stays
    // LIP-tagged.
    let outputLipArea = 0;
    let coloredLipArea = 0;
    for (let i = 0; i < preview.triZones.length; i++) {
      if (preview.triTags[i] !== FeatureTag.LIP) continue;
      const area = triArea(preview.positions!, i * 9);
      outputLipArea += area;
      if (preview.triZones[i].startsWith('lip:')) coloredLipArea += area;
      for (let v = 0; v < 3; v++) {
        const z = preview.positions![i * 9 + v * 3 + 2];
        expect(z).toBeGreaterThanOrEqual(origMinZ - 1e-3);
        expect(z).toBeLessThanOrEqual(origMaxZ + 1e-3);
      }
    }
    expect(outputLipArea).toBeCloseTo(inputLipArea, 2);

    // 4. The color floor lands above the wall top, so no lip cell reaches the
    //    support skirt or the bin's top surface (#3705). The wall top is the
    //    lip apex less its protrusion; both come from the generated mesh.
    const wallTopZ = origMaxZ - GRIDFINITY_SPEC.LIP_HEIGHT;
    expect(geom!.floorZ).toBeGreaterThan(wallTopZ);
    expect(geom!.floorZ).toBeLessThan(origMaxZ);
    expect(coloredLipArea).toBeLessThan(outputLipArea);
    for (let i = 0; i < preview.triZones.length; i++) {
      if (!preview.triZones[i].startsWith('lip:')) continue;
      for (let v = 0; v < 3; v++) {
        expect(preview.positions![i * 9 + v * 3 + 2]).toBeGreaterThanOrEqual(geom!.floorZ - 1e-6);
      }
    }

    // 5. Band classification stayed within the measured lip Z extent.
    expect(geom!.minZ).toBeGreaterThanOrEqual(origMinZ - 1e-3);
    expect(geom!.maxZ).toBeLessThanOrEqual(origMaxZ + 1e-3);
  }, 60_000);
});
