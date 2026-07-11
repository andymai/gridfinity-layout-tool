/**
 * ColorZone → i18n key + patch lookups, shared across the eyedropper picker,
 * swap banner, and toasts. Keeping the mapping in one place stops drift
 * between the panel (which builds its own labels inline) and overlay copy.
 */

import { parseLipCell } from '../types/featureColors';
import type { ColorZone, FeatureColorConfig, LipCellZone, LipCorner } from '../types/featureColors';
import type { TFunction } from '@/i18n';

const LIP_CORNER_KEY: Record<LipCorner, string> = {
  frontLeft: 'binDesigner.colors.zone.lip.frontLeft',
  frontRight: 'binDesigner.colors.zone.lip.frontRight',
  backRight: 'binDesigner.colors.zone.lip.backRight',
  backLeft: 'binDesigner.colors.zone.lip.backLeft',
};

/** Translation key for a zone's user-facing label. */
export function zoneTranslationKey(zone: ColorZone): string {
  const cell = parseLipCell(zone);
  if (cell) return LIP_CORNER_KEY[cell.corner];
  // Lip cells are handled above; the remaining zones are the non-lip ones.
  const nonLip = zone as Exclude<ColorZone, LipCellZone>;
  switch (nonLip) {
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
    case 'topAccent':
      return 'binDesigner.colors.zone.topAccent';
    default: {
      // Compile-time exhaustiveness: a new non-lip zone must be handled above.
      const _exhaustive: never = nonLip;
      void _exhaustive;
      return 'binDesigner.colors.zone.body';
    }
  }
}

/**
 * Human-facing label for a zone. For a lip cell in a multi-band grid the band
 * number is appended, so two cells in the same corner (which share a corner
 * key) don't render identical labels — e.g. in the slicer handoff filament
 * list, where every active cell is shown side by side.
 */
export function zoneLabel(zone: ColorZone, t: TFunction, lipBands = 1): string {
  const base = t(zoneTranslationKey(zone));
  const cell = parseLipCell(zone);
  if (cell && lipBands > 1) {
    return `${base} · ${t('binDesigner.colors.lip.bandN', { n: cell.band + 1 })}`;
  }
  return base;
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
  | { topAccent: Partial<FeatureColorConfig['topAccent']> }
  | { lip: Partial<FeatureColorConfig['lip']> };

/**
 * Build the partial patch that sets the given zone to `hex`. A lip cell zone
 * writes its single canonical cell (the resolver already collapsed the hit to
 * the active grid), so the panel, 3D preview, and 3MF exporter stay in sync.
 */
export function zoneColorPatch(zone: ColorZone, hex: string): ZoneColorPatch {
  if (parseLipCell(zone)) return { lip: { cells: { [zone]: hex } } };
  const nonLip = zone as Exclude<ColorZone, LipCellZone>;
  switch (nonLip) {
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
    case 'topAccent':
      return { topAccent: { color: hex } };
    default: {
      // Compile-time exhaustiveness: a new non-lip zone must be handled above.
      const _exhaustive: never = nonLip;
      void _exhaustive;
      return { body: hex };
    }
  }
}
