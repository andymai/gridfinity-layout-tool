// @vitest-environment node
/**
 * Regression tests for stacking lip wall visibility across bin sizes.
 *
 * Issue #781: Bins larger than 5 units lose the outer wall supporting
 * the stacking lip in preview mode due to coarse tessellation collapsing
 * the thin (1.2mm) lip extension geometry.
 *
 * Tests verify that the lip is present and outer wall vertices exist in
 * the lip junction zone for both small and large bins (crossing the
 * isSmallBin threshold at cellCount=16).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS, GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const SOCKET_HEIGHT = GRIDFINITY.SOCKET_HEIGHT;
const SIZE = GRIDFINITY.GRID_SIZE;

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

describe('Stacking lip wall presence in preview (#781)', () => {
  const HEIGHT = 10;
  const wallHeight = HEIGHT * GRIDFINITY.HEIGHT_UNIT - SOCKET_HEIGHT;
  const meshWallHeight = wallHeight + SOCKET_HEIGHT; // After SOCKET_HEIGHT translation

  function countWallVerticesInLipZone(
    mesh: MeshData,
    outerW: number,
    outerD: number
  ): { left: number; right: number; front: number; back: number; maxZ: number } {
    const zMin = meshWallHeight - 2.0;
    const zMax = meshWallHeight + 1.0;
    const proximity = 1.5;

    let left = 0;
    let right = 0;
    let front = 0;
    let back = 0;
    let maxZ = -Infinity;

    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const x = mesh.vertices[i];
      const y = mesh.vertices[i + 1];
      const z = mesh.vertices[i + 2];

      if (z > maxZ) maxZ = z;
      if (z < zMin || z > zMax) continue;

      if (Math.abs(x - -outerW / 2) < proximity) left++;
      if (Math.abs(x - outerW / 2) < proximity) right++;
      if (Math.abs(y - -outerD / 2) < proximity) front++;
      if (Math.abs(y - outerD / 2) < proximity) back++;
    }

    return { left, right, front, back, maxZ };
  }

  // Mix of small-bin and large-bin sizes around the isSmallBin boundary (cellCount < 16):
  //   - 6x2 (12 cells): small bin with large footprint (small-bin tessellation tier)
  //   - 4x4 (16 cells): exactly at the threshold (large-bin + lip tier)
  //   - 5x4 (20 cells): above threshold (large-bin + lip tier)
  //   - 8x2 (16 cells): at threshold, elongated shape (large-bin + lip tier)
  const testCases = [
    { width: 6, depth: 2, label: '6x2 (reported in #781, small bin)' },
    { width: 4, depth: 4, label: '4x4 (threshold)' },
    { width: 5, depth: 4, label: '5x4 (above threshold)' },
    { width: 8, depth: 2, label: '8x2 (large, elongated)' },
  ];

  describe.each(testCases)('$label slotted + stacking lip', ({ width, depth }) => {
    const outerW = width * SIZE - GRIDFINITY.TOLERANCE;
    const outerD = depth * SIZE - GRIDFINITY.TOLERANCE;

    it('preview should have lip and wall vertices in lip zone', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width,
        depth,
        height: HEIGHT,
        style: 'slotted',
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      };
      const mesh = generateBin(params, undefined, false);
      const stats = countWallVerticesInLipZone(mesh, outerW, outerD);

      // Lip must exist (maxZ above wallHeight)
      expect(stats.maxZ).toBeGreaterThan(meshWallHeight);

      // Each outer wall must have vertices in the lip junction zone
      expect(stats.left).toBeGreaterThanOrEqual(2);
      expect(stats.right).toBeGreaterThanOrEqual(2);
      expect(stats.front).toBeGreaterThanOrEqual(2);
      expect(stats.back).toBeGreaterThanOrEqual(2);
    }, 120000);
  });
});
