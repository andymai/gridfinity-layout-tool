import { paramsFingerprint } from '@/shared/generation/paramsFingerprint';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

/**
 * Fields written into a design that nobody edited, so they say nothing about
 * work: settings write the nozzle, the owning layout syncs its units, magnet
 * anchor and low-profile feet (`useSyncPhysicalUnits`), and migration fills
 * `textDefaults`, which only shapes text that the text fields already count.
 * Every other field is an edit, including fields added after this list.
 */
const WRITTEN_FOR_THE_USER: ReadonlySet<string> = new Set<keyof BinParams>([
  'nozzleSizeMm',
  'magnetAnchor',
  'gridUnitMm',
  'gridUnitMmY',
  'heightUnitMm',
  'textDefaults',
]);

function partOf(params: BinParams): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      Object.entries(params).filter(([field]) => !WRITTEN_FOR_THE_USER.has(field))
    ),
    base: { ...params.base, lowProfile: undefined },
    // The unit sync resizes a lid even while it is off.
    lid: params.lid.enabled ? params.lid : { enabled: false },
  };
}

let defaultPart: string | null = null;

/** True for the "Untitled Bin" a first designer visit saves, until someone edits it. */
export function isUntouchedDefault(params: BinParams): boolean {
  defaultPart ??= paramsFingerprint(partOf(DEFAULT_BIN_PARAMS));
  return paramsFingerprint(partOf(params)) === defaultPart;
}
