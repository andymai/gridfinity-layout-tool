import brepkitUrl from 'brepkit-wasm/brepkit_wasm_bg.wasm?url';
import manifoldUrl from 'manifold-3d/manifold.wasm?url';
import occtUrl from 'occt-wasm/dist/occt-wasm.wasm?url';
import type { KernelName } from '@/shared/generation/bridge';

/** The service worker's runtime cache for the geometry kernels (`vite.config.ts`). */
const KERNEL_CACHE = 'wasm-binaries';

/**
 * Each kernel's binary, through the same `?url` asset its worker loads (and
 * vite-plugin-wasm uses for brepkit), so the URL carries the current hash.
 */
const KERNEL_BINARY: Readonly<Record<KernelName, string>> = {
  'occt-wasm': occtUrl,
  brepkit: brepkitUrl,
  manifold: manifoldUrl,
};

/**
 * True when this build's binary for the kernel is already on the device, so
 * the 3D cards can generate without a download of tens of megabytes. The
 * cache also holds the other kernels and superseded copies, so any entry is
 * not enough.
 */
export async function isKernelCached(kernel: KernelName): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    if (!(await caches.has(KERNEL_CACHE))) return false;
    const cache = await caches.open(KERNEL_CACHE);
    const url = new URL(KERNEL_BINARY[kernel], window.location.href).href;
    return (await cache.match(url)) !== undefined;
  } catch {
    return false;
  }
}
