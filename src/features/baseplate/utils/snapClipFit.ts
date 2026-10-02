import type { StoredBaseplateParams } from '@/core/types';
import { snapClipLevels } from '@/shared/constants/connectors';
import { baseplateTotalHeight } from '@/shared/printSettings/baseplateHeight';

/**
 * Whether a snap clip fits a plate this tall. A floorless low-profile plate is
 * too thin for the clip's leg, and the worker then cuts no clip pockets at all,
 * so the panel has to refuse the combination rather than let it pass silently.
 */
export function snapClipFitsPlate(
  stored: StoredBaseplateParams,
  lowProfileBase: boolean | undefined,
  nozzleSizeMm: number
): boolean {
  return snapClipLevels(
    baseplateTotalHeight({ ...stored, lowProfileBase }),
    stored.connectorFitOffset ?? 0,
    nozzleSizeMm
  ).viable;
}
