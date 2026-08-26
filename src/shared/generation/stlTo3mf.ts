/**
 * The one STL-to-3MF adapter.
 *
 * Every export surface that offers 3MF gets STL bytes from the worker and
 * re-wraps them here, because the worker emits STL and STEP only.
 */

import { getUserMessage, isErr } from '@/core/result';
import { export3MF } from '@/shared/generation/export';
import type { ThreeMFOptions, ThreeMFPrintSettings } from '@/shared/generation/export';
import { parseSTLBinary } from '@/shared/generation/stlParser';

/** The slice of the global print settings a 3MF metadata block carries. */
export interface SlicerSettings {
  readonly layerHeightMm: number;
  readonly infillPercent: number;
}

export interface PrintEstimates {
  readonly printTimeMinutes: number;
  readonly gramsFilament: number;
}

export function buildThreeMFPrintSettings(
  settings: SlicerSettings,
  estimates?: PrintEstimates
): ThreeMFPrintSettings {
  return {
    layerHeight: settings.layerHeightMm,
    infillPercent: settings.infillPercent,
    material: 'PLA',
    supportRequired: false,
    estimatedMinutes: estimates?.printTimeMinutes ?? 0,
    estimatedGrams: estimates?.gramsFilament ?? 0,
  };
}

/** Throws a user-facing message when the STL bytes do not parse. */
export function stlTo3MF(
  stlData: ArrayBuffer,
  settings: SlicerSettings,
  options: Omit<ThreeMFOptions, 'printSettings'>
): Blob {
  const parsed = parseSTLBinary(stlData);
  if (isErr(parsed)) throw new Error(getUserMessage(parsed.error));
  return export3MF(parsed.value.vertices, parsed.value.normals, {
    ...options,
    printSettings: buildThreeMFPrintSettings(settings),
  });
}
