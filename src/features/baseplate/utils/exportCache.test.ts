import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  buildExportCacheKey,
  getCachedExport,
  getCachedExports,
  putCachedExports,
  clearExportCache,
  setExportCacheMaxBytesForTests,
} from './exportCache';
import type { BaseplateParams } from '@/shared/types/bin';

const params = (over: Partial<BaseplateParams> = {}): BaseplateParams => ({
  width: 6,
  depth: 6,
  gridUnitMm: 42,
  magnetHoles: true,
  magnetDiameter: 6.5,
  magnetDepth: 2.4,
  paddingLeft: 0,
  paddingRight: 0,
  paddingFront: 0,
  paddingBack: 0,
  fractionalEdgeX: 'end',
  fractionalEdgeY: 'end',
  ...over,
});

const buf = (n: number, fill = 1): ArrayBuffer => {
  const a = new Uint8Array(n).fill(fill);
  return a.buffer;
};

beforeEach(async () => {
  await clearExportCache();
  setExportCacheMaxBytesForTests(50 * 1024 * 1024);
});

afterEach(async () => {
  await clearExportCache();
});

describe('buildExportCacheKey', () => {
  it('is stable for equal params regardless of key order', () => {
    const p = params({ width: 6, depth: 4 });
    // Same values, reversed property insertion order — stableStringify sorts keys.
    const reordered = Object.fromEntries(Object.entries(p).reverse()) as BaseplateParams;
    expect(buildExportCacheKey(p, 'stl', 0.4)).toBe(buildExportCacheKey(reordered, 'stl', 0.4));
  });

  it('differs on geometry, format, and nozzle', () => {
    const base = params();
    const k = buildExportCacheKey(base, 'stl', 0.4);
    expect(k).not.toBe(buildExportCacheKey(params({ width: 7 }), 'stl', 0.4));
    expect(k).not.toBe(buildExportCacheKey(base, 'step', 0.4));
    expect(k).not.toBe(buildExportCacheKey(base, 'stl', 0.6));
  });
});

describe('export cache roundtrip', () => {
  it('returns undefined on miss and the stored bytes on hit', async () => {
    const key = buildExportCacheKey(params(), 'stl', 0.4);
    expect(await getCachedExport(key)).toBeUndefined();

    await putCachedExports([{ key, data: buf(1000, 7) }]);
    const got = await getCachedExport(key);
    expect(got).toBeDefined();
    expect(new Uint8Array(got as ArrayBuffer)[0]).toBe(7);
    expect((got as ArrayBuffer).byteLength).toBe(1000);
  });

  it('batch-reads hits and misses in order', async () => {
    const k1 = buildExportCacheKey(params({ width: 6 }), 'stl', 0.4);
    const k2 = buildExportCacheKey(params({ width: 7 }), 'stl', 0.4);
    await putCachedExports([{ key: k1, data: buf(10) }]);

    const [a, b] = await getCachedExports([k1, k2]);
    expect(a).toBeDefined();
    expect(b).toBeUndefined();
  });

  it('clears all entries', async () => {
    const key = buildExportCacheKey(params(), 'stl', 0.4);
    await putCachedExports([{ key, data: buf(10) }]);
    await clearExportCache();
    expect(await getCachedExport(key)).toBeUndefined();
  });
});

describe('eviction', () => {
  it('evicts oldest entries once over the byte budget', async () => {
    setExportCacheMaxBytesForTests(2500);
    const k = (w: number) => buildExportCacheKey(params({ width: w }), 'stl', 0.4);

    // Three 1000-byte entries = 3000 > 2500 → the oldest (k1) is evicted.
    await putCachedExports([{ key: k(1), data: buf(1000) }]);
    await putCachedExports([{ key: k(2), data: buf(1000) }]);
    await putCachedExports([{ key: k(3), data: buf(1000) }]);

    expect(await getCachedExport(k(1))).toBeUndefined(); // evicted (oldest)
    expect(await getCachedExport(k(2))).toBeDefined();
    expect(await getCachedExport(k(3))).toBeDefined();
  });
});
