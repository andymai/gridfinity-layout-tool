import { paramsFingerprint } from '@/shared/generation/paramsFingerprint';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import type { BinParams } from '../types';

/**
 * The fields that change the printed part. Settings and the owning layout
 * write the others (nozzle, magnet anchor, low-profile feet) into a design
 * nobody has edited, so comparing every field would call it edited.
 */
const PART_FIELDS = [
  'width',
  'depth',
  'height',
  'wallThickness',
  'base',
  'style',
  'compartments',
  'scoop',
  'label',
  'walls',
  'slide',
  'handles',
  'pullTab',
  'slotConfig',
  'dividerPieces',
  'inserts',
  'cutouts',
  'wallPattern',
  'floorPattern',
  'surfaceText',
  'lid',
  'knifeRest',
  'cellMask',
  'overhang',
  'extraWallHeightMm',
  'slant',
] as const satisfies readonly (keyof BinParams)[];

function partOf(params: BinParams): Record<string, unknown> {
  const part: Record<string, unknown> = {};
  for (const field of PART_FIELDS) part[field] = params[field];
  part.base = { ...params.base, lowProfile: undefined };
  return part;
}

let defaultPart: string | null = null;

/** True for the "Untitled Bin" a first designer visit saves, until someone edits it. */
export function isUntouchedDefault(params: BinParams): boolean {
  defaultPart ??= paramsFingerprint(partOf(DEFAULT_BIN_PARAMS));
  return paramsFingerprint(partOf(params)) === defaultPart;
}
