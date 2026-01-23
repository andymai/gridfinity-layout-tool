// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/features/bin-designer/types';
import type { MeshData } from '@/features/generation/bridge/types';

type GenerateFn = (params: BinParams, onProgress?: (stage: string, progress: number) => void) => MeshData;
let generateBin: GenerateFn;

beforeAll(async () => {
  const { setOC } = await import('replicad');
  const opencascade = (await import('replicad-opencascadejs/src/replicad_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/replicad-opencascadejs/src/replicad_single.wasm');
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
});
