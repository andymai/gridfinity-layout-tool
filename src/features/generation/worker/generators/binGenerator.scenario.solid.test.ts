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

  it('solid bin with cutout at corner (0,0) produces valid mesh within bin bounds', () => {
    // A 2x2 bin: outerW = 2*42 - 0.5 = 83.5mm, innerW = 83.5 - 2*1.2 = 81.1mm
    // Cutout at x=0, y=0 (bottom-left interior corner) should be positioned at
    // model space (-innerW/2 + w/2, -innerD/2 + d/2) = (-35.55, -35.55)
    const params: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutouts: [
        {
          id: 'corner-cutout',
          shape: 'rectangle',
          x: 0,
          y: 0,
          width: 10,
          depth: 10,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    };

    const result = generateBin(params, undefined, true);
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.triangleCount).toBeGreaterThan(10);

    // Verify mesh bounding box stays within bin outer dimensions
    const outerW = 2 * 42 - 0.5;
    const outerD = outerW;
    const halfW = outerW / 2;
    const halfD = outerD / 2;
    const vertices = result.vertices;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      // Allow small tolerance for tessellation artifacts
      expect(x).toBeGreaterThanOrEqual(-halfW - 0.1);
      expect(x).toBeLessThanOrEqual(halfW + 0.1);
      expect(y).toBeGreaterThanOrEqual(-halfD - 0.1);
      expect(y).toBeLessThanOrEqual(halfD + 0.1);
    }
  }, 30000);

  it('solid bin with centered cutout has more triangles than without', () => {
    const baseParams: BinParams = {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
    };

    const withCutout: BinParams = {
      ...baseParams,
      cutouts: [
        {
          id: 'center-cutout',
          shape: 'rectangle',
          x: 20,
          y: 20,
          width: 15,
          depth: 15,
          cutDepth: 5,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
        },
      ],
    };

    const plainResult = generateBin(baseParams, undefined, true);
    const cutoutResult = generateBin(withCutout, undefined, true);

    // A cutout adds surfaces (cavity walls), so more triangles
    expect(cutoutResult.triangleCount).toBeGreaterThan(plainResult.triangleCount);
  }, 60000);
});
