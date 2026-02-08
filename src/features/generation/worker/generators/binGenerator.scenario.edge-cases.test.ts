/**
 * Edge case tests to find generation failures.
 * These test various parameter combinations that might cause issues.
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

function testParams(name: string, overrides: Partial<BinParams>, timeout = 30000) {
  const params: BinParams = { ...DEFAULT_BIN_PARAMS, ...overrides };
  it(
    name,
    () => {
      const result = generateBin(params);
      expect(result.vertices).toBeDefined();
      expect(result.vertices.length).toBeGreaterThan(0);
      expect(result.triangleCount).toBeGreaterThan(0);
    },
    timeout
  );
}

describe('edge case generation', () => {
  describe('small bins', () => {
    testParams('0.5x0.5x2 minimal bin', { width: 0.5, depth: 0.5, height: 2 });
    testParams('1x1x2 small bin', { width: 1, depth: 1, height: 2 });
    testParams('0.5x1x2 half-width bin', { width: 0.5, depth: 1, height: 2 });
  });

  describe('complex compartments', () => {
    testParams('2x2 with 2x2 compartments', {
      width: 2,
      depth: 2,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    });
    testParams('2x2 with 4x4 compartments', {
      width: 2,
      depth: 2,
      compartments: {
        cols: 4,
        rows: 4,
        cells: Array.from({ length: 16 }, (_, i) => i),
        thickness: 0.8,
      },
    });
    testParams('1x1 with 2x2 compartments', {
      width: 1,
      depth: 1,
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    });
  });

  describe('inserts', () => {
    testParams('2x2 with circle insert', {
      width: 2,
      depth: 2,
      inserts: [
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 0, y: 0, cornerRadius: 0 },
      ],
    });
    testParams('2x2 with rectangle insert', {
      width: 2,
      depth: 2,
      inserts: [
        { shape: 'rounded-rect', width: 30, depth: 20, cutDepth: 5, x: 0, y: 0, cornerRadius: 3 },
      ],
    });
  });

  describe('extreme heights', () => {
    testParams('2x2x20 tall bin', { width: 2, depth: 2, height: 20 });
  });

  describe('stress tests - many compartments', () => {
    testParams(
      '4x4 with 8x8 compartments',
      {
        width: 4,
        depth: 4,
        compartments: {
          cols: 8,
          rows: 8,
          cells: Array.from({ length: 64 }, (_, i) => i),
          thickness: 0.8,
        },
      },
      60000
    );
    testParams(
      '2x2 with 8x8 compartments (tiny cells)',
      {
        width: 2,
        depth: 2,
        compartments: {
          cols: 8,
          rows: 8,
          cells: Array.from({ length: 64 }, (_, i) => i),
          thickness: 0.4,
        },
      },
      60000
    );
  });

  describe('stress tests - multiple inserts', () => {
    testParams('4x4 with 4 inserts', {
      width: 4,
      depth: 4,
      inserts: [
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: -30, y: -30, cornerRadius: 0 },
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: -30, cornerRadius: 0 },
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: -30, y: 30, cornerRadius: 0 },
        { shape: 'circle', width: 20, depth: 20, cutDepth: 5, x: 30, y: 30, cornerRadius: 0 },
      ],
    });
  });

  describe('flat floor (no socket)', () => {
    testParams('2x2x3 flat floor', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    testParams('1x1x2 flat floor', {
      width: 1,
      depth: 1,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    testParams('2x2x3 flat floor with stacking lip', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: true },
    });
    testParams('2x2x3 flat floor without stacking lip', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false },
    });
    testParams('2x2x3 flat floor with compartments', {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    });
    testParams('0.5x0.5x2 flat floor (half-bin)', {
      width: 0.5,
      depth: 0.5,
      height: 2,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
  });

  describe('stress tests - all features combined', () => {
    testParams(
      '4x4 with everything enabled',
      {
        width: 4,
        depth: 4,
        height: 6,
        compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
        inserts: [
          { shape: 'circle', width: 15, depth: 15, cutDepth: 3, x: 0, y: 0, cornerRadius: 0 },
        ],
      },
      60000
    );
  });
});
