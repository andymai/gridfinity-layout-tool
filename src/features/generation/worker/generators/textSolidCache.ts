/**
 * Per-text glyph-solid cache for engraved/embossed/through-cut label text.
 *
 * The expensive part of materializing text is `sketchText` + `extrude` — it
 * produces one solid per glyph. The label-tab feature cache key serializes the
 * WHOLE `compartmentTexts` array, so editing one compartment's text invalidates
 * the entire label-tab assembly and rebuilds every label's glyph geometry, even
 * the unchanged ones.
 *
 * This caches the *canonical* glyph solid (sketch origin at Z=0, glyphs at their
 * natural XY) keyed by the inputs that shape it — text, font, mode, fit size,
 * and extrusion depth — independent of where it's later placed. Placement (the
 * XY centering and the Z lift onto the host face) is a cheap per-call translate,
 * so editing one label is a cache hit for every other compartment's text.
 *
 * Ownership mirrors the shape caches (see shapeCache.ts): entries are JS-cache-
 * owned clones that are NEVER registered in a DisposalScope (a scope-registered
 * shape would be `.delete()`-ed at scope exit, dangling the cached handle). The
 * getter hands back an independent clone the caller registers; the setter stores
 * an independent clone of whatever the caller built.
 */

import { clone, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { LRUCache } from './lruCache';
import type { CacheStats } from './lruCache';
import { quantize, compactKey } from './cacheKeyUtils';
import type { TextFontFamily, TextMode } from '@/shared/types/bin';

const disposeShape = (_key: string, shape: Shape3D): void => {
  shape.delete();
};

// 32: a fully-labeled bin rarely exceeds ~30 compartments, so a whole design's
// distinct text solids survive one regeneration — editing a single label keeps
// the other N-1 warm for the immediate rebuild.
const textSolidCache = new LRUCache<Shape3D>('text-solid', 32, disposeShape);

/**
 * Compose the cache key for a canonical text solid. `fontFamily` must already be
 * resolved (post `resolveEffectiveFont`) so through-cut's stencil swap collapses
 * onto one key. `depth` and `hostThickness` together pin the extrusion vector
 * across the three modes; only one is load-bearing per mode, but including both
 * is harmless and keeps the key mode-agnostic.
 *
 * `compactKey` hashes the key when it exceeds the length threshold — matching
 * every other key builder in this directory (label text is the only unbounded
 * segment, and it sits last so the fixed-format prefix can't collide).
 */
export function textSolidKey(
  text: string,
  fontFamily: TextFontFamily,
  mode: TextMode,
  fontSize: number,
  depth: number,
  hostThickness: number
): string {
  return compactKey(
    `${fontFamily}|${mode}|${quantize(fontSize)}|${quantize(depth)}|${quantize(hostThickness)}|${text}`
  );
}

/** Independent clone of a cached text solid, or null on miss. The clone is
 *  JS-owned and unregistered — the caller must register or dispose it. */
export function getTextSolid(key: string): Shape3D | null {
  const shape = textSolidCache.get(key);
  return shape !== undefined ? unwrap(clone(shape)) : null;
}

/** Store an independent (unregistered) clone of `shape`. The cache owns the
 *  clone for its lifetime; `shape` itself stays the caller's to dispose. */
export function setTextSolid(key: string, shape: Shape3D): void {
  textSolidCache.set(key, unwrap(clone(shape)));
}

export function getTextSolidCacheStats(): CacheStats {
  return textSolidCache.getStats();
}

/** Reset hit/miss/eviction counters without disposing entries — pairs with
 *  `resetAllShapeCacheStats`, which reports this cache via `getAllShapeCacheStats`. */
export function resetTextSolidCacheStats(): void {
  textSolidCache.resetStats();
}

/** Dispose all cached text solids and reset counters. Required on kernel switch
 *  (see clearAllCaches) — handles can't cross WASM kernels. */
export function clearTextSolidCache(): void {
  textSolidCache.dispose();
  textSolidCache.resetStats();
}
