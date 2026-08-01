// @vitest-environment node
/**
 * Diagnostic (not a CI gate): the floor-pattern `oversized elements` scenario
 * exports with boundary edges, and its own contract says the pattern is a
 * no-op (no window is big enough for one honeycomb element), so the result
 * must equal the un-patterned bin.
 *
 * That makes the discriminating question cheap: does the PLAIN bin export
 * clean? If it does not, the floor pattern is innocent and the root is the
 * halfSockets base at wallThickness 4.
 */
import { describe, it, beforeAll } from 'vitest';
import { isOk } from '@/core/result';
import { initBrepjs } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, setLastSolid } from '../shapeCache';
import { parseSTLBinary } from '@/shared/generation/stlParser';

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

interface Counts {
  boundary: number;
  nonManifold: number;
  triangles: number;
}

function edgeCounts(vertices: Float32Array | number[]): Counts {
  const triangles = vertices.length / 9;
  const Q = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * Q) / Q},${Math.round(y * Q) / Q},${Math.round(z * Q) / Q}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const count = new Map<string, number>();
  for (let t = 0; t < triangles; t++) {
    const b = t * 9;
    const k = [
      vKey(vertices[b], vertices[b + 1], vertices[b + 2]),
      vKey(vertices[b + 3], vertices[b + 4], vertices[b + 5]),
      vKey(vertices[b + 6], vertices[b + 7], vertices[b + 8]),
    ];
    for (let i = 0; i < 3; i++) {
      const key = eKey(k[i], k[(i + 1) % 3]);
      count.set(key, (count.get(key) ?? 0) + 1);
    }
  }
  let boundary = 0;
  let nonManifold = 0;
  for (const c of count.values()) {
    if (c === 1) boundary++;
    else if (c > 2) nonManifold++;
  }
  return { boundary, nonManifold, triangles };
}

const BASE = { ...DEFAULT_BIN_PARAMS.base, halfSockets: true };

describe('floor oversized probe', () => {
  it('compares the patterned bin against the plain one', async () => {
    const { exportBin } = await import('../binExporter');
    const results: Record<string, Counts & { ms: number }> = {};

    const cases: Array<readonly [string, Record<string, unknown>]> = [];
    for (const w of [3.6, 3.7, 3.8, 3.9, 4.0]) {
      cases.push([`hs-wall-${w}`, { wallThickness: w }]);
    }
    // Is the stacking lip involved at all?
    cases.push([
      'wall-4-noLip',
      { wallThickness: 4, lip: { ...DEFAULT_BIN_PARAMS.lip, enabled: false } },
    ]);
    // And does a bigger footprint at the same thickness stay clean?
    cases.push(['wall-4-2x2', { wallThickness: 4, width: 2, depth: 2 }]);
    cases.push(['wall-6-2x2', { wallThickness: 6, width: 2, depth: 2 }]);
    for (const [label, extra] of cases) {
      clearAllCaches();
      setLastSolid(null);
      const t0 = Date.now();
      const out = await exportBin(
        buildParams({
          width: 1,
          depth: 1,
          height: 10,
          base: BASE,
          wallThickness: 4,
          ...extra,
        }),
        'stl'
      );
      const ms = Date.now() - t0;
      const parsed = parseSTLBinary(out.data);
      if (!isOk(parsed)) throw new Error(`${label}: parse failed`);
      results[label] = { ...edgeCounts(parsed.value.vertices), ms };
    }

    (await import('fs')).writeFileSync(
      process.env['FLOOR_OUT'] ?? '/tmp/floor-oversized.json',
      JSON.stringify(results, null, 2)
    );
  }, 900_000);
});
