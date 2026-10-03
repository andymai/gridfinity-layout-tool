// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { Shape3D } from 'brepjs';
import type * as Brepjs from 'brepjs';
import { buildParams } from '../../__kernel-tests__/scenarioTypes';
import { createInitialContext } from '../context';
import { clearAllCaches, getAllShapeCacheStats, resetAllShapeCacheStats } from '../../shapeCache';
import type { PipelineStage } from '../types';

let booleanStage: PipelineStage;
let brepjs: typeof Brepjs;

beforeAll(async () => {
  const { initBrepjs } = await import('../../__kernel-tests__/wasmInit');
  await initBrepjs();
  booleanStage = (await import('./booleanStage')).booleanStage;
  brepjs = await import('brepjs');
}, 60_000);

beforeEach(() => {
  clearAllCaches();
  resetAllShapeCacheStats();
});

const HOLE_RADIUS = 0.5;
const SOCKET_HEIGHT = 4;

function carveHits(): number {
  return getAllShapeCacheStats().find((s) => s.name === 'carved-socket')?.hits ?? 0;
}

function carve(size: number, socketKey: string): { volume: number; key: string | null } {
  const { box, cylinder, translate, measureVolume, unwrap } = brepjs;
  const ctx = createInitialContext(buildParams({ width: 1, depth: 1, height: 3 }));
  const hole = translate(cylinder(HOLE_RADIUS, 20), [1, 1, -5]) as Shape3D;
  const out = booleanStage.execute({
    ...ctx,
    solid: box(10, 10, 10),
    deferredSolid: box(size, size, SOCKET_HEIGHT),
    deferredSolidKey: socketKey,
    patternCutTargets: [hole],
    deferredCutTargets: [hole],
    deferredCutKey: 'floor-honeycomb',
  });
  if (!out.solid || !out.deferredSolid) throw new Error('expected a body and a socket');
  const volume = unwrap(measureVolume(out.deferredSolid));
  out.solid.delete();
  out.deferredSolid.delete();
  return { volume, key: out.deferredSolidKey };
}

describe('booleanStage carved-socket cache', () => {
  it('reuses the carve for the same socket and floor pattern', () => {
    const first = carve(8, 'socket-a');
    const second = carve(8, 'socket-a');
    expect(carveHits()).toBe(1);
    expect(second.volume).toBeCloseTo(first.volume, 6);
    expect(second.key).toBe(first.key);
  });

  it('re-carves a different socket under the same floor pattern', () => {
    const a = carve(8, 'socket-a');
    const b = carve(6, 'socket-b');
    expect(carveHits()).toBe(0);
    expect(b.key).not.toBe(a.key);
    const hole = Math.PI * HOLE_RADIUS ** 2 * SOCKET_HEIGHT;
    expect(b.volume).toBeCloseTo(6 * 6 * SOCKET_HEIGHT - hole, 3);
  });
});
