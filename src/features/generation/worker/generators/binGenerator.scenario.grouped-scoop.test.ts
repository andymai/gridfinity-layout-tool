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

/** Base params: 2×2 solid bin, no lip, for cutout testing */
const solidBase: BinParams = {
  ...DEFAULT_BIN_PARAMS,
  width: 2,
  depth: 2,
  height: 3,
  style: 'solid',
  base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
};

describe('binGenerator — grouped cutouts with scoop', () => {
  it('circle + rectangle group with scoop generates valid mesh', () => {
    const params: BinParams = {
      ...solidBase,
      cutouts: [
        {
          id: 'rect-1',
          shape: 'rectangle',
          x: 10,
          y: 20,
          width: 20,
          depth: 15,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 2,
        },
        {
          id: 'circle-1',
          shape: 'circle',
          x: 25,
          y: 20,
          width: 16,
          depth: 16,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g1',
          scoopRadius: 2,
        },
      ],
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.normals.length).toBe(result.vertices.length);
    expect(result.indices.length).toBe(result.triangleCount * 3);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);

  it('two overlapping rectangles with scoop generates valid mesh', () => {
    const params: BinParams = {
      ...solidBase,
      cutouts: [
        {
          id: 'rect-a',
          shape: 'rectangle',
          x: 10,
          y: 15,
          width: 25,
          depth: 12,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g2',
          scoopRadius: 2,
        },
        {
          id: 'rect-b',
          shape: 'rectangle',
          x: 20,
          y: 10,
          width: 12,
          depth: 25,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g2',
          scoopRadius: 2,
        },
      ],
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);

  it('group with different cut depths and scoop', () => {
    const params: BinParams = {
      ...solidBase,
      cutouts: [
        {
          id: 'shallow',
          shape: 'rectangle',
          x: 10,
          y: 15,
          width: 20,
          depth: 15,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g3',
          scoopRadius: 1.5,
        },
        {
          id: 'deep',
          shape: 'circle',
          x: 25,
          y: 15,
          width: 14,
          depth: 14,
          cutDepth: 6,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g3',
          scoopRadius: 1.5,
        },
      ],
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);

  it('aggressive scoop radius near maximum tests progressive fallback', () => {
    const params: BinParams = {
      ...solidBase,
      cutouts: [
        {
          id: 'rect-big',
          shape: 'rectangle',
          x: 10,
          y: 15,
          width: 20,
          depth: 12,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g4',
          scoopRadius: 5.5,
        },
        {
          id: 'circle-big',
          shape: 'circle',
          x: 25,
          y: 15,
          width: 12,
          depth: 12,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g4',
          scoopRadius: 5.5,
        },
      ],
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);

  it('rotated shapes in group with scoop', () => {
    const params: BinParams = {
      ...solidBase,
      cutouts: [
        {
          id: 'rotated-rect',
          shape: 'rectangle',
          x: 20,
          y: 20,
          width: 25,
          depth: 10,
          cutDepth: 5,
          rotation: 45,
          cornerRadius: 0,
          label: '',
          groupId: 'g5',
          scoopRadius: 2,
        },
        {
          id: 'circle-overlap',
          shape: 'circle',
          x: 30,
          y: 20,
          width: 14,
          depth: 14,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: 'g5',
          scoopRadius: 2,
        },
      ],
    };

    const result = generateBin(params, undefined, true);

    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(10);
  }, 30000);
});
