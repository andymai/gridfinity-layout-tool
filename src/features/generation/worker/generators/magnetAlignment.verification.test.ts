// @vitest-environment node
/**
 * Magnet hole alignment verification.
 *
 * Generates bins and verifies magnet hole positions match the Gridfinity spec
 * (±13mm from cell center) regardless of halfSockets mode. This catches the
 * class of bug where half-socket sub-cell decomposition shifts magnet holes
 * to incorrect positions (±10.5mm).
 *
 * Detection strategy: magnet holes are cylinders at Z=0 (socket bottom). Their
 * tessellated walls produce rings of vertices around each hole center. We find
 * these rings at the bottom Z layer and verify their centers.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { HOLE_OFFSET, SIZE } from './generatorTypes';

type GenerateFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;
let generateBin: GenerateFn;

beforeAll(async () => {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const mod = await import('@/features/generation/worker/generators/binGenerator');
  generateBin = mod.generateBin as GenerateFn;
}, 30000);

/**
 * Extract vertex XY clusters at the minimum Z level of the mesh.
 * The bottom of the socket (Z=0 in the output mesh) has both corner features
 * and magnet hole rings. The magnet hole rings are circles of vertices around
 * the hole center at ±HOLE_OFFSET from cell center.
 */
function getBottomXYClusters(mesh: MeshData): Array<{ x: number; y: number; count: number }> {
  const verts: Array<[number, number, number]> = [];
  for (let i = 0; i < mesh.vertices.length; i += 3) {
    verts.push([mesh.vertices[i], mesh.vertices[i + 1], mesh.vertices[i + 2]]);
  }

  const minZ = Math.min(...verts.map(([, , z]) => z));
  const bottomVerts = verts.filter(([, , z]) => z - minZ < 0.1);

  // Cluster by XY (3mm grid)
  const grid = new Map<string, { sumX: number; sumY: number; count: number }>();
  for (const [x, y] of bottomVerts) {
    const key = `${Math.round(x / 3) * 3},${Math.round(y / 3) * 3}`;
    const entry = grid.get(key);
    if (entry) {
      entry.sumX += x;
      entry.sumY += y;
      entry.count++;
    } else {
      grid.set(key, { sumX: x, sumY: y, count: 1 });
    }
  }

  return [...grid.values()]
    .filter((e) => e.count >= 3)
    .map((e) => ({
      x: Math.round((e.sumX / e.count) * 10) / 10,
      y: Math.round((e.sumY / e.count) * 10) / 10,
      count: e.count,
    }));
}

/**
 * Check if any cluster center is near the given XY position.
 * Magnet hole vertices form rings — the average of a ring's vertices
 * approximates the hole center.
 */
function hasClusterNear(
  clusters: Array<{ x: number; y: number }>,
  targetX: number,
  targetY: number,
  tolerance = 4
): boolean {
  return clusters.some(
    (c) => Math.abs(c.x - targetX) < tolerance && Math.abs(c.y - targetY) < tolerance
  );
}

describe('magnet hole alignment verification', () => {
  it('1×1 standard bin has magnet vertices near ±13mm', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
    };

    const mesh = generateBin(params);
    const clusters = getBottomXYClusters(mesh);

    // Should have vertex clusters near each of the 4 magnet hole positions
    expect(hasClusterNear(clusters, -HOLE_OFFSET, -HOLE_OFFSET)).toBe(true);
    expect(hasClusterNear(clusters, -HOLE_OFFSET, HOLE_OFFSET)).toBe(true);
    expect(hasClusterNear(clusters, HOLE_OFFSET, -HOLE_OFFSET)).toBe(true);
    expect(hasClusterNear(clusters, HOLE_OFFSET, HOLE_OFFSET)).toBe(true);
  }, 30000);

  it('1×1 with halfSockets has magnet vertices at ±13mm (not ±10.5mm)', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', halfSockets: true },
    };

    const mesh = generateBin(params);
    const clusters = getBottomXYClusters(mesh);

    // Correct positions: ±13mm from cell center (Gridfinity spec)
    expect(hasClusterNear(clusters, -HOLE_OFFSET, -HOLE_OFFSET)).toBe(true);
    expect(hasClusterNear(clusters, -HOLE_OFFSET, HOLE_OFFSET)).toBe(true);
    expect(hasClusterNear(clusters, HOLE_OFFSET, -HOLE_OFFSET)).toBe(true);
    expect(hasClusterNear(clusters, HOLE_OFFSET, HOLE_OFFSET)).toBe(true);

    // Wrong positions: ±10.5mm (half-cell sub-cell centers — the bug we fixed)
    // These are far enough from ±13mm that a tight tolerance distinguishes them
    const WRONG_OFFSET = SIZE / 4; // 10.5mm
    // Use tight tolerance (1.5mm) — 10.5 and 13 are 2.5mm apart
    expect(hasClusterNear(clusters, -WRONG_OFFSET, -WRONG_OFFSET, 1.5)).toBe(false);
    expect(hasClusterNear(clusters, WRONG_OFFSET, WRONG_OFFSET, 1.5)).toBe(false);
  }, 30000);

  it('halfSockets does not change magnet hole positions', () => {
    const base: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
    };

    const meshStd = generateBin({ ...base, base: { ...base.base, halfSockets: false } });
    const meshHalf = generateBin({ ...base, base: { ...base.base, halfSockets: true } });

    const clustersStd = getBottomXYClusters(meshStd);
    const clustersHalf = getBottomXYClusters(meshHalf);

    // Filter for clusters near expected magnet positions only (exclude socket corners)
    const isMagnetCluster = (c: { x: number; y: number }) => {
      // For a 2×2 bin, cell centers at (±21, ±21), magnets at center ± 13mm
      const cellCenters = [
        [-SIZE / 2, -SIZE / 2],
        [-SIZE / 2, SIZE / 2],
        [SIZE / 2, -SIZE / 2],
        [SIZE / 2, SIZE / 2],
      ];
      return cellCenters.some(
        ([cx, cy]) =>
          Math.abs(Math.abs(c.x - cx) - HOLE_OFFSET) < 4 &&
          Math.abs(Math.abs(c.y - cy) - HOLE_OFFSET) < 4
      );
    };

    const magnetClustersStd = clustersStd.filter(isMagnetCluster);
    const magnetClustersHalf = clustersHalf.filter(isMagnetCluster);

    // Both should have the same magnet-area clusters
    for (const sc of magnetClustersStd) {
      const match = magnetClustersHalf.some(
        (h) => Math.abs(h.x - sc.x) < 2 && Math.abs(h.y - sc.y) < 2
      );
      expect(match, `halfSockets missing magnet cluster at (${sc.x}, ${sc.y})`).toBe(true);
    }
  }, 60000);
});
