/**
 * Count the swappable label plates each socket-mode linked design needs, for
 * surfacing plate counts in the print list (#2666 follow-up).
 *
 * Loads linked designs from storage (results cached module-wide by design
 * id + updatedAt, so a design re-save invalidates naturally) and derives the
 * plate set through the same `planLabelPlates` math that cuts the sockets
 * and packs the layout export — the counts can never disagree with what the
 * ZIP export ships.
 */

import { useEffect, useMemo, useState } from 'react';
import type { Bin, DesignId } from '@/core/types';
import { isOk } from '@/core/result';
import {
  binDimensions,
  loadDesign,
  useCustomBins,
  type SavedDesign,
} from '@/features/bin-designer';
import { effectiveLabelSocketClearance } from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { useSettingsStore } from '@/core/store';
import { planLabelPlates } from '@/shared/utils/labelSocketPlan';

/** The plates one placed bin of a socket-mode design needs. */
export interface DesignPlateSet {
  readonly perBin: number;
  /** Plate widths in U, one entry per plate. */
  readonly widthsU: readonly LabelPlateWidthU[];
}

// Keyed by design id so repeated re-saves replace entries instead of
// accumulating; `key` (id:updatedAt) detects staleness. A stale in-flight
// load can briefly overwrite a fresher entry, in which case the key check in
// the next effect run re-enqueues the fresh load — it converges in one pass.
// plateSet null = not socket-mode, no fitting plate, or failed to load.
interface CacheEntry {
  readonly key: string;
  readonly plateSet: DesignPlateSet | null;
}
const plateSetCache = new Map<DesignId, CacheEntry>();
const inFlight = new Set<string>();

/** Reset module state. @internal — for tests only. */
export function clearLabelPlateCountCache(): void {
  plateSetCache.clear();
  inFlight.clear();
}

function computePlateSet(design: SavedDesign, nozzleSizeMm: number): DesignPlateSet | null {
  const params = design.params;
  if (!params?.label.enabled || (params.label.mode ?? 'text') !== 'socket') return null;
  const clearanceMm = effectiveLabelSocketClearance(nozzleSizeMm, params.label.plateFitOffset);
  const planned = planLabelPlates(
    params.compartments,
    binDimensions(params).innerW,
    clearanceMm,
    ''
  );
  if (planned.length === 0) return null;
  return { perBin: planned.length, widthsU: planned.map((p) => p.widthU) };
}

function enqueueLoad(id: DesignId, key: string, nozzleSizeMm: number, onSettled: () => void): void {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  void loadDesign(id)
    .then((result) => {
      plateSetCache.set(id, {
        key,
        plateSet: isOk(result) ? computePlateSet(result.value, nozzleSizeMm) : null,
      });
    })
    .catch(() => {
      plateSetCache.set(id, { key, plateSet: null });
    })
    .finally(() => {
      inFlight.delete(key);
      onSettled();
    });
}

/**
 * Resolve plate requirements for every socket-mode design linked from the
 * given bins. Designs still loading, unresolvable, or not in socket mode are
 * absent from the returned map.
 */
export function useLabelPlateCounts(bins: Bin[]): ReadonlyMap<DesignId, DesignPlateSet> {
  const registry = useCustomBins();
  const [loadTick, setLoadTick] = useState(0);
  // In the cache key so a nozzle change recomputes plate widths at the new
  // socket clearance (a wider nozzle can drop a compartment from 2U to 1U).
  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);

  const linkedRefs = useMemo(() => {
    const registryById = new Map(registry.map((ref) => [ref.id, ref]));
    const refs = new Map<DesignId, string>();
    for (const bin of bins) {
      if (bin.linkedDesignId === undefined || refs.has(bin.linkedDesignId)) continue;
      const ref = registryById.get(bin.linkedDesignId);
      // Quantize the nozzle so float noise can't fragment the cache key.
      if (ref)
        refs.set(bin.linkedDesignId, `${ref.id}:${ref.updatedAt}:n${nozzleSizeMm.toFixed(3)}`);
    }
    return refs;
  }, [bins, registry, nozzleSizeMm]);

  useEffect(() => {
    let cancelled = false;
    const onSettled = (): void => {
      if (!cancelled) setLoadTick((tick) => tick + 1);
    };
    for (const [id, key] of linkedRefs) {
      if (plateSetCache.get(id)?.key !== key) enqueueLoad(id, key, nozzleSizeMm, onSettled);
    }
    return () => {
      cancelled = true;
    };
  }, [linkedRefs, nozzleSizeMm]);

  return useMemo(() => {
    // loadTick re-runs this memo when async loads land in the cache.
    void loadTick;
    const sets = new Map<DesignId, DesignPlateSet>();
    for (const [id, key] of linkedRefs) {
      const entry = plateSetCache.get(id);
      if (entry && entry.key === key && entry.plateSet) sets.set(id, entry.plateSet);
    }
    return sets;
  }, [linkedRefs, loadTick]);
}
