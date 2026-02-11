/**
 * Shape caching layer for bin generation.
 *
 * Single-entry caches for expensive intermediate shapes. Each stores the last
 * built result and its cache key, returning a clone on hit. This avoids
 * rebuilding shapes whose parameters haven't changed between generation calls.
 *
 * Cache hierarchy (rough timing share):
 * - socketCache: lofts + fuseAll + cutAll holes (~30% of CAD time)
 * - lipCache: sweep + fillet (~10-15% of CAD time)
 * - boxCache: extrude + shell (~10% of CAD time)
 * - shellCache: assembled base + box + lip (~15% of CAD time for the 2-3 fuses)
 * - patternTemplateCache: pattern shape template
 */

import { clone } from 'brepjs';
import type { Shape3D } from 'brepjs';

// ─── Cache State ─────────────────────────────────────────────────────────────

interface CacheEntry {
  key: string;
  shape: Shape3D;
}

let socketCache: CacheEntry | null = null;
let lipCache: CacheEntry | null = null;
let boxCache: CacheEntry | null = null;
let shellCache: CacheEntry | null = null;
let patternTemplateCache: CacheEntry | null = null;
let lastSolid: Shape3D | null = null;

// ─── Socket Cache ────────────────────────────────────────────────────────────

export function socketCacheKey(
  gridW: number,
  gridD: number,
  withMagnet: boolean,
  withScrew: boolean,
  magnetRadius: number,
  magnetDepth: number,
  screwRadius: number,
  forExport: boolean,
  halfSockets: boolean
): string {
  return `${gridW}|${gridD}|${withMagnet}|${withScrew}|${magnetRadius}|${magnetDepth}|${screwRadius}|${forExport}|${halfSockets}`;
}

export function getSocketCache(key: string): Shape3D | null {
  if (socketCache?.key === key) {
    return clone(socketCache.shape);
  }
  return null;
}

export function setSocketCache(key: string, shape: Shape3D): Shape3D {
  socketCache = { key, shape };
  return clone(shape);
}

// ─── Box Cache ───────────────────────────────────────────────────────────────

export function getBoxCache(key: string): Shape3D | null {
  if (boxCache?.key === key) {
    return clone(boxCache.shape);
  }
  return null;
}

export function setBoxCache(key: string, shape: Shape3D): Shape3D {
  boxCache = { key, shape };
  return clone(shape);
}

// ─── Lip Cache ───────────────────────────────────────────────────────────────

export function getLipCache(key: string): Shape3D | null {
  if (lipCache?.key === key) {
    return clone(lipCache.shape);
  }
  return null;
}

export function setLipCache(key: string, shape: Shape3D): Shape3D {
  lipCache = { key, shape };
  return clone(shape);
}

// ─── Shell Cache ─────────────────────────────────────────────────────────────

export function getShellCache(key: string): Shape3D | null {
  if (shellCache?.key === key) {
    return clone(shellCache.shape);
  }
  return null;
}

export function setShellCache(key: string, shape: Shape3D): void {
  shellCache = { key, shape };
}

// ─── Pattern Template Cache ──────────────────────────────────────────────────

export function getPatternTemplateCache(key: string): Shape3D | null {
  if (patternTemplateCache?.key === key) {
    return patternTemplateCache.shape;
  }
  return null;
}

export function setPatternTemplateCache(key: string, shape: Shape3D): void {
  patternTemplateCache = { key, shape };
}

// ─── Last Solid Cache ────────────────────────────────────────────────────────

/** Get the last generated solid for export operations. */
export function getLastSolid(): Shape3D | null {
  return lastSolid;
}

/** Store the last generated solid for export operations. */
export function setLastSolid(shape: Shape3D | null): void {
  lastSolid = shape;
}
