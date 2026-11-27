import { afterEach, describe, expect, it, vi } from 'vitest';
import { isKernelCached } from './kernelCache';

function stubCaches(entries: Record<string, number>) {
  vi.stubGlobal('caches', {
    has: async (name: string) => name in entries,
    open: async (name: string) => ({
      keys: async () => Array.from({ length: entries[name] ?? 0 }, (_, i) => `/wasm/${i}`),
    }),
  });
}

describe('isKernelCached', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds a cached kernel', async () => {
    stubCaches({ 'wasm-binaries': 1 });
    expect(await isKernelCached()).toBe(true);
  });

  it('says no for an empty or missing cache', async () => {
    stubCaches({ 'wasm-binaries': 0 });
    expect(await isKernelCached()).toBe(false);
    stubCaches({});
    expect(await isKernelCached()).toBe(false);
  });

  it('says no where the Cache API is missing or throws', async () => {
    vi.stubGlobal('caches', undefined);
    expect(await isKernelCached()).toBe(false);
    vi.stubGlobal('caches', {
      has: async () => {
        throw new Error('blocked');
      },
    });
    expect(await isKernelCached()).toBe(false);
  });
});
