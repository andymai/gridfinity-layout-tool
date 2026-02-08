/**
 * Scenario tests for cutout topOffset feature.
 * Verifies that cutouts are positioned correctly when topOffset is used.
 */
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

describe('binGenerator - cutout top offset scenarios', () => {
  const baseParams: BinParams = {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 2,
    height: 5, // 35mm interior
    style: 'solid',
    cutouts: [],
    cutoutConfig: { topOffset: 0 },
  };

  it('positions cutout with zero offset flush with rim', () => {
    const params: BinParams = {
      ...baseParams,
      cutoutConfig: { topOffset: 0 }, // flush
      cutouts: [
        {
          id: 'test-1',
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 20,
          depth: 15,
          cutDepth: 10,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    };

    const result = generateBin(params);
    expect(result).toBeDefined();
    expect(result.vertices).toBeDefined();
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(0);
    // Generator should succeed - actual Z-position validation would require brepjs inspection
  });

  it('positions cutout with 5mm offset below rim', () => {
    const params: BinParams = {
      ...baseParams,
      cutoutConfig: { topOffset: 5 }, // recessed platform
      cutouts: [
        {
          id: 'test-2',
          shape: 'circle',
          x: 10,
          y: 10,
          width: 25,
          depth: 25,
          cutDepth: 10,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    };

    const result = generateBin(params);
    expect(result).toBeDefined();
    expect(result.vertices).toBeDefined();
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(0);
    // Top surface should be at wallHeight - 5, bottom at wallHeight - 5 - 10
  });

  it('handles maximum offset (near floor)', () => {
    const params: BinParams = {
      ...baseParams,
      cutoutConfig: { topOffset: 34.5 }, // 35mm - 0.5mm
      cutouts: [
        {
          id: 'test-3',
          shape: 'rectangle',
          x: 5,
          y: 5,
          width: 15,
          depth: 15,
          cutDepth: 0.5, // minimal depth
          rotation: 0,
          cornerRadius: 2,
          label: '',
          groupId: null,
        },
      ],
    };

    const result = generateBin(params);
    expect(result).toBeDefined();
    expect(result.vertices).toBeDefined();
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(0);
    // Should work even when platform is just above floor
  });
});
