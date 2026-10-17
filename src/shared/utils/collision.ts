import type { Bin, BlockedZone } from '@/core/types';

/**
 * Reverse layers for display purposes.
 * Layers are stored bottom-to-top but displayed top-to-bottom in the UI.
 */
export function getDisplayLayers<T>(layers: T[]): T[] {
  return [...layers].reverse();
}

/**
 * Resolves how far a bin's linked design stands above its nominal `height`,
 * in height units (see `linkedStackExcessUnits`). Registered from the shell
 * composition root because the data lives in the bin-designer registry, which
 * this module must not import. Unregistered (or a bin without a link) means
 * zero excess.
 */
export type LinkedExcessResolver = (bin: Bin) => number;

let linkedExcessResolver: LinkedExcessResolver | null = null;
let linkedExcessVersion: () => unknown = () => 0;
let registrations = 0;

export function registerLinkedExcessResolver(
  resolver: LinkedExcessResolver | null,
  version?: () => unknown
): void {
  linkedExcessResolver = resolver;
  linkedExcessVersion = version ?? ((): unknown => 0);
  registrations += 1;
}

/** Changes whenever the linked excess of an unchanged bin could have changed. */
export function linkedExcessCacheKey(): string {
  return `${registrations}:${String(linkedExcessVersion())}`;
}

export function linkedExcessUnits(bin: Bin): number {
  if (bin.linkedDesignId === undefined || linkedExcessResolver === null) return 0;
  const excess = linkedExcessResolver(bin);
  // The resolver is pluggable, so its output is not trusted: a NaN here would
  // flow into every stack height above the bin and make each drawer and
  // clearance comparison false, silently disabling both limits.
  return Number.isFinite(excess) && excess > 0 ? excess : 0;
}

/**
 * Check if two 2D rectangles overlap (footprint).
 */
export function footprintsOverlap(
  a: { x: number; y: number; width: number; depth: number },
  b: { x: number; y: number; width: number; depth: number }
): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.depth && b.y < a.y + a.depth;
}

/**
 * Check if a position is within a blocked zone.
 */
export function isInBlockedZone(
  x: number,
  y: number,
  blockedZones: BlockedZone[]
): BlockedZone | null {
  for (const zone of blockedZones) {
    if (x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.depth) {
      return zone;
    }
  }
  return null;
}
