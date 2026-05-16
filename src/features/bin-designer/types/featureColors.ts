/**
 * Feature color types for multi-color bin design.
 *
 * Each non-lip zone stores a hex color directly. The lip splits into
 * four corner zones (front-left, front-right, back-right, back-left)
 * snapped to the outer bbox of the bin's footprint — even on multi-cell
 * and custom-shape bins, there are always exactly 4 lip-corner zones.
 */

import { FeatureTag } from '@/shared/types/generation';

/** Lip corner identifier — quadrant of the outer XY bbox. */
export type LipCorner = 'frontLeft' | 'frontRight' | 'backRight' | 'backLeft';

export const LIP_CORNERS: readonly LipCorner[] = [
  'frontLeft',
  'frontRight',
  'backRight',
  'backLeft',
] as const;

/** Per-corner lip color assignment. */
export interface LipColorConfig {
  readonly frontLeft: string;
  readonly frontRight: string;
  readonly backRight: string;
  readonly backLeft: string;
}

/** Per-zone hex color assignment. */
export interface FeatureColorConfig {
  /** Body shell — bin walls and floor (FeatureTag.BASE + unclassified). */
  readonly body: string;
  /** Stacking lip, split into 4 corner quadrants. */
  readonly lip: LipColorConfig;
  /** Label tab. */
  readonly labelTab: string;
  /** Gridfinity foot (FeatureTag.SOCKET — magnets, screws, baseplate fit). */
  readonly base: string;
  /** Scoop / front internal ramp (FeatureTag.SCOOP). */
  readonly scoop: string;
  /** Interior compartment dividers (FeatureTag.DIVIDER). */
  readonly dividers: string;
}

/**
 * All editable color zones — each backed by exactly one hex color.
 *
 * Lip is split into four `lip:*` zones; the bare 'lip' identifier is
 * reserved for hover (highlighting the whole lip on group-header hover)
 * and is not a settable color slot.
 */
export type ColorZone =
  | 'body'
  | 'lip:frontLeft'
  | 'lip:frontRight'
  | 'lip:backRight'
  | 'lip:backLeft'
  | 'labelTab'
  | 'base'
  | 'scoop'
  | 'dividers';

/** Hover target — accepts every ColorZone plus the lip group header. */
export type HoverableZone = ColorZone | 'lip';

const ALL_ZONES: readonly ColorZone[] = [
  'body',
  'lip:frontLeft',
  'lip:frontRight',
  'lip:backRight',
  'lip:backLeft',
  'labelTab',
  'base',
  'scoop',
  'dividers',
] as const;

/** Look up the hex value of a specific zone in a FeatureColorConfig. */
export function getZoneColor(c: FeatureColorConfig, z: ColorZone): string {
  switch (z) {
    case 'body':
      return c.body;
    case 'labelTab':
      return c.labelTab;
    case 'base':
      return c.base;
    case 'scoop':
      return c.scoop;
    case 'dividers':
      return c.dividers;
    case 'lip:frontLeft':
      return c.lip.frontLeft;
    case 'lip:frontRight':
      return c.lip.frontRight;
    case 'lip:backRight':
      return c.lip.backRight;
    case 'lip:backLeft':
      return c.lip.backLeft;
  }
}

/** Compose a lip-corner zone from a LipCorner. */
export function lipCornerZone(corner: LipCorner): ColorZone {
  return `lip:${corner}` as const;
}

/** Build the set of lip-corner ColorZones. */
export function lipCornerZones(): ReadonlySet<ColorZone> {
  return new Set<ColorZone>(LIP_CORNERS.map(lipCornerZone));
}

/**
 * Maps a non-LIP FeatureTag to its ColorZone. LIP returns null because
 * lip faces need centroid-based classification into one of four corners.
 */
export function featureTagToColorZone(tag: number): ColorZone | null {
  switch (tag) {
    case FeatureTag.LABEL_TAB:
      return 'labelTab';
    case FeatureTag.SOCKET:
      return 'base';
    case FeatureTag.SCOOP:
      return 'scoop';
    case FeatureTag.DIVIDER:
      return 'dividers';
    case FeatureTag.LIP:
      return null;
    default:
      return 'body';
  }
}

/**
 * True when all *active* zones use the same color (no multi-material
 * payload needed in the 3MF export and no multi-material setup in the
 * preview).
 *
 * `activeZones` lets callers pass only the currently-relevant zones
 * (e.g., skip lip corners when the bin has no stacking lip) so a single
 * pattern-color bin doesn't get flagged as multi-color just because the
 * disabled lip's corner colors differ.
 */
export function isSingleColor(
  c: FeatureColorConfig,
  activeZones?: ReadonlySet<ColorZone>
): boolean {
  const zones = activeZones ? [...activeZones] : ALL_ZONES;
  const ref = c.body;
  for (const z of zones) {
    if (getZoneColor(c, z) !== ref) return false;
  }
  return true;
}

/**
 * Dedupe zone colors into a flat list + lookup map. Body always lands
 * at index 0 so it's the default fallback in 3MF / preview groupings.
 */
export function resolveColorMapping(c: FeatureColorConfig): {
  colors: readonly string[];
  colorToIndex: ReadonlyMap<string, number>;
  defaultIndex: number;
} {
  const colorToIndex = new Map<string, number>();
  const colors: string[] = [];

  colorToIndex.set(c.body, 0);
  colors.push(c.body);

  for (const z of ALL_ZONES) {
    if (z === 'body') continue;
    const hex = getZoneColor(c, z);
    if (colorToIndex.has(hex)) continue;
    colorToIndex.set(hex, colors.length);
    colors.push(hex);
  }

  return { colors, colorToIndex, defaultIndex: 0 };
}
