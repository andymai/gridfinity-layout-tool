/**
 * Entry-unit conversion for the accent-band height sliders.
 *
 * An accent band's height is stored as absolute mm (see `AccentBandConfig`), so
 * this is an authoring-input concern only: the layer height comes from the
 * user's global print settings and the only thing that ever reaches `params` is
 * the mm value `toMm` returns. Changing your printer profile therefore never
 * repaints a saved design.
 */

import type { AccentBandUnit } from '@/core/store/settings.types';

/** Slider bounds and conversions for one accent-band height control. */
export interface AccentBandScale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** The stored height expressed in the active unit, clamped to `max`. */
  readonly value: number;
  /** Slider value → the mm to store. */
  readonly toMm: (value: number) => number;
}

/** Finest mm step the slider offers, and the precision mm values are kept at. */
const MM_STEP = 0.1;

/** A layer height only counts if it can actually divide a height. */
function usableLayerHeight(layerHeightMm: number): number | null {
  return Number.isFinite(layerHeightMm) && layerHeightMm > 0 ? layerHeightMm : null;
}

/** A finite, non-negative height. `migrateParams` already rejects a corrupt
 *  persisted value, but this keeps the returned `value` inside `[min, max]`
 *  for every input rather than only the reachable ones — the same guard the
 *  panel puts on the cap it passes in as `maxMm`. */
function usableHeight(heightMm: number): number {
  return Number.isFinite(heightMm) && heightMm > 0 ? heightMm : 0;
}

/** Round to 3dp so `12 * 0.2` stores as 2.4, not 2.4000000000000004. */
function roundMm(mm: number): number {
  return Math.round(mm * 1000) / 1000;
}

/**
 * Build the slider scale for a band height.
 *
 * In `layers` mode the range is whole layers up to the last one that still fits
 * `maxMm`, so the slider can never author a band taller than the bin. A layer
 * height that can't divide (0, NaN, a corrupt setting) falls back to mm rather
 * than producing an empty range.
 */
export function accentBandScale(
  heightMm: number,
  maxMm: number,
  unit: AccentBandUnit,
  layerHeightMm: number
): AccentBandScale {
  const layer = usableLayerHeight(layerHeightMm);
  const height = usableHeight(heightMm);
  if (unit === 'layers' && layer !== null) {
    // Floor, so the top of the range is the last WHOLE layer that fits. The 1
    // floor keeps the slider from collapsing to an empty range on a bin shorter
    // than one layer — unreachable through the panel, which caps `maxMm` at 1mm
    // against a layer height of at most 0.32mm, but a corrupt setting must not
    // produce one. `toMm` clamps for that same case: there, and only there, one
    // layer is taller than the whole bin.
    const maxLayers = Math.max(1, Math.floor(maxMm / layer));
    return {
      min: 0,
      max: maxLayers,
      step: 1,
      value: Math.min(maxLayers, Math.round(height / layer)),
      toMm: (layers) => Math.min(roundMm(layers * layer), roundMm(maxMm)),
    };
  }
  return {
    min: 0,
    max: maxMm,
    step: MM_STEP,
    value: Math.min(height, maxMm),
    toMm: roundMm,
  };
}

/**
 * How many layers a stored height spans, to 1dp — the readout that tells a user
 * in mm mode whether their band lands on a layer boundary. Null when the layer
 * height can't divide.
 */
export function accentBandLayers(heightMm: number, layerHeightMm: number): number | null {
  const layer = usableLayerHeight(layerHeightMm);
  if (layer === null) return null;
  return Math.round((usableHeight(heightMm) / layer) * 10) / 10;
}
