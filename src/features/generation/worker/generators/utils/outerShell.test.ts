// @vitest-environment node
/**
 * Real-kernel tests for `keepOuterShell`. Additive feature fuses (scoop ramps,
 * label tabs) leave interior void shells in an otherwise valid export solid;
 * STL tessellates them as doubled (non-manifold) triangles. `keepOuterShell`
 * collapses to the single outer boundary so the exported mesh is watertight.
 * Exercised against real brepjs/WASM per CLAUDE.md's "real dependencies only".
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { getShells, fuseAllBisect, unwrap } from 'brepjs';
import type { ValidSolid } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildParams } from '../__kernel-tests__/scenarioTypes';
import { setLastSolid, getLastSolid } from '../shapeCache';
import { buildBinBox } from '../boxBuilder';
import { buildScoopRamps } from '../scoopRampBuilder';
import { exportSolidToStl } from './stlMeshFallback';
import { EXPORT_ANGULAR_TOLERANCE, EXPORT_TOLERANCE } from './tolerances';
import { keepOuterShell } from './outerShell';
import type * as BinOrchestratorModule from '../binOrchestrator';

let generateBin: typeof BinOrchestratorModule.generateBin;

beforeAll(async () => {
  const { initBrepjs } = await import('../__kernel-tests__/wasmInit');
  await initBrepjs();
  generateBin = (await import('../binOrchestrator')).generateBin;
}, 60_000);

/** Body+scoop fuse, which leaves interior void shells — the raw geometry the
 *  export pipeline now repairs via keepOuterShell. */
function buildRawMultiShellScoopSolid(): unknown {
  const params = buildParams({ scoop: { enabled: true, radius: 10 } });
  const wallHeight = params.height * params.heightUnitMm;
  const wt = params.wallThickness;
  const innerW = params.width * params.gridUnitMm - 2 * wt;
  const innerD = params.depth * params.gridUnitMm - 2 * wt;
  const body = buildBinBox(
    params.width,
    params.depth,
    wallHeight,
    wt,
    false,
    0,
    params.gridUnitMm,
    params.cellMask,
    undefined,
    undefined,
    { x: 0, y: 0, feet: false }
  );
  const scoop = buildScoopRamps(params, innerW, innerD, wallHeight, wt);
  if (!scoop) throw new Error('scoop not built');
  return unwrap(fuseAllBisect([body, scoop] as ValidSolid[], {})).shape;
}

/** Count STL edges shared by >2 triangles (non-manifold) and by 1 (boundary). */
async function meshDefects(solid: unknown): Promise<{ nonManifold: number; boundary: number }> {
  const data = await exportSolidToStl(
    solid as never,
    'x',
    EXPORT_TOLERANCE,
    EXPORT_ANGULAR_TOLERANCE
  );
  const parsed = parseSTLBinary(data);
  if (!isOk(parsed)) throw new Error('STL parse failed');
  const { vertices } = parsed.value;
  const triangleCount = vertices.length / 9;
  const Q = 1e4;
  const vKey = (x: number, y: number, z: number): string =>
    `${Math.round(x * Q)},${Math.round(y * Q)},${Math.round(z * Q)}`;
  const eKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const edgeCount = new Map<string, number>();
  for (let t = 0; t < triangleCount; t++) {
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
  return { nonManifold, boundary };
}

describe('keepOuterShell', () => {
  it('returns a single-shell solid unchanged', () => {
    setLastSolid(null);
    generateBin(buildParams({}), undefined, true);
    const solid = getLastSolid();
    expect(solid).not.toBeNull();
    expect(getShells(solid as never).length).toBe(1);
    expect(keepOuterShell(solid as never)).toBe(solid);
  }, 60_000);

  it('collapses a multi-shell scoop solid to one watertight shell', async () => {
    const solid = buildRawMultiShellScoopSolid();
    // The raw scoop fuse leaves interior void shells.
    expect(getShells(solid as never).length).toBeGreaterThan(1);
    const before = await meshDefects(solid);
    expect(before.nonManifold).toBeGreaterThan(0);

    const fixed = keepOuterShell(solid as never);
    expect(fixed).not.toBe(solid);
    expect(getShells(fixed as never).length).toBe(1);
    const after = await meshDefects(fixed);
    expect(after.nonManifold).toBe(0);
    expect(after.boundary).toBe(0);

    // keepOuterShell returned a fresh clone; dispose both WASM handles so the
    // leak doesn't skew brepjs live-handle counts in later tests.
    (solid as { delete(): void }).delete();
    fixed.delete();
  }, 60_000);

  it('repairs the scoop bin end-to-end through the export pipeline', async () => {
    setLastSolid(null);
    generateBin(buildParams({ scoop: { enabled: true, radius: 10 } }), undefined, true);
    const solid = getLastSolid();
    expect(solid).not.toBeNull();
    // tessellateStage already applied keepOuterShell on the export path.
    expect(getShells(solid as never).length).toBe(1);
    const defects = await meshDefects(solid);
    expect(defects.nonManifold).toBe(0);
    expect(defects.boundary).toBe(0);
  }, 60_000);
});
