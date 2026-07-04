// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import type { MeshData } from '../../bridge/types';
import { initTestKernel } from '@/test/initTestKernel';

type GenerateFn = (
  params: ResolvedBaseplateParams,
  onProgress: (stage: string, progress: number) => void,
  forExport: boolean,
  signal?: AbortSignal
) => MeshData;

let generateBaseplate: GenerateFn;

beforeAll(async () => {
  await initTestKernel();

  const mod = await import('./baseplateGenerator');
  generateBaseplate = mod.generateBaseplate;
}, 30000);

/** Default params matching the actual UI defaults from src/core/constants.ts */
const defaults = (overrides: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams => ({
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
  lightweight: true,
  ...overrides,
});

const noop = (): void => {};

/** Extract X bounding box from mesh vertices */
function xBounds(vertices: Float32Array): { minX: number; maxX: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  return { minX, maxX };
}

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

  // ─── Fractional grids with magnets (holes only in full cells) ──────────────
  it('0.5×0.5 with magnets enabled (no holes — cell too small)', () => {
    const mesh = generateBaseplate(
      defaults({ width: 0.5, depth: 0.5, magnetHoles: true }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('1.5×1.5 with magnets (holes only in the 1×1 full cell)', () => {
    const mesh = generateBaseplate(
      defaults({ width: 1.5, depth: 1.5, magnetHoles: true }),
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

  // ─── Solid floor (magnet-free) ────────────────────────────────────────────
  it('solid floor adds its thickness below the socket (taller plate)', () => {
    const thickness = 0.8;
    const hollow = generateBaseplate(defaults(), noop, true);
    const floored = generateBaseplate(
      defaults({ solidFloor: true, solidFloorThickness: thickness }),
      noop,
      true
    );
    const hollowZ = zBounds(hollow.vertices);
    const flooredZ = zBounds(floored.vertices);
    // Through-cut plate is exactly the socket height; the floor grows it downward.
    expect(hollowZ.maxZ).toBeCloseTo(SOCKET_HEIGHT, 0);
    expect(flooredZ.maxZ).toBeCloseTo(SOCKET_HEIGHT + thickness, 1);
  });

  it('solid floor thickness is customizable', () => {
    const thin = generateBaseplate(
      defaults({ solidFloor: true, solidFloorThickness: 0.8 }),
      noop,
      true
    );
    const thick = generateBaseplate(
      defaults({ solidFloor: true, solidFloorThickness: 3 }),
      noop,
      true
    );
    expect(zBounds(thick.vertices).maxZ - zBounds(thin.vertices).maxZ).toBeCloseTo(2.2, 1);
  });

  it('solid floor defaults to 0.8mm when thickness omitted', () => {
    const mesh = generateBaseplate(defaults({ solidFloor: true }), noop, true);
    expect(zBounds(mesh.vertices).maxZ).toBeCloseTo(SOCKET_HEIGHT + 0.8, 1);
  });

  it('solid floor stacks below the magnet layer, adding its thickness', () => {
    const magnetDepth = 2;
    const thickness = 0.8;
    const magnetsOnly = generateBaseplate(
      defaults({ width: 1, depth: 1, magnetHoles: true, magnetDepth }),
      noop,
      true
    );
    const magnetsSolid = generateBaseplate(
      defaults({
        width: 1,
        depth: 1,
        magnetHoles: true,
        magnetDepth,
        solidFloor: true,
        solidFloorThickness: thickness,
      }),
      noop,
      true
    );
    // The solid floor is added below the magnet retaining floor, so the plate
    // grows by exactly the floor thickness. Magnet holes stay magnetDepth deep
    // from the socket bottom — the extra floor is retaining material below them.
    expect(zBounds(magnetsSolid.vertices).maxZ - zBounds(magnetsOnly.vertices).maxZ).toBeCloseTo(
      thickness,
      1
    );
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

  // ─── Tongue-and-groove connectors ────────────────────────────────────────

  it('tongue expands bounding box beyond slab on join edge', () => {
    // Left piece of a 2-column split: right edge = join (groove), all others exterior
    const baseMesh = generateBaseplate(defaults({ width: 3, depth: 3 }), noop, false);
    const withTongue = generateBaseplate(
      defaults({
        width: 3,
        depth: 3,
        connectorNubs: true,
        edges: { left: 'join', right: 'exterior', front: 'exterior', back: 'exterior' },
      }),
      noop,
      false
    );
    const baseBB = xBounds(baseMesh.vertices);
    const tongueBB = xBounds(withTongue.vertices);
    // Tongue protrudes in -X from left wall → minX should decrease
    expect(tongueBB.minX).toBeLessThan(baseBB.minX - 0.5);
  });

  it('groove does not expand bounding box (cuts inward)', () => {
    const baseMesh = generateBaseplate(defaults({ width: 3, depth: 3 }), noop, false);
    const withGroove = generateBaseplate(
      defaults({
        width: 3,
        depth: 3,
        connectorNubs: true,
        edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
      }),
      noop,
      false
    );
    const baseBB = xBounds(baseMesh.vertices);
    const grooveBB = xBounds(withGroove.vertices);
    // Groove is cut inward — bounding box should stay the same or shrink
    expect(grooveBB.maxX).toBeLessThanOrEqual(baseBB.maxX + 0.01);
  });

  it('tongue-and-groove connectors with magnets produce valid mesh', () => {
    const mesh = generateBaseplate(
      defaults({
        width: 3,
        depth: 3,
        magnetHoles: true,
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'exterior', back: 'exterior' },
      }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  });

  it('corner pieces trim tongues at join-edge intersections', () => {
    // Interior piece: all 4 edges are join → all tongues trimmed at both ends
    const mesh = generateBaseplate(
      defaults({
        width: 2,
        depth: 2,
        connectorNubs: true,
        edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
      }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
  });

  it('connectors with asymmetric padding produce valid mesh', () => {
    const mesh = generateBaseplate(
      defaults({
        width: 3,
        depth: 3,
        paddingLeft: 10,
        paddingRight: 0,
        paddingFront: 5,
        paddingBack: 0,
        connectorNubs: true,
        edges: { left: 'join', right: 'exterior', front: 'join', back: 'exterior' },
      }),
      noop,
      false
    );
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
  });

  // ─── Lightweight floor ──────────────────────────────────────────────────

  it('generates valid mesh with lightweight floor', () => {
    const result = generateBaseplate(
      defaults({ magnetHoles: true, lightweight: true }),
      noop,
      false
    );
    expect(result.vertices.length).toBeGreaterThan(0);
    expect(result.indices.length).toBeGreaterThan(0);
  });

  it('generates valid mesh without lightweight floor', () => {
    const result = generateBaseplate(
      defaults({ magnetHoles: true, lightweight: false }),
      noop,
      false
    );
    expect(result.vertices.length).toBeGreaterThan(0);
  });

  it('lightweight produces different geometry than solid floor', () => {
    const light = generateBaseplate(
      defaults({ magnetHoles: true, lightweight: true }),
      noop,
      false
    );
    const solid = generateBaseplate(
      defaults({ magnetHoles: true, lightweight: false }),
      noop,
      false
    );
    // Cross cutouts change the mesh
    expect(light.vertices.length).not.toBe(solid.vertices.length);
  });

  describe('corner radius', () => {
    it('generates valid mesh with uniform corner radius', () => {
      const mesh = generateBaseplate(defaults({ cornerRadius: 10 }), noop, false);
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it('generates valid mesh with zero corner radius', () => {
      const mesh = generateBaseplate(defaults({ cornerRadius: 0 }), noop, false);
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it('generates valid mesh with per-corner radii', () => {
      const mesh = generateBaseplate(
        defaults({ cornerRadii: { tl: 2, tr: 10, bl: 5, br: 15 } }),
        noop,
        false
      );
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it('clamps corner radius to half shortest side', () => {
      const mesh = generateBaseplate(
        defaults({ width: 1, depth: 1, cornerRadius: 25 }),
        noop,
        false
      );
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });

    it('split piece only rounds exterior corners', () => {
      const mesh = generateBaseplate(
        defaults({
          cornerRadius: 10,
          edges: { left: 'exterior', right: 'join', front: 'exterior', back: 'exterior' },
        }),
        noop,
        false
      );
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.indices.length).toBeGreaterThan(0);
    });
  });
});
