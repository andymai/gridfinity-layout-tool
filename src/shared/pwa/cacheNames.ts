/**
 * Workbox cache names, shared so the SW-update path (`usePWAUpdate`) and the
 * stale-recovery path can't drift. `PRECACHE_PREFIX` must track `workbox.cacheId`
 * ('gridfinity-v1') + Workbox's '-precache-' suffix; `WASM_CACHE` must match the
 * wasm `runtimeCaching` cacheName — both in vite.config.ts.
 */
export const PRECACHE_PREFIX = 'gridfinity-v1-precache-';
export const WASM_CACHE = 'wasm-binaries';
