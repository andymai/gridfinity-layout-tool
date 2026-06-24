// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { generateBinDirect, canBinUseDirectMesh } from './binDirectMesh';
import { CORNER_SEGMENTS } from './directMeshBuilder';
import { LIP_HEIGHT, LIP_OVERLAP, CLEARANCE } from './generatorConstants';

const bin = (overrides: Partial<BinParams> = {}): BinParams => ({
  ...DEFAULT_BIN_PARAMS,
  ...overrides,
});

const noop = (): void => {};

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function computeBounds(vertices: Float32Array): BoundingBox {
  const bb: BoundingBox = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i],
      y = vertices[i + 1],
      z = vertices[i + 2];
    if (x < bb.minX) bb.minX = x;
    if (x > bb.maxX) bb.maxX = x;
    if (y < bb.minY) bb.minY = y;
    if (y > bb.maxY) bb.maxY = y;
    if (z < bb.minZ) bb.minZ = z;
    if (z > bb.maxZ) bb.maxZ = z;
  }
  return bb;
}

/** Count downward-facing (−Z) triangles whose three vertices all lie at z≈0 —
 *  i.e. foot undersides (the body bottom cap sits at z=SOCKET_HEIGHT, not 0). */
function footBottomTriangles(mesh: { vertices: Float32Array; indices: Uint32Array }): number {
  const { vertices, indices } = mesh;
  let count = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const za = vertices[indices[i] * 3 + 2];
    const zb = vertices[indices[i + 1] * 3 + 2];
    const zc = vertices[indices[i + 2] * 3 + 2];
    if (Math.abs(za) < 1e-3 && Math.abs(zb) < 1e-3 && Math.abs(zc) < 1e-3) count++;
  }
  return count;
}

/** Triangles per fan cap = ring vertex count = 4 quarter-arcs of (segments+1). */
const CAP_TRIS = 4 * (CORNER_SEGMENTS + 1);

/**
 * Signed volume from triangle winding (divergence theorem). Its magnitude is the
 * enclosed volume only when every face is consistently oriented; a flipped or
 * inconsistent face makes contributions cancel, collapsing the magnitude. The
 * codebase's `roundedRectPoints` winding makes the "outward" convention yield a
 * NEGATIVE signed volume (verified against the proven baseplate direct mesh), so
 * a correct bin mesh is large-and-negative. Catches winding bugs that
 * bounding-box/parity checks can't.
 */
function signedVolume(mesh: { vertices: Float32Array; indices: Uint32Array }): number {
  const { vertices, indices } = mesh;
  let v6 = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const ax = vertices[a],
      ay = vertices[a + 1],
      az = vertices[a + 2];
    const bx = vertices[b],
      by = vertices[b + 1],
      bz = vertices[b + 2];
    const cx = vertices[c],
      cy = vertices[c + 1],
      cz = vertices[c + 2];
    // a · (b × c)
    v6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return v6 / 6;
}

describe('binDirectMesh — geometry sanity', () => {
  it('generates a non-empty mesh for the default bin (lip on)', () => {
    const mesh = generateBinDirect(bin(), noop);
    expect(mesh.vertices.length).toBeGreaterThan(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.edgeVertices.length).toBeGreaterThan(0);
  });

  it('generates a non-empty mesh with the lip disabled', () => {
    const mesh = generateBinDirect(
      bin({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }),
      noop
    );
    expect(mesh.triangleCount).toBeGreaterThan(0);
  });

  it('produces no NaN/Infinity in positions or normals', () => {
    const mesh = generateBinDirect(bin(), noop);
    for (let i = 0; i < mesh.vertices.length; i++) {
      expect(Number.isFinite(mesh.vertices[i])).toBe(true);
    }
    for (let i = 0; i < mesh.normals.length; i++) {
      expect(Number.isFinite(mesh.normals[i])).toBe(true);
    }
  });

  it('winds every face consistently outward (large negative signed volume)', () => {
    // Lip on, no lip, and half sockets all exercise different emitters. A flipped
    // or inconsistent face would push the volume toward zero (cancellation) or
    // positive (global flip); a correct mesh is large-and-negative (≈ −solid mm³).
    for (const params of [
      bin(),
      bin({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }),
      bin({ base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } }),
      // wallThickness === LIP_TAPER_WIDTH: the lip overhang collapses; the mesh
      // must stay consistently oriented (no inverted/zero-area underside ring).
      bin({ wallThickness: 2.6 }),
    ]) {
      expect(signedVolume(generateBinDirect(params, noop))).toBeLessThan(-1000);
    }
  });

  it('handles a thick wall (lip overhang collapses) without degenerate faces', () => {
    // wallThickness ≥ LIP_TAPER_WIDTH (2.6mm) makes the lip base meet the cavity
    // edge — the overhang ring is skipped rather than emitted inverted.
    const mesh = generateBinDirect(bin({ wallThickness: 2.6 }), noop);
    expect(mesh.triangleCount).toBeGreaterThan(0);
    for (let i = 0; i < mesh.vertices.length; i++) {
      expect(Number.isFinite(mesh.vertices[i])).toBe(true);
    }
  });

  it('bounding box matches the nominal outer footprint and height (lip on)', () => {
    const params = bin({ width: 2, depth: 2, height: 3 });
    const bb = computeBounds(generateBinDirect(params, noop).vertices);
    const outerW = 2 * 42 - CLEARANCE;
    const outerD = 2 * 42 - CLEARANCE;
    expect(bb.minX).toBeCloseTo(-outerW / 2, 1);
    expect(bb.maxX).toBeCloseTo(outerW / 2, 1);
    expect(bb.minY).toBeCloseTo(-outerD / 2, 1);
    expect(bb.maxY).toBeCloseTo(outerD / 2, 1);
    expect(bb.minZ).toBeCloseTo(0, 2);
    // 3U body (21mm) + lip peak (4.4 − 0.1mm overlap).
    expect(bb.maxZ).toBeCloseTo(3 * 7 + LIP_HEIGHT - LIP_OVERLAP, 2);
  });

  it('top sits at the body wall when the lip is disabled', () => {
    const params = bin({
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    });
    const bb = computeBounds(generateBinDirect(params, noop).vertices);
    expect(bb.maxZ).toBeCloseTo(3 * 7, 2);
  });

  it('emits one foot per full cell on a 2×2 bin', () => {
    const mesh = generateBinDirect(bin({ width: 2, depth: 2 }), noop);
    expect(footBottomTriangles(mesh)).toBe(4 * CAP_TRIS);
  });

  it('emits one foot per full cell on a 3×2 bin', () => {
    const mesh = generateBinDirect(bin({ width: 3, depth: 2 }), noop);
    expect(footBottomTriangles(mesh)).toBe(6 * CAP_TRIS);
  });

  it('subdivides into half sockets (16 feet on a 2×2) when enabled', () => {
    const mesh = generateBinDirect(
      bin({ width: 2, depth: 2, base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } }),
      noop
    );
    expect(footBottomTriangles(mesh)).toBe(16 * CAP_TRIS);
  });

  it('places a fractional edge foot for a 2.5×2 bin', () => {
    // width 2.5 → cells [1,1,0.5] × [1,1] = 6 feet.
    const mesh = generateBinDirect(bin({ width: 2.5, depth: 2 }), noop);
    expect(footBottomTriangles(mesh)).toBe(6 * CAP_TRIS);
    const bb = computeBounds(mesh.vertices);
    expect(bb.maxX - bb.minX).toBeCloseTo(2.5 * 42 - CLEARANCE, 1);
  });

  it('generates an 8×8 bin in under 200ms', () => {
    const start = performance.now();
    const mesh = generateBinDirect(bin({ width: 8, depth: 8, height: 6 }), noop);
    const elapsed = performance.now() - start;
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(200);
  });

  it('throws on degenerate dimensions', () => {
    expect(() => generateBinDirect(bin({ width: 0 }), noop)).toThrow();
    expect(() => generateBinDirect(bin({ depth: -1 }), noop)).toThrow();
    expect(() => generateBinDirect(bin({ height: 0 }), noop)).toThrow();
    expect(() => generateBinDirect(bin({ width: 999 }), noop)).toThrow();
  });

  it('aborts when the signal is already aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => generateBinDirect(bin(), noop, controller.signal)).toThrow();
  });
});

describe('binDirectMesh — canBinUseDirectMesh gate', () => {
  it('allows the default bin (standard + lip)', () => {
    expect(canBinUseDirectMesh(DEFAULT_BIN_PARAMS)).toBe(true);
  });

  it('allows a no-lip standard bin', () => {
    expect(
      canBinUseDirectMesh(bin({ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false } }))
    ).toBe(true);
  });

  it('allows half sockets', () => {
    expect(
      canBinUseDirectMesh(bin({ base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true } }))
    ).toBe(true);
  });

  // Magnet/screw bases share the body + feet with standard; only the unseen
  // foot-underside holes differ, so they ride the direct path.
  for (const style of ['magnet', 'screw', 'magnet_and_screw'] as const) {
    it(`allows ${style} base`, () => {
      expect(canBinUseDirectMesh(bin({ base: { ...DEFAULT_BIN_PARAMS.base, style } }))).toBe(true);
    });
  }

  const base = DEFAULT_BIN_PARAMS.base;
  const fallbackCases: ReadonlyArray<readonly [string, Partial<BinParams>]> = [
    ['weighted base', { base: { ...base, style: 'weighted' } }],
    ['flat base', { base: { ...base, style: 'flat' } }],
    ['solid base', { base: { ...base, solid: true } }],
    ['lightweight base', { base: { ...base, lightweight: true } }],
    ['slotted body', { style: 'slotted' }],
    ['solid body', { style: 'solid' }],
    [
      'compartments',
      { compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, cells: [0, 1] } },
    ],
    ['scoop', { scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true } }],
    ['label', { label: { ...DEFAULT_BIN_PARAMS.label, enabled: true } }],
    ['wall cutouts', { walls: { ...DEFAULT_BIN_PARAMS.walls, enabled: true } }],
    ['handles', { handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true } }],
    ['wall pattern', { wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true } }],
    ['lid', { lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } }],
    ['overhang', { overhang: { left: 2, right: 0, front: 0, back: 0 } }],
  ];

  for (const [label, override] of fallbackCases) {
    it(`falls back for ${label}`, () => {
      expect(canBinUseDirectMesh(bin(override))).toBe(false);
    });
  }

  it('falls back when an insert is present', () => {
    const params = bin();
    const withInsert = { ...params, inserts: [{} as never] };
    expect(canBinUseDirectMesh(withInsert)).toBe(false);
  });

  it('falls back when a cutout is present', () => {
    const params = bin();
    const withCutout = { ...params, cutouts: [{} as never] };
    expect(canBinUseDirectMesh(withCutout)).toBe(false);
  });
});
