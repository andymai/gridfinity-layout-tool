// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import occtUrl from 'occt-wasm/dist/occt-wasm.wasm?url';
import { isKernelCached } from './kernelCache';

function stubCaches(urls: Record<string, readonly string[]>) {
  vi.stubGlobal('caches', {
    has: async (name: string) => name in urls,
    open: async (name: string) => ({
      keys: async () => urls[name] ?? [],
      match: async (request: string) =>
        (urls[name] ?? []).includes(request) ? new Response('wasm') : undefined,
    }),
  });
}

const current = new URL(occtUrl, window.location.href).href;

describe('isKernelCached', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds the active kernel's current binary", async () => {
    stubCaches({ 'wasm-binaries': [current] });
    expect(await isKernelCached('occt-wasm')).toBe(true);
  });

  it('says no when only another kernel or an older build is cached', async () => {
    stubCaches({
      'wasm-binaries': [
        new URL('/assets/occt-wasm-0ld.wasm', window.location.href).href,
        new URL('/assets/manifold-abc.wasm', window.location.href).href,
      ],
    });
    expect(await isKernelCached('occt-wasm')).toBe(false);
    expect(await isKernelCached('brepkit')).toBe(false);
  });

  it('says no for a missing cache', async () => {
    stubCaches({});
    expect(await isKernelCached('occt-wasm')).toBe(false);
  });

  it('says no where the Cache API is missing or throws', async () => {
    vi.stubGlobal('caches', undefined);
    expect(await isKernelCached('occt-wasm')).toBe(false);
    vi.stubGlobal('caches', {
      has: async () => {
        throw new Error('blocked');
      },
    });
    expect(await isKernelCached('occt-wasm')).toBe(false);
  });
});
