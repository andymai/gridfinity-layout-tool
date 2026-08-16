/**
 * Count the swappable label plates each socket-mode linked design needs, for
 * surfacing plate counts in the print list (follow-up).
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
import type { BinParams } from '@/shared/types/bin';
import { useSettingsStore } from '@/core/store';
import { planLabelPlates } from '@/shared/utils/labelSocketPlan';

/**
 * What a linked design's label tabs mean for the print list.
 *
 * `tabsWithoutText` is deliberately a design-level fact, not a per-tab count:
 * counting individual blank tabs needs the worker's tab plan (which compartments
 * can actually host one), and a count that guesses would over-report. "Tabs are
 * on and nothing is written on any of them" is exact, and it is the failure the
 * old collapsed-list hierarchy actually produced.
 */
export interface DesignLabelInfo {
  readonly plateSet: DesignPlateSet | null;
  readonly tabsWithoutText: boolean;
}

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
  readonly info: DesignLabelInfo;
}
const plateSetCache = new Map<DesignId, CacheEntry>();
const inFlight = new Set<string>();

/** Reset module state. @internal — for tests only. */
export function clearLabelPlateCountCache(): void {
  plateSetCache.clear();
  inFlight.clear();
}

// Both generation paths print exactly ONE of the two caption arrays, chosen by
// `label.span` (`labelTabBuilder` for tabs, `labelSocketPlan` for plates), and
// nothing copies captions across when the mode is toggled. Requiring both to be
// empty would stay silent on a span design whose rows are blank while stale
// compartment captions linger, which is the case the warning exists for.
function printedLabelTexts(params: BinParams): readonly string[] {
  return params.label.span === true
    ? (params.label.rowTexts ?? [])
    : (params.compartments.compartmentTexts ?? []);
}

function computeLabelInfo(design: SavedDesign, nozzleSizeMm: number): DesignLabelInfo {
  const params = design.params;
  const tabsWithoutText =
    params?.label.enabled === true && !printedLabelTexts(params).some((t) => t.trim() !== '');
  return { plateSet: computePlateSet(design, nozzleSizeMm), tabsWithoutText };
}

function computePlateSet(design: SavedDesign, nozzleSizeMm: number): DesignPlateSet | null {
  const params = design.params;
  if (!params?.label.enabled || (params.label.mode ?? 'text') !== 'socket') return null;
  const clearanceMm = effectiveLabelSocketClearance(nozzleSizeMm, params.label.plateFitOffset);
  const dims = binDimensions(params);
  const planned = planLabelPlates({
    compartments: params.compartments,
    label: params.label,
    innerWmm: dims.innerW,
    innerDmm: dims.innerD,
    clearanceMm,
    fallbackText: '',
  });
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
        info: isOk(result)
          ? computeLabelInfo(result.value, nozzleSizeMm)
          : { plateSet: null, tabsWithoutText: false },
      });
    })
    .catch(() => {
      plateSetCache.set(id, { key, info: { plateSet: null, tabsWithoutText: false } });
    })
    .finally(() => {
      inFlight.delete(key);
      onSettled();
    });
}

/**
 * Resolve what every linked design's label tabs mean for the print list —
 * swappable plate requirements, and whether the tabs carry any text at all.
 * Designs still loading are absent from the returned map. One that failed to
 * load resolves to the inert entry (no plates, no warning) so a storage error
 * cannot fabricate a blank-tab warning against a design nobody could read.
 */
export function useLabelPlateCounts(bins: Bin[]): ReadonlyMap<DesignId, DesignLabelInfo> {
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
    const infos = new Map<DesignId, DesignLabelInfo>();
    for (const [id, key] of linkedRefs) {
      const entry = plateSetCache.get(id);
      if (entry && entry.key === key) infos.set(id, entry.info);
    }
    return infos;
  }, [linkedRefs, loadTick]);
}
