// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

type GenerateFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void
) => MeshData;
let generateBin: GenerateFn;

beforeAll(async () => {
  const { setOC } = await import('replicad');
  const opencascade = (await import('replicad-opencascadejs/src/replicad_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(
    process.cwd(),
    'node_modules/replicad-opencascadejs/src/replicad_single.wasm'
  );
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  setOC(OC);

  const mod = await import('@/features/generation/worker/generators/replicadBin');
  generateBin = mod.generateBin as GenerateFn;
}, 30000);

describe('replicad bin generation', () => {
  it('generates a 1x1 bin without lip', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    };

    const result = generateBin(params);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.normals.length).toBe(result.vertices.length);
    expect(result.vertices.length % 9).toBe(0);
    expect(result.triangleCount).toBeGreaterThan(50);
  }, 30000);

  it('generates a 1x1 bin with lip', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    };

    const result = generateBin(params);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(100);
  }, 30000);

  it('generates a 2x2 bin (DEFAULT_BIN_PARAMS)', () => {
    const result = generateBin(DEFAULT_BIN_PARAMS);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.normals.length).toBe(result.vertices.length);
    expect(result.triangleCount).toBeGreaterThan(100);
  }, 60000);

  describe('half-bin (fractional) dimensions', () => {
    it('generates a 1.5x2 bin with segmented sockets (full + half cells)', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 1.5,
        depth: 2,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.normals.length).toBe(result.vertices.length);
      // More triangles than a 1x2 due to additional half-cell socket
      expect(result.triangleCount).toBeGreaterThan(50);
    }, 60000);

    it('generates a 0.5x0.5 bin with single half-cell socket', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 0.5,
        depth: 0.5,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.normals.length).toBe(result.vertices.length);
      expect(result.triangleCount).toBeGreaterThan(10);
    }, 30000);

    it('generates a 1.5x1.5 bin with lip', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 1.5,
        depth: 1.5,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(50);
    }, 60000);

    it('generates a 0.5x1 bin with half-width socket cell', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 0.5,
        depth: 1,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(10);
    }, 30000);

    it('generates a 1.5x2 bin with magnets only in full cells', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 1.5,
        depth: 2,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: false },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      // More triangles than without magnets due to hole geometry in full cells
      expect(result.triangleCount).toBeGreaterThan(100);
    }, 60000);
  });

  describe('wall cutouts', () => {
    it('generates a 2x2 bin with front wall cutout', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        walls: {
          front: { width: 80, depth: 60 },
          back: { width: 0, depth: 0 },
          left: { width: 0, depth: 0 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.normals.length).toBe(result.vertices.length);
      // Wall cutout adds more triangles due to additional faces from the notch
      expect(result.triangleCount).toBeGreaterThan(100);
    }, 60000);

    it('generates a 2x2 bin with all wall cutouts', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        walls: {
          front: { width: 80, depth: 60 },
          back: { width: 80, depth: 60 },
          left: { width: 80, depth: 60 },
          right: { width: 80, depth: 60 },
          interior: { width: 0, depth: 0 },
        },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(100);
    }, 60000);

    it('generates a 2x2 bin with wall cutouts and stacking lip', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
        walls: {
          front: { width: 80, depth: 60 },
          back: { width: 0, depth: 0 },
          left: { width: 0, depth: 0 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
      };

      const result = generateBin(params);

      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(100);
    }, 60000);

    it('wall cutout actually modifies the mesh (more triangles than without)', () => {
      const baseParams: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        walls: {
          front: { width: 0, depth: 0 },
          back: { width: 0, depth: 0 },
          left: { width: 0, depth: 0 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
      };

      const withCutoutParams: BinParams = {
        ...baseParams,
        walls: {
          front: { width: 80, depth: 60 },
          back: { width: 0, depth: 0 },
          left: { width: 0, depth: 0 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
      };

      const baseResult = generateBin(baseParams);
      const cutoutResult = generateBin(withCutoutParams);

      // Wall cutout adds faces from the notch geometry
      // If cutout works, the mesh should have MORE triangles
      expect(cutoutResult.triangleCount).toBeGreaterThan(baseResult.triangleCount);
    }, 60000);

    it('wall cutout works on non-square bins (2x3)', () => {
      // Tests for positioning bug where halfOuter used wrong dimension
      const baseParams: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 3,
        walls: {
          front: { width: 0, depth: 0 },
          back: { width: 0, depth: 0 },
          left: { width: 0, depth: 0 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
      };

      const withCutoutParams: BinParams = {
        ...baseParams,
        walls: {
          front: { width: 80, depth: 60 },
          back: { width: 0, depth: 0 },
          left: { width: 80, depth: 60 },
          right: { width: 0, depth: 0 },
          interior: { width: 0, depth: 0 },
        },
      };

      const baseResult = generateBin(baseParams);
      const cutoutResult = generateBin(withCutoutParams);

      // Both front (along X) and left (along Y) cutouts should work
      expect(cutoutResult.triangleCount).toBeGreaterThan(baseResult.triangleCount);
    }, 60000);
  });
});
