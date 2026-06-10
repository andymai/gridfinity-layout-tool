// @vitest-environment node
/**
 * Real-kernel regression for the deferred-socket export fuse (GH #2085).
 *
 * The base socket is fused into the body at the tessellate stage, AFTER feature
 * fuses, so additive features (the label bracket especially) fuse onto the
 * socket-less body. Fusing the socket first made the bracket fuse emit
 * non-manifold T-junction edges, so the exported STL was not watertight. These
 * combos (magnet base + label bracket, magnet + floor features) must now export
 * as a single watertight shell.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildParams } from '../../__kernel-tests__/scenarioTypes';
import { setLastSolid, getLastSolid } from '../../shapeCache';
import { exportSolidToStl } from '../../utils/stlMeshFallback';
import { EXPORT_ANGULAR_TOLERANCE, EXPORT_TOLERANCE } from '../../utils/tolerances';
import type { BinParams } from '@/shared/types/bin';
import type * as BinOrchestratorModule from '../../binOrchestrator';

let generateBin: typeof BinOrchestratorModule.generateBin;

beforeAll(async () => {
  const { initBrepjs } = await import('../../__kernel-tests__/wasmInit');
  await initBrepjs();
  generateBin = (await import('../../binOrchestrator')).generateBin;
}, 60_000);

/** Count STL edges shared by >2 triangles (non-manifold) and by exactly 1 (boundary). */
async function exportDefects(
  overrides: Partial<BinParams>
): Promise<{ nonManifold: number; boundary: number; triangles: number }> {
  setLastSolid(null);
  generateBin(buildParams(overrides), undefined, true);
  const solid = getLastSolid();
  if (!solid) throw new Error('no solid');
  const data = await exportSolidToStl(solid, 'x', EXPORT_TOLERANCE, EXPORT_ANGULAR_TOLERANCE);
  const parsed = parseSTLBinary(data);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangles = vertices.length / 9;
  const Q = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * Q)},${Math.round(y * Q)},${Math.round(z * Q)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangles; t++) {
    const o = t * 9;
    const keys = [
      vKey(vertices[o], vertices[o + 1], vertices[o + 2]),
      vKey(vertices[o + 3], vertices[o + 4], vertices[o + 5]),
      vKey(vertices[o + 6], vertices[o + 7], vertices[o + 8]),
    ];
    for (let i = 0; i < 3; i++) {
      const k = eKey(keys[i], keys[(i + 1) % 3]);
      edgeCount.set(k, (edgeCount.get(k) ?? 0) + 1);
    }
  }
  let nonManifold = 0;
  let boundary = 0;
  for (const c of edgeCount.values()) {
    if (c > 2) nonManifold++;
    else if (c === 1) boundary++;
  }
  return { nonManifold, boundary, triangles };
}

const magnet = { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' as const, stackingLip: false };
const bracket = { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' as const };

describe('deferred-socket export fuse → watertight', () => {
  it('magnet base + label bracket exports watertight', async () => {
    const d = await exportDefects({ width: 2, depth: 2, base: magnet, label: bracket });
    expect(d.triangles).toBeGreaterThan(0);
    expect(d.nonManifold).toBe(0);
    expect(d.boundary).toBe(0);
  }, 60_000);

  it('magnet base alone stays watertight (no regression)', async () => {
    const d = await exportDefects({ width: 2, depth: 2, base: magnet });
    expect(d.nonManifold).toBe(0);
    expect(d.boundary).toBe(0);
  }, 60_000);
});
