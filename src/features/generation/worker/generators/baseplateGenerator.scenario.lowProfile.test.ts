// @vitest-environment node
/**
 * Real-WASM watertight checks for LOW-PROFILE baseplates.
 *
 * The baseplate pocket shares socketProfileSections with the bin socket, which
 * now truncates the standard profile from the BOTTOM at depth H. Two pocket
 * branches must stay watertight at a reduced socketHeightMm:
 *   - through-cut (no magnets): the cutter extends past the profile bottom, and
 *     that extension must continue from the truncated bottom inset
 *     (socketBottomInset), not a hardcoded PROFILE_INSET_BOT — otherwise it steps
 *     in and leaves a ledge / boundary edges.
 *   - floored (magnets): the pocket stops at socket depth over a solid floor.
 *
 * A non-watertight plate is what slicers "repair" into solid infill (see the
 * dovetail #1407 scenario), so boundary/non-manifold edges must be zero.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { initBrepjs } from './__kernel-tests__/wasmInit';

type ExportFn = (
  params: ResolvedBaseplateParams,
  format: 'stl'
) => Promise<{ data: ArrayBuffer; fileName: string }>;

let exportBaseplate: ExportFn;

beforeAll(async () => {
  await initBrepjs();
  const mod = await import('./baseplateGenerator');
  exportBaseplate = mod.exportBaseplate;
}, 30000);

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

/** Count boundary (edge in 1 triangle) and non-manifold (>2) edges. Zero = watertight. */
function edgeDefects(stl: ArrayBuffer): { boundaryEdges: number; nonManifoldEdges: number } {
  // pattern-check: skip — inline mesh analysis for one test, no GoF pattern applies
  const parsed = parseSTLBinary(stl);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const Q = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * Q)},${Math.round(y * Q)},${Math.round(z * Q)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edges = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
    const b = t * 9;
    const keys = [
      vKey(vertices[b], vertices[b + 1], vertices[b + 2]),
      vKey(vertices[b + 3], vertices[b + 4], vertices[b + 5]),
      vKey(vertices[b + 6], vertices[b + 7], vertices[b + 8]),
    ];
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const c of edges.values()) {
    if (c === 1) boundaryEdges++;
    else if (c > 2) nonManifoldEdges++;
  }
  return { boundaryEdges, nonManifoldEdges };
}

describe('baseplateGenerator — low-profile pockets stay watertight', () => {
  const TIMEOUT = 60_000;

  it(
    'through-cut pocket at Low (socketHeightMm=3) is watertight',
    async () => {
      const { data } = await exportBaseplate(defaults({ socketHeightMm: 3 }), 'stl');
      const d = edgeDefects(data);
      expect(d.boundaryEdges, 'boundary edges').toBe(0);
      expect(d.nonManifoldEdges, 'non-manifold edges').toBe(0);
    },
    TIMEOUT
  );

  it(
    'through-cut pocket at Minimal (socketHeightMm=2, cap on the big taper) is watertight',
    async () => {
      const { data } = await exportBaseplate(defaults({ socketHeightMm: 2 }), 'stl');
      const d = edgeDefects(data);
      expect(d.boundaryEdges, 'boundary edges').toBe(0);
      expect(d.nonManifoldEdges, 'non-manifold edges').toBe(0);
    },
    TIMEOUT
  );

  it(
    'floored (magnet) pocket at Low (socketHeightMm=3) is watertight',
    async () => {
      const { data } = await exportBaseplate(
        defaults({ socketHeightMm: 3, magnetHoles: true }),
        'stl'
      );
      const d = edgeDefects(data);
      expect(d.boundaryEdges, 'boundary edges').toBe(0);
      expect(d.nonManifoldEdges, 'non-manifold edges').toBe(0);
    },
    TIMEOUT
  );
});
