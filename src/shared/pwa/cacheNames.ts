/**
 * Workbox cache names, shared so the SW-update path (`usePWAUpdate`) and the
 * stale-recovery path can't drift. `PRECACHE_PREFIX` must track `workbox.cacheId`
 * ('gridfinity-v1') + Workbox's '-precache-' suffix; `WASM_CACHE` must match the
 * wasm `runtimeCaching` cacheName — both in vite.config.ts.
 *
 * That cache holds the geometry kernels only. The Draco decoder is routed to
 * its own cache ahead of the generic `.wasm` rule, and deliberately stays out
 * of stale-bundle recovery: a wedged kernel init says nothing about a GLB
 * preview's decoder, and clearing it just costs a refetch.
 */
export const PRECACHE_PREFIX = 'gridfinity-v1-precache-';
export const WASM_CACHE = 'wasm-binaries';
