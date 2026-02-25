// @vitest-environment node
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

/** Default params matching the actual UI defaults from src/core/constants.ts */
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

/** Extract Z bounding box from mesh vertices */
function zBounds(vertices: Float32Array): { minZ: number; maxZ: number } {
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    const z = vertices[i];
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { minZ, maxZ };
}

const SOCKET_HEIGHT = 5;
const MAGNET_FLOOR = 0.5;

describe('baseplateGenerator', () => {
  // ─── Without magnets ──────────────────────────────────────────────────────
  it('2×2 without magnets (preview)', () => {
    const mesh = generateBaseplate(defaults(), noop, false);
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('2×2 without magnets (export)', () => {
    const mesh = generateBaseplate(defaults(), noop, true);
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  // ─── With magnets — various sizes ─────────────────────────────────────────
  it('1×1 with magnets (preview)', () => {
    const mesh = generateBaseplate(
      defaults({ width: 1, depth: 1, magnetHoles: true }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('2×2 with magnets (preview)', () => {
    const mesh = generateBaseplate(defaults({ magnetHoles: true }), noop, false);
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('2×2 with magnets (export quality)', () => {
    const mesh = generateBaseplate(defaults({ magnetHoles: true }), noop, true);
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('3×3 with magnets', () => {
    const mesh = generateBaseplate(
      defaults({ width: 3, depth: 3, magnetHoles: true }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('4×4 with magnets', () => {
    const mesh = generateBaseplate(
      defaults({ width: 4, depth: 4, magnetHoles: true }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  // ─── With magnets + padding ───────────────────────────────────────────────
  it('2×2 with magnets and padding', () => {
    const mesh = generateBaseplate(
      defaults({
        magnetHoles: true,
        paddingLeft: 5,
        paddingRight: 3,
        paddingFront: 2,
        paddingBack: 4,
      }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  // ─── Fractional edges ─────────────────────────────────────────────────────
  it('2.5×2.5 with magnets and fractional edges', () => {
    const mesh = generateBaseplate(
      defaults({ width: 2.5, depth: 2.5, magnetHoles: true }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  // ─── Z-range verification ─────────────────────────────────────────────────
  it('with magnets, slab extends from Z=0 to Z=SOCKET_HEIGHT+floor+depth', () => {
    const magnetDepth = 2;
    const mesh = generateBaseplate(
      defaults({ width: 1, depth: 1, magnetHoles: true, magnetDepth }),
      noop,
      false
    );
    const { minZ, maxZ } = zBounds(mesh.vertices);
    const expectedHeight = SOCKET_HEIGHT + MAGNET_FLOOR + magnetDepth;
    // Bottom face at Z=0
    expect(minZ).toBeCloseTo(0, 0);
    // Top face at full height
    expect(maxZ).toBeCloseTo(expectedHeight, 0);
  });

  it('without magnets, Z range is 0 to SOCKET_HEIGHT', () => {
    const mesh = generateBaseplate(defaults(), noop, false);
    const { minZ, maxZ } = zBounds(mesh.vertices);
    expect(minZ).toBeCloseTo(0, 0);
    expect(maxZ).toBeCloseTo(SOCKET_HEIGHT, 0);
  });

  it('magnet depth affects total height', () => {
    const depth3 = generateBaseplate(defaults({ magnetHoles: true, magnetDepth: 3 }), noop, false);
    const depth5 = generateBaseplate(defaults({ magnetHoles: true, magnetDepth: 5 }), noop, false);
    const bounds3 = zBounds(depth3.vertices);
    const bounds5 = zBounds(depth5.vertices);
    // Deeper magnets = taller slab
    expect(bounds5.maxZ).toBeGreaterThan(bounds3.maxZ);
    expect(bounds5.maxZ - bounds3.maxZ).toBeCloseTo(2, 0); // 5 - 3 = 2mm difference
  });

  // ─── Different magnet sizes ───────────────────────────────────────────────
  it('2×2 with 8mm magnets', () => {
    const mesh = generateBaseplate(
      defaults({ magnetHoles: true, magnetDiameter: 8, magnetDepth: 3 }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });
});
