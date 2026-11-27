/** The service worker's runtime cache for the geometry kernel (`vite.config.ts`). */
const KERNEL_CACHE = 'wasm-binaries';

/**
 * True when the kernel is already on this device, so the 3D cards can
 * generate without a download of tens of megabytes. Anyone who has opened the
 * designer has it; anyone else gets the saved thumbnails.
 */
export async function isKernelCached(): Promise<boolean> {
  try {
    if (typeof caches === 'undefined') return false;
    if (!(await caches.has(KERNEL_CACHE))) return false;
    const cache = await caches.open(KERNEL_CACHE);
    return (await cache.keys()).length > 0;
  } catch {
    return false;
  }
}
