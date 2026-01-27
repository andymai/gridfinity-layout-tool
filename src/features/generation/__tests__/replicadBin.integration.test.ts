// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';

type GenerateFn = (
  params: BinParams,
  onProgress?: (stage: string, progress: number) => void,
  forExport?: boolean
) => MeshData;

type GenerateForExportFn = (
  params: BinParams,
  tolerance?: number,
  angularTolerance?: number,
  onProgress?: (stage: string, progress: number) => void
) => MeshData;

let generateBin: GenerateFn;
let generateForExport: GenerateForExportFn;

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
  generateForExport = mod.generateForExport as GenerateForExportFn;
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

  describe('export quality vs preview quality', () => {
    it('generateForExport produces more triangles than preview for large bins', () => {
      // Large bin (4x4) uses coarse tessellation in preview mode
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 4,
        depth: 4,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      };

      const previewResult = generateBin(params, undefined, false);
      const exportResult = generateForExport(params);

      // Export should have significantly more triangles due to finer tessellation
      expect(exportResult.triangleCount).toBeGreaterThan(previewResult.triangleCount);
      // Export should always have normals
      expect(exportResult.normals.length).toBe(exportResult.vertices.length);
    }, 120000);

    it('generateForExport always includes normals', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 4,
        depth: 4,
      };

      const result = generateForExport(params);

      // Export mesh should always have normals (not skipped like large preview)
      expect(result.normals.length).toBe(result.vertices.length);
      expect(result.normals.length).toBeGreaterThan(0);
    }, 60000);

    it('generateForExport uses configurable tessellation tolerance', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
      };

      // Fine tessellation (default 0.01mm)
      const fineResult = generateForExport(params, 0.01, 5);
      // Coarse tessellation
      const coarseResult = generateForExport(params, 1.0, 30);

      // Finer tolerance should produce more triangles
      expect(fineResult.triangleCount).toBeGreaterThan(coarseResult.triangleCount);
    }, 120000);

    it('forExport flag in generateBin produces higher quality', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      };

      const previewResult = generateBin(params, undefined, false);
      const exportResult = generateBin(params, undefined, true);

      // Export mode should produce more triangles
      expect(exportResult.triangleCount).toBeGreaterThan(previewResult.triangleCount);
    }, 120000);
  });
});
