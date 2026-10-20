import type { StoredBaseplateParams } from '@/core/types';
import { snapClipLevels } from '@/shared/constants/connectors';
import { baseplateTotalHeight } from '@/shared/printSettings/baseplateHeight';

/**
 * Whether a snap clip fits a plate this tall. A floorless low-profile plate is
 * too thin for the clip's leg, and the worker then cuts no clip pockets at all,
 * so the panel has to refuse the combination rather than let it pass silently.
 * Stacking strips snap clips outright, so a stacked plate never blocks.
 *
 * `screwPadMm` is the pad the plate prints with (`plateScrewPadMm`), which only
 * exists when some screw falls back to the pocket floor.
 */
export function snapClipFitsPlate(
  stored: StoredBaseplateParams,
  lowProfileBase: boolean | undefined,
  nozzleSizeMm: number,
  screwPadMm: number
): boolean {
  if (stored.stackPrint?.enabled === true) return true;
  return snapClipLevels(
    baseplateTotalHeight({
      ...stored,
      lowProfileBase,
      screwPadThicknessMm: screwPadMm,
    }),
    stored.connectorFitOffset ?? 0,
    nozzleSizeMm
  ).viable;
}
