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

describe('binGenerator — solid mode', () => {
  it('generates a valid mesh when solid=true', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.normals.length).toBe(result.vertices.length);
    expect(result.indices.length).toBe(result.triangleCount * 3);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);

  it('solid bin has fewer triangles than hollow bin (no interior cavity)', () => {
    const hollowParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: false, stackingLip: false },
    };

    const solidParams: BinParams = {
      ...hollowParams,
      base: { ...hollowParams.base, solid: true },
    };

    const hollowResult = generateBin(hollowParams, undefined, true);
    const solidResult = generateBin(solidParams, undefined, true);

    expect(solidResult.triangleCount).toBeLessThan(hollowResult.triangleCount);
    expect(solidResult.triangleCount).toBeGreaterThan(10);
  }, 60000);

  it('solid bin with stacking lip produces valid mesh', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);
});
