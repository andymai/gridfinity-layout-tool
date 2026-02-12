/**
 * Scenario tests for wall cutout feature.
 * Verifies full generation pipeline produces valid meshes with wall cutouts.
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

describe('binGenerator - wall cutout scenarios', () => {
  it('standard bin with global wall cutouts', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        width: 70,
        depth: 50,
      },
    };
    const mesh = generateBin(params);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  }, 60000);

  it('slotted bin with per-side wall cutouts', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 5,
      style: 'slotted',
      walls: {
        enabled: true,
        width: 0,
        depth: 0,
        front: { enabled: true, width: 80, depth: 60 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: true, width: 50, depth: 40 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: false, width: 0, depth: 0 },
      },
    };
    const mesh = generateBin(params);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  }, 60000);

  it('standard bin with interior wall cutouts and compartments', () => {
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 5,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 1.2 },
      walls: {
        enabled: true,
        width: 70,
        depth: 50,
        front: { enabled: false, width: 0, depth: 0 },
        back: { enabled: false, width: 0, depth: 0 },
        left: { enabled: false, width: 0, depth: 0 },
        right: { enabled: false, width: 0, depth: 0 },
        interior: { enabled: true, width: 70, depth: 50 },
      },
    };
    const mesh = generateBin(params);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  }, 60000);
});
