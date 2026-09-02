// @vitest-environment node
/**
 * Real-kernel tests for `keepOuterShell`. Additive feature fuses (scoop ramps,
 * label tabs) leave interior void shells in an otherwise valid export solid;
 * STL tessellates them as doubled (non-manifold) triangles. `keepOuterShell`
 * collapses to the single outer boundary so the exported mesh is watertight.
 * Exercised against real brepjs/WASM per CLAUDE.md's "real dependencies only".
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { box, cut, getShells, measureVolume, unwrap } from 'brepjs';
import { isOk } from '@/core/result';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { buildParams } from '../__kernel-tests__/scenarioTypes';
import { setLastSolid, getLastSolid } from '../shapeCache';
import { exportSolidToStl } from './stlMeshFallback';
import { EXPORT_ANGULAR_TOLERANCE_RAD, EXPORT_TOLERANCE } from './tolerances';
import { keepOuterShell } from './outerShell';
import type * as BinOrchestratorModule from '../binOrchestrator';

let generateBin: typeof BinOrchestratorModule.generateBin;

beforeAll(async () => {
  const { initBrepjs } = await import('../__kernel-tests__/wasmInit');
  await initBrepjs();
  generateBin = (await import('../binOrchestrator')).generateBin;
}, 60_000);

const VOID_VOLUME = 10 * 10 * 10;

/** A box with a sealed cavity: the outer shell plus one interior void shell,
 *  the topology an additive fuse can leave behind inside a wall. */
function buildSolidWithVoid(): unknown {
  const outer = box(40, 40, 40, { at: [0, 0, 0] });
  const hole = box(10, 10, 10, { at: [0, 0, 0] });
  try {
    return unwrap(cut(outer, hole));
  } finally {
    outer.delete();
    hole.delete();
  }
}

/** Count STL edges shared by >2 triangles (non-manifold) and by 1 (boundary). */
async function meshDefects(solid: unknown): Promise<{ nonManifold: number; boundary: number }> {
  const data = await exportSolidToStl(
    solid as never,
    'x',
    EXPORT_TOLERANCE,
    EXPORT_ANGULAR_TOLERANCE_RAD
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

  it('drops a sealed interior void and keeps the outer shell watertight', async () => {
    const solid = buildSolidWithVoid();
    expect(getShells(solid as never).length).toBe(2);
    const outerVolume = unwrap(measureVolume(solid as never));

    const fixed = keepOuterShell(solid as never);
    expect(fixed).not.toBe(solid);
    expect(getShells(fixed as never).length).toBe(1);
    // Filling the void adds its volume back: the shell is the box itself.
    expect(unwrap(measureVolume(fixed))).toBeCloseTo(outerVolume + VOID_VOLUME, 3);
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
