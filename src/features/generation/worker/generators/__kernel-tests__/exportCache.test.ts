// @vitest-environment node
import { writeFileSync } from 'node:fs';
import { describe, it, beforeAll, expect } from 'vitest';
import { measureVolume, unwrap } from 'brepjs';
import { initBrepjs, getGenerateBin } from './wasmInit';
import { buildParams } from './scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { clearAllCaches, getLastSolid } from '../shapeCache';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);
const vol = (s: unknown): number => {
  const v: unknown = measureVolume(s as never);
  return typeof v === 'number' ? v : unwrap(v as never);
};

describe('export shell cache', () => {
  it('caches the fused shell; re-export is faster with identical geometry', () => {
    const gen = getGenerateBin();
    const p = buildParams({
      width: 6,
      depth: 6,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'socket', stackingLip: true },
    });
    clearAllCaches();
    let t = performance.now();
    gen(p, undefined, true);
    const first = performance.now() - t;
    const v1 = vol(getLastSolid());
    t = performance.now();
    gen(p, undefined, true);
    const second = performance.now() - t;
    const v2 = vol(getLastSolid());
    writeFileSync(
      '/tmp/perfbench/export-cache.txt',
      `first=${first.toFixed(0)}ms second=${second.toFixed(0)}ms vol1=${v1.toFixed(0)} vol2=${v2.toFixed(0)}\n`
    );
    expect(Math.abs(v1 - v2)).toBeLessThan(1); // geometry identical
    expect(second).toBeLessThan(first * 0.8); // re-export meaningfully faster (fuse cached)
  }, 120_000);
});
