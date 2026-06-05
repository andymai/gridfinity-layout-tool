// @vitest-environment node
/**
 * Scenario tests for issue #2024 — user-tunable connector fit offset.
 *
 * The fit offset (mm) shifts the per-side groove clearance so people can
 * compensate for printer/filament variation. It only enlarges/shrinks the
 * female groove (the tongue/key stay nominal), so on a tile that carries
 * grooves a looser offset removes MORE material (smaller solid volume) and a
 * tighter offset removes LESS (larger volume). The offset is clamped so the
 * effective clearance can never go negative.
 *
 * These tests verify, end-to-end through the BREP export, that:
 *  - the offset monotonically changes the exported solid's volume, and
 *  - every offset (loose, nominal, clamped-tight) still exports a watertight
 *    2-manifold STL (geometry stays valid — no NaN, no boundary edges).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';

type ExportFn = (
  params: BaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
}, 30000);

const defaults = (overrides: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 4,
  depth: 4,
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
  connectorNubs: true,
  // Interior tile: left/front carry tongues, right/back carry grooves. Only the
  // grooves respond to the fit offset.
  edges: { left: 'join', right: 'join', front: 'join', back: 'join' },
  ...overrides,
});

interface StlStats {
  signedVolume: number;
  nonManifoldEdges: number;
  boundaryEdges: number;
  hasNaN: boolean;
}

/** Signed mesh volume (mm³) + 2-manifold edge accounting from a binary STL. */
function analyze(stl: ArrayBuffer): StlStats {
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;

  const QUANTIZE = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * QUANTIZE)},${Math.round(y * QUANTIZE)},${Math.round(z * QUANTIZE)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const edgeCount = new Map<string, number>();
  let signedVolume = 0;
  let hasNaN = false;

  for (let t = 0; t < triangleCount; t++) {
    const b = t * 9;
    const ax = vertices[b],
      ay = vertices[b + 1],
      az = vertices[b + 2];
    const bx = vertices[b + 3],
      by = vertices[b + 4],
      bz = vertices[b + 5];
    const cx = vertices[b + 6],
      cy = vertices[b + 7],
      cz = vertices[b + 8];
    for (const v of [ax, ay, az, bx, by, bz, cx, cy, cz]) {
      if (Number.isNaN(v) || !Number.isFinite(v)) hasNaN = true;
    }
    // Signed tetrahedron volume against the origin.
    signedVolume +=
      (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;

    const keys = [vKey(ax, ay, az), vKey(bx, by, bz), vKey(cx, cy, cz)];
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }

  let nonManifoldEdges = 0;
  let boundaryEdges = 0;
  for (const count of edgeCount.values()) {
    if (count === 1) boundaryEdges++;
    else if (count > 2) nonManifoldEdges++;
  }
  return { signedVolume: Math.abs(signedVolume), nonManifoldEdges, boundaryEdges, hasNaN };
}

function expectValid(stats: StlStats, label: string): void {
  expect(stats.hasNaN, `${label}: NaN/Infinity vertices`).toBe(false);
  expect(stats.signedVolume, `${label}: positive volume`).toBeGreaterThan(0);
  expect(stats.nonManifoldEdges, `${label}: non-manifold edges`).toBe(0);
  expect(stats.boundaryEdges, `${label}: boundary edges`).toBe(0);
}

describe('baseplateGenerator — connector fit offset (issue #2024)', () => {
  const TEST_TIMEOUT_MS = 90_000;

  it(
    'a looser offset removes more groove material than a tighter offset, all watertight',
    async () => {
      const loose = analyze(
        (await exportBaseplate(defaults({ connectorFitOffset: 0.2 }), 'stl')).data
      );
      const nominal = analyze(
        (await exportBaseplate(defaults({ connectorFitOffset: 0 }), 'stl')).data
      );
      // -0.3 drives effective clearance below zero, so it clamps to 0 — the
      // smallest possible groove, hence the most material retained.
      const tightClamped = analyze(
        (await exportBaseplate(defaults({ connectorFitOffset: -0.3 }), 'stl')).data
      );

      expectValid(loose, 'loose (+0.2)');
      expectValid(nominal, 'nominal (0)');
      expectValid(tightClamped, 'tight-clamped (-0.3)');

      // Bigger groove → less plastic. Volume strictly decreases as the offset loosens.
      expect(loose.signedVolume).toBeLessThan(nominal.signedVolume);
      expect(nominal.signedVolume).toBeLessThan(tightClamped.signedVolume);
    },
    TEST_TIMEOUT_MS
  );

  it(
    'clamps at the floor: offsets past the negative limit collapse to the same geometry',
    async () => {
      // Base groove clearance is 0.15mm; any offset ≤ -0.15 clamps the effective
      // clearance to 0, so -0.3 and -0.5 must yield identical solid volume.
      const atFloor = analyze(
        (await exportBaseplate(defaults({ connectorFitOffset: -0.3 }), 'stl')).data
      );
      const pastFloor = analyze(
        (await exportBaseplate(defaults({ connectorFitOffset: -0.5 }), 'stl')).data
      );

      expectValid(atFloor, 'at floor (-0.3)');
      expectValid(pastFloor, 'past floor (-0.5)');
      expect(pastFloor.signedVolume).toBeCloseTo(atFloor.signedVolume, 3);
    },
    TEST_TIMEOUT_MS
  );
});
