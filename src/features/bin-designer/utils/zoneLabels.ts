/**
 * ColorZone → i18n key + default-color lookups, shared across the
 * eyedropper picker, swap banner, and toasts. Keeping the mapping in one
 * place stops drift between the panel (which builds its own labels
 * inline) and overlay copy.
 */

import type { ColorZone, FeatureColorConfig } from '../types/featureColors';

/** Translation key for a zone's user-facing label. */
export function zoneTranslationKey(zone: ColorZone): string {
  switch (zone) {
    case 'body':
      return 'binDesigner.colors.zone.body';
    case 'lip:frontLeft':
      return 'binDesigner.colors.zone.lip.frontLeft';
    case 'lip:frontRight':
      return 'binDesigner.colors.zone.lip.frontRight';
    case 'lip:backRight':
      return 'binDesigner.colors.zone.lip.backRight';
    case 'lip:backLeft':
      return 'binDesigner.colors.zone.lip.backLeft';
    case 'labelTab':
      return 'binDesigner.colors.zone.labelTab';
    case 'base':
      return 'binDesigner.colors.zone.base';
    case 'scoop':
      return 'binDesigner.colors.zone.scoop';
    case 'dividers':
      return 'binDesigner.colors.zone.dividers';
  }
}

/** Patch shape accepted by `updateFeatureColors` for a single zone. */
export type ZoneColorPatch =
  | { body: string }
  | { labelTab: string }
  | { base: string }
  | { scoop: string }
  | { dividers: string }
  | { lip: Partial<FeatureColorConfig['lip']> };

/** Build the partial patch that sets the given zone to `hex`. */
export function zoneColorPatch(zone: ColorZone, hex: string): ZoneColorPatch {
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
    case 'lip:frontLeft':
      return { lip: { frontLeft: hex } };
    case 'lip:frontRight':
      return { lip: { frontRight: hex } };
    case 'lip:backRight':
      return { lip: { backRight: hex } };
    case 'lip:backLeft':
      return { lip: { backLeft: hex } };
  }
}
