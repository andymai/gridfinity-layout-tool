// @vitest-environment node
/**
 * Performance benchmarks for baseplate generation.
 *
 * Measures generation time for representative configurations to guard against
 * performance regressions. These are not strict thresholds — they log timing
 * data for comparison across changes.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';

type GenerateFn = (
  params: BaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean,
  signal?: AbortSignal
) => MeshData;

let generateBaseplate: GenerateFn;

beforeAll(async () => {
  const { initFromOC } = await import('brepjs');
  const opencascade = (await import('brepjs-opencascade/src/brepjs_single.js')).default;
  const { readFileSync } = await import('fs');
  const { join } = await import('path');

  const wasmPath = join(process.cwd(), 'node_modules/brepjs-opencascade/src/brepjs_single.wasm');
  const wasmBinary = readFileSync(wasmPath);
  const OC = await opencascade({ wasmBinary });
  initFromOC(OC);

  const mod = await import('./baseplateGenerator');
  generateBaseplate = mod.generateBaseplate;
}, 30000);

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 2,
  depth: 2,
  gridUnitMm: 42,
  magnetHoles: false,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...overrides,
});

const noop = (): void => {};

function benchmark(label: string, params: BaseplateParams, forExport = false): void {
  // Clear any cached results by generating with a unique padding value first,
  // then measure the actual generation
  const start = performance.now();
  const mesh = generateBaseplate(params, noop, forExport);
  const elapsed = performance.now() - start;

  // eslint-disable-next-line no-console -- benchmark output
  console.log(`[benchmark] ${label}: ${elapsed.toFixed(0)}ms`);

  expect(mesh.vertices.length).toBeGreaterThan(0);
  expect(mesh.indices.length).toBeGreaterThan(0);
}

describe('baseplateGenerator benchmarks', () => {
  it('2×2 without magnets (preview)', () => {
    benchmark('2x2 no magnets', defaults());
  });

  it('4×4 without magnets (preview)', () => {
    benchmark('4x4 no magnets', defaults({ width: 4, depth: 4 }));
  });

  it('4×4 with magnets (preview)', () => {
    benchmark('4x4 with magnets', defaults({ width: 4, depth: 4, magnetHoles: true }));
  });

  it('6×4 with magnets (preview) — stress test', () => {
    benchmark('6x4 with magnets', defaults({ width: 6, depth: 4, magnetHoles: true }));
  });

  it('3×3 with magnets + connectors (preview)', () => {
    benchmark(
      '3x3 magnets+connectors',
      defaults({
        width: 3,
        depth: 3,
        magnetHoles: true,
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'exterior', back: 'exterior' },
      })
    );
  });
});
