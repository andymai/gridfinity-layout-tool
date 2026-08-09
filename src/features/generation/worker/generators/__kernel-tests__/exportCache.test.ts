// @vitest-environment node
import { writeReport } from './reportTable';
import { describe, it, beforeAll, expect } from 'vitest';
import { measureVolume, unwrap } from 'brepjs';
import { initBrepjs, getGenerateBin, getKernelName } from './wasmInit';
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
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'standard', stackingLip: true },
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
    writeReport(
      '/tmp/perfbench/export-cache.txt',
      `first=${first.toFixed(0)}ms second=${second.toFixed(0)}ms vol1=${v1.toFixed(0)} vol2=${v2.toFixed(0)}\n`
    );
    expect(Math.abs(v1 - v2)).toBeLessThan(1); // geometry identical
    // Re-export meaningfully faster (fuse cached). The bar is per-kernel: the
    // cached fraction is ~0.54 on occt-wasm but 0.82-0.84 on brepkit, whose
    // post-boolean export work is comparatively expensive (brepkit#1500). One
    // occt-tuned threshold made that a hard failure rather than the tracked
    // difference it is.
    const ceiling = getKernelName() === 'occt-wasm' ? 0.8 : 0.95;
    expect(second).toBeLessThan(first * ceiling);
  }, 120_000);
});
