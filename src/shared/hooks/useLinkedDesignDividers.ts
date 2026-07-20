/**
 * Resolve compartment divider walls for layout bins linked to saved designs.
 *
 * The lightweight CustomBinRegistry only carries dimensions, so the full
 * design params (compartment grid) are loaded from IndexedDB on demand and
 * cached module-wide, keyed by design id + updatedAt + grid unit so edits to
 * a design invalidate stale entries automatically.
 *
 * Output segments are normalized to fractions of the bin interior span, so
 * the preview geometry can map them onto its own (stylized) wall thickness
 * regardless of the design's physical wall parameters.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Bin, DesignId } from '@/core/types';
import { isOk } from '@/core/result';
import {
  loadDesign,
  useCustomBins,
  deriveWallSegments,
  type SavedDesign,
} from '@/features/bin-designer';
import type { BinDividersSpec } from '@/shared/hooks/useBinGeometry';

// Module-level cache shared across preview mounts. null = design has no
// renderable dividers (single compartment, non-bin kind, or load failure).
const dividerCache = new Map<string, BinDividersSpec | null>();
const MAX_CACHE_SIZE = 200;

// Insert an entry, evicting the least-recently-used on overflow. Recency is
// refreshed on read by getCachedSpec, so a still-visible design is never
// evicted by an unrelated insert (matches designGeometryCache's LRU policy).
function setCachedSpec(key: string, spec: BinDividersSpec | null): void {
  if (dividerCache.size >= MAX_CACHE_SIZE && !dividerCache.has(key)) {
    const oldestKey = dividerCache.keys().next().value;
    if (oldestKey !== undefined) dividerCache.delete(oldestKey);
  }
  dividerCache.set(key, spec);
}

// Read a cached entry (including a cached null miss), promoting it to
// most-recently-used. Returns undefined when the key is absent.
function getCachedSpec(key: string): BinDividersSpec | null | undefined {
  if (!dividerCache.has(key)) return undefined;
  const spec = dividerCache.get(key) ?? null;
  dividerCache.delete(key);
  dividerCache.set(key, spec);
  return spec;
}

/** Reset the module cache. @internal — for tests only. */
export function clearLinkedDesignDividerCache(): void {
  dividerCache.clear();
}

function buildDividersSpec(
  design: SavedDesign,
  sig: string,
  gridUnitMm: number
): BinDividersSpec | null {
  const params = design.params;
  if (!params) return null;

  const compartments = params.compartments;
  // Interior span of 1×1 yields segment coordinates as fractions of the interior
  const segments = deriveWallSegments(compartments, 1, 1);
  if (segments.length === 0) return null;

  const dividerHeight = compartments.dividerHeight;
  return {
    sig,
    segments: segments.map((s) => ({
      x: s.x,
      y: s.y,
      length: s.length,
      orientation: s.orientation,
    })),
    thickness: compartments.thickness / gridUnitMm,
    height: typeof dividerHeight === 'number' ? dividerHeight / gridUnitMm : null,
  };
}

/**
 * Load divider specs for every design linked from the given bins.
 * Returns a map keyed by design id; designs without dividers (or still
 * loading) are absent, and their bins render as plain open boxes.
 */
export function useLinkedDesignDividers(
  bins: Bin[],
  gridUnitMm: number
): Map<DesignId, BinDividersSpec> {
  const registry = useCustomBins();
  const [loadTick, setLoadTick] = useState(0);

  // Unique linked design ids resolved against the registry, so updatedAt
  // participates in the cache key and design edits invalidate stale specs.
  const linkedRefs = useMemo(() => {
    const registryById = new Map(registry.map((ref) => [ref.id, ref]));
    const refs = new Map<DesignId, string>();
    for (const bin of bins) {
      if (bin.linkedDesignId === undefined || refs.has(bin.linkedDesignId)) continue;
      const ref = registryById.get(bin.linkedDesignId);
      if (ref) refs.set(bin.linkedDesignId, `${ref.id}:${ref.updatedAt}:${gridUnitMm}`);
    }
    return refs;
  }, [bins, registry, gridUnitMm]);

  useEffect(() => {
    let cancelled = false;
    const missing = [...linkedRefs.entries()].filter(([, key]) => !dividerCache.has(key));
    if (missing.length === 0) return;

    void Promise.all(
      missing.map(async ([id, key]) => {
        const result = await loadDesign(id);
        const spec = isOk(result) ? buildDividersSpec(result.value, key, gridUnitMm) : null;
        setCachedSpec(key, spec);
      })
    ).then(() => {
      if (!cancelled) setLoadTick((tick) => tick + 1);
    });

    return () => {
      cancelled = true;
    };
  }, [linkedRefs, gridUnitMm]);

  return useMemo(() => {
    // loadTick re-runs this memo when async loads land in the module cache
    void loadTick;
    const specs = new Map<DesignId, BinDividersSpec>();
    for (const [id, key] of linkedRefs) {
      const spec = getCachedSpec(key);
      if (spec) specs.set(id, spec);
    }
    return specs;
  }, [linkedRefs, loadTick]);
}
