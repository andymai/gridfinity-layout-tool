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
    case 'text':
      return 'binDesigner.colors.zone.text';
    case 'lid':
      return 'binDesigner.colors.zone.lid';
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
 * Build the partial patch that sets the given zone to `hex`.
 *
 * Any lip-corner zone mirrors `hex` into all four corner slots: the
 * per-corner UI is currently rolled back to a single lip color, but the
 * 4-corner schema is preserved on the model side. Mirroring keeps the
 * panel, 3D preview, and 3MF exporter in agreement no matter which
 * specific corner the eyedropper hit-tested to.
 */
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
    case 'text':
      return { text: hex };
    case 'lid':
      return { lid: hex };
    case 'lip:frontLeft':
    case 'lip:frontRight':
    case 'lip:backRight':
    case 'lip:backLeft':
      return { lip: { frontLeft: hex, frontRight: hex, backRight: hex, backLeft: hex } };
  }
}
