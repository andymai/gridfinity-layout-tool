import { describe, it, expect } from 'vitest';
import { GenerationResultCache } from './resultCache';
import type { GenerationResult } from './bridgeTypes';

/** A result whose mesh occupies roughly `bytes` (Float32Array = 4 bytes/entry). */
function resultOfBytes(bytes: number, triangleCount = 1): GenerationResult {
  return {
    mesh: {
      vertices: new Float32Array(Math.max(0, bytes / 4)),
      normals: new Float32Array(0),
      indices: new Uint32Array(0),
      edgeVertices: new Float32Array(0),
      triangleCount,
    },
    timingMs: 1,
  };
}

function store(cache: GenerationResultCache, key: string, result: GenerationResult): void {
  cache.setPending(key);
  cache.commit(result);
}

describe('GenerationResultCache', () => {
  it('returns null for a fingerprint it has never seen', () => {
    expect(new GenerationResultCache().get('a')).toBeNull();
  });

  it('serves a result stored under its pending fingerprint', () => {
    const cache = new GenerationResultCache();
    const result = resultOfBytes(64, 7);
    store(cache, 'a', result);
    expect(cache.get('a')).toBe(result);
  });

  // The defect this class exists to fix: a single slot meant returning to a
  // shape already built (toggle off, toggle back on) re-ran the whole kernel.
  it('still serves the first result after a different one is stored', () => {
    const cache = new GenerationResultCache();
    const first = resultOfBytes(64, 1);
    const second = resultOfBytes(64, 2);
    store(cache, 'a', first);
    store(cache, 'b', second);
    expect(cache.get('a')).toBe(first);
    expect(cache.get('b')).toBe(second);
  });

  it('ignores a result when nothing is pending', () => {
    const cache = new GenerationResultCache();
    cache.commit(resultOfBytes(64));
    expect(cache.stats.size).toBe(0);
  });

  // The three caches share one request channel and are all offered every
  // result; only the one that dispatched it may claim it.
  it('claims a result only once per pending fingerprint', () => {
    const cache = new GenerationResultCache();
    cache.setPending('a');
    cache.commit(resultOfBytes(64, 1));
    cache.commit(resultOfBytes(64, 2));
    expect(cache.get('a')?.mesh.triangleCount).toBe(1);
    expect(cache.stats.size).toBe(1);
  });

  it('drops a cleared pending fingerprint instead of storing its result', () => {
    const cache = new GenerationResultCache();
    cache.setPending('a');
    cache.clearPending();
    cache.commit(resultOfBytes(64));
    expect(cache.get('a')).toBeNull();
  });

  it('evicts oldest-first once the byte budget is exceeded', () => {
    const cache = new GenerationResultCache(2400);
    store(cache, 'a', resultOfBytes(1000));
    store(cache, 'b', resultOfBytes(1000));
    store(cache, 'c', resultOfBytes(1000));
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).not.toBeNull();
    expect(cache.get('c')).not.toBeNull();
    expect(cache.stats.bytes).toBeLessThanOrEqual(2400);
  });

  // Recency is what makes the budget usable: the shape being toggled away
  // from and back to must not be the one evicted by an unrelated third edit.
  it('a read protects an entry from the next eviction', () => {
    const cache = new GenerationResultCache(2400);
    store(cache, 'a', resultOfBytes(1000));
    store(cache, 'b', resultOfBytes(1000));
    cache.get('a');
    store(cache, 'c', resultOfBytes(1000));
    expect(cache.get('a')).not.toBeNull();
    expect(cache.get('b')).toBeNull();
  });

  it('re-storing a fingerprint replaces rather than double-counts its bytes', () => {
    const cache = new GenerationResultCache(2400);
    store(cache, 'a', resultOfBytes(1000));
    store(cache, 'a', resultOfBytes(1000));
    expect(cache.stats.size).toBe(1);
    expect(cache.stats.bytes).toBe(1000);
  });

  // Admitting it would evict every other entry and then itself, leaving the
  // cache empty and the budget spent on nothing.
  it('refuses a single result larger than the whole budget', () => {
    const cache = new GenerationResultCache(2400);
    store(cache, 'a', resultOfBytes(1000));
    store(cache, 'huge', resultOfBytes(8000));
    expect(cache.get('huge')).toBeNull();
    expect(cache.get('a')).not.toBeNull();
  });

  it('clear drops every entry and any pending fingerprint', () => {
    const cache = new GenerationResultCache();
    store(cache, 'a', resultOfBytes(64));
    cache.setPending('b');
    cache.clear();
    cache.commit(resultOfBytes(64));
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.stats).toEqual({ size: 0, bytes: 0 });
  });
});
