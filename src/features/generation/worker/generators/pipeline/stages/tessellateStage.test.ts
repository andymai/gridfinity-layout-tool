// @vitest-environment node
/**
 * Real-kernel regression for the deferred-socket export fuse (GH).
 *
 * The base socket is fused into the body at the tessellate stage, AFTER feature
 * fuses, so additive features (the label bracket especially) fuse onto the
 * socket-less body. Fusing the socket first made the bracket fuse emit
 * non-manifold T-junction edges, so the exported STL was not watertight. These
 * combos (magnet base + label bracket, magnet + floor features) must now export
 * as a single watertight shell.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as Brepjs from 'brepjs';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { paramsFingerprint } from '@/shared/generation/paramsFingerprint';
import { buildParams } from '../../__kernel-tests__/scenarioTypes';
import { setLastSolid, getLastSolid, isLastSolidReusableFor } from '../../shapeCache';
import { exportSolidToStl } from '../../utils/stlMeshFallback';
import { EXPORT_ANGULAR_TOLERANCE_RAD, EXPORT_TOLERANCE } from '../../utils/tolerances';
import { createInitialContext } from '../context';
import type { BinParams } from '@/shared/types/bin';
import type { PipelineStage } from '../types';
import type * as BinOrchestratorModule from '../../binOrchestrator';

let generateBin: typeof BinOrchestratorModule.generateBin;
let tessellateStage: PipelineStage;
let brepjs: typeof Brepjs;

beforeAll(async () => {
  const { initBrepjs } = await import('../../__kernel-tests__/wasmInit');
  await initBrepjs();
  generateBin = (await import('../../binOrchestrator')).generateBin;
  tessellateStage = (await import('./tessellateStage')).tessellateStage;
  brepjs = await import('brepjs');
}, 60_000);

/** Count STL edges shared by >2 triangles (non-manifold) and by exactly 1 (boundary). */
async function exportDefects(
  overrides: Partial<BinParams>
): Promise<{ nonManifold: number; boundary: number; triangles: number }> {
  setLastSolid(null);
  generateBin(buildParams(overrides), undefined, true);
  const solid = getLastSolid();
  if (!solid) throw new Error('no solid');
  const data = await exportSolidToStl(solid, 'x', EXPORT_TOLERANCE, EXPORT_ANGULAR_TOLERANCE_RAD);
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

/**
 * Runs the export pass on a hand-built body and socket and returns what
 * `exportBin` would write. The socket spans z -5..0 under a body above z 0, so a
 * socket that went missing shows as the solid's floor rising to 0.
 */
function exportSolidFor(body: Shape3D): {
  bounds: Brepjs.Bounds3D;
  volume: number;
  reusable: boolean;
  triangles: number;
} {
  const { box, translate, getBounds, measureVolume, unwrap } = brepjs;
  setLastSolid(null);
  const params = buildParams({ width: 1, depth: 1, height: 3 });
  const ctx = createInitialContext(params, undefined, true);
  const out = tessellateStage.execute({
    ...ctx,
    solid: body,
    deferredSolid: translate(box(15, 10, 5), [0, 0, -5]),
    deferredSolidKey: null,
  });
  const solid = getLastSolid();
  if (!solid) throw new Error('no export solid');
  return {
    bounds: getBounds(solid),
    volume: unwrap(measureVolume(solid)),
    reusable: isLastSolidReusableFor(paramsFingerprint(params)),
    triangles: out.mesh?.triangleCount ?? 0,
  };
}

describe('export fuse keeps both the body and the socket', () => {
  it('falls back when the kernel reports a fuse that dropped an operand', () => {
    const { box, translate, compound } = brepjs;
    // Two overlapping solids in one compound are an operand the kernel cannot
    // union: its fuse reports success and returns the first box alone.
    const a = box(10, 10, 10);
    const b = translate(box(10, 10, 10), [5, 0, 0]);
    const body = compound([a, b]) as Shape3D;
    a.delete();
    b.delete();

    const result = exportSolidFor(body);

    expect(result.bounds.xMax).toBeCloseTo(15, 3);
    expect(result.bounds.zMin).toBeCloseTo(-5, 3);
    expect(result.volume).toBeGreaterThanOrEqual(1500 + 750 - 1e-3);
    expect(result.reusable).toBe(true);
    expect(result.triangles).toBeGreaterThan(0);
  });

  it('exports the socket with the body when the fuse throws', () => {
    const { box, getShells } = brepjs;
    // A bare shell is not a valid fuse operand, so the kernel throws.
    const solidBox = box(15, 10, 10);
    const shell = getShells(solidBox)[0] as unknown as Shape3D;

    const result = exportSolidFor(shell);
    solidBox.delete();

    expect(result.bounds.zMin).toBeCloseTo(-5, 3);
    expect(result.bounds.zMax).toBeCloseTo(10, 3);
    expect(result.reusable).toBe(true);
    expect(result.triangles).toBeGreaterThan(0);
  });
});

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
