/**
 * ColorZone → i18n key + patch lookups, shared across the eyedropper picker,
 * swap banner, and toasts. Keeping the mapping in one place stops drift
 * between the panel (which builds its own labels inline) and overlay copy.
 */

import { parseLipCell } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig } from '../types/featureColors';

const LIP_CORNER_KEY: Record<string, string> = {
  frontLeft: 'binDesigner.colors.zone.lip.frontLeft',
  frontRight: 'binDesigner.colors.zone.lip.frontRight',
  backRight: 'binDesigner.colors.zone.lip.backRight',
  backLeft: 'binDesigner.colors.zone.lip.backLeft',
};

/** Translation key for a zone's user-facing label. */
export function zoneTranslationKey(zone: ColorZone): string {
  const cell = parseLipCell(zone);
  if (cell) return LIP_CORNER_KEY[cell.corner];
  switch (zone) {
    case 'body':
      return 'binDesigner.colors.zone.body';
    case 'labelTab':
      return 'binDesigner.colors.zone.labelTab';
    case 'base':
      return 'binDesigner.colors.zone.base';
    case 'scoop':
      return 'binDesigner.colors.zone.scoop';
    case 'dividers':
      return 'binDesigner.colors.zone.dividers';
    case 'text':
      return 'binDesigner.colors.zone.text';
    case 'lid':
      return 'binDesigner.colors.zone.lid';
    default:
      // Lip cells are handled above; this is unreachable for valid zones.
      return 'binDesigner.colors.zone.body';
  }
}

/** Patch shape accepted by `updateFeatureColors` for a single zone. */
export type ZoneColorPatch =
  | { body: string }
  | { labelTab: string }
  | { base: string }
  | { scoop: string }
  | { dividers: string }
  | { text: string }
  | { lid: string }
  | { lip: Partial<FeatureColorConfig['lip']> };

/**
 * Build the partial patch that sets the given zone to `hex`. A lip cell zone
 * writes its single canonical cell (the resolver already collapsed the hit to
 * the active grid), so the panel, 3D preview, and 3MF exporter stay in sync.
 */
export function zoneColorPatch(zone: ColorZone, hex: string): ZoneColorPatch {
  if (parseLipCell(zone)) return { lip: { cells: { [zone]: hex } } };
  switch (zone) {
    case 'body':
      return { body: hex };
    case 'labelTab':
      return { labelTab: hex };
    case 'base':
      return { base: hex };
    case 'scoop':
      return { scoop: hex };
    case 'dividers':
      return { dividers: hex };
    case 'text':
      return { text: hex };
    case 'lid':
      return { lid: hex };
    default:
      return { body: hex };
  }
}
