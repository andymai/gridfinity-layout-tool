/**
 * Feature color types for multi-color bin design.
 *
 * Each non-lip zone stores a hex color directly. The lip splits into
 * four corner zones (front-left, front-right, back-right, back-left)
 * snapped to the outer bbox of the bin's footprint — even on multi-cell
 * and custom-shape bins, there are always exactly 4 lip-corner zones.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { BaseStyle } from './index';

/** Lip corner identifier — quadrant of the outer XY bbox. */
export type LipCorner = 'frontLeft' | 'frontRight' | 'backRight' | 'backLeft';

export const LIP_CORNERS: readonly LipCorner[] = [
  'frontLeft',
  'frontRight',
  'backRight',
  'backLeft',
] as const;

export interface LipColorConfig {
  readonly frontLeft: string;
  readonly frontRight: string;
  readonly backRight: string;
  readonly backLeft: string;
}

export interface FeatureColorConfig {
  /** Whether multi-color zone editing is active for this design. When false,
   *  zone editors are hidden, the preview renders as a single body color, and
   *  3MF exports omit material indices. */
  readonly enabled: boolean;
  /** Body shell — bin walls and floor (FeatureTag.BASE + unclassified). */
  readonly body: string;
  readonly lip: LipColorConfig;
  readonly labelTab: string;
  /** Gridfinity foot (FeatureTag.SOCKET — magnets, screws, baseplate fit). */
  readonly base: string;
  /** Scoop / front internal ramp (FeatureTag.SCOOP). */
  readonly scoop: string;
  /** Interior compartment dividers (FeatureTag.DIVIDER). */
  readonly dividers: string;
  /**
   * Engraved text on label tabs and adjacent to cutouts (FeatureTag.TEXT).
   * Defaults to the label-tab color so single-color users see no change;
   * multi-material printers can paint a contrasting filament here.
   */
  readonly text: string;
  /**
   * Click-lock lid (separate `<object>` in the 3MF). Lid has no FeatureTag
   * inside the bin mesh — it's classified by piece label at the 3MF assembly
   * step, not by per-triangle face groups. Defaults to body color so
   * single-color users see no change.
   */
  readonly lid: string;
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
  | 'dividers'
  | 'text'
  | 'lid';

/** Hover target — accepts every ColorZone plus the lip group header. */
export type HoverableZone = ColorZone | 'lip';

/**
 * Canonical zone ordering. Used as both the iteration order for full-zone
 * walks and the index for the 3D preview's per-zone material array — body
 * at 0 makes it the natural fallback for triangles outside any face group.
 */
export const ZONE_ORDER: readonly ColorZone[] = [
  'body',
  'lip:frontLeft',
  'lip:frontRight',
  'lip:backRight',
  'lip:backLeft',
  'labelTab',
  'base',
  'scoop',
  'dividers',
  'text',
  'lid',
] as const;

/** Position of a zone in ZONE_ORDER. */
export function zoneIndex(zone: ColorZone): number {
  return ZONE_ORDER.indexOf(zone);
}

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
    case 'text':
      return c.text;
    case 'lid':
      return c.lid;
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

export function lipCornerZone(corner: LipCorner): ColorZone {
  return `lip:${corner}` as const;
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
    case FeatureTag.TEXT:
      return 'text';
    case FeatureTag.LIP:
      return null;
    default:
      return 'body';
  }
}

const SHORTHAND_HEX = /^#[0-9a-f]{3}$/;

/**
 * Canonicalize a hex color string for case/length-insensitive comparison and
 * deduplication. Lowercases and expands 3-char shorthand (`#rgb` → `#rrggbb`)
 * so legacy/imported configs with mixed conventions collapse to one slot in
 * the 3MF basematerials section. Inputs that don't look like recognized hex
 * forms pass through unchanged (lowercased).
 */
export function normalizeHex(hex: string): string {
  const lower = hex.toLowerCase();
  if (SHORTHAND_HEX.test(lower)) {
    return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
  }
  return lower;
}

/**
 * True when every zone in `activeZones` matches body. Required because
 * forgetting to filter out hidden-feature zones would flag a single-color
 * design as multi-color from a stale recolor on a disabled feature (the
 * exact bug we hit when the preview and exporter gated differently).
 * Pass `ZONE_ORDER` (or `new Set(ZONE_ORDER)`) for an unconditional check.
 */
export function isSingleColor(
  c: FeatureColorConfig,
  activeZones: ReadonlySet<ColorZone> | readonly ColorZone[]
): boolean {
  // Normalize in lockstep with `resolveColorMapping` — otherwise a mixed-case
  // or mixed-length design (body `#FFF` + text `#ffffff`) would skip the
  // early-exit and emit a `<basematerials>` section with a single material
  // instead of returning null (no basematerials).
  const ref = normalizeHex(c.body);
  for (const z of activeZones) {
    if (normalizeHex(getZoneColor(c, z)) !== ref) return false;
  }
  return true;
}

/**
 * Subset of `BinParams` that determines which zones are visually
 * meaningful. Declared structurally to avoid a circular import on
 * the full `BinParams` type.
 */
export interface ActiveZonesParams {
  readonly base: { readonly style: BaseStyle; readonly stackingLip: boolean };
  readonly label: { readonly enabled: boolean };
  readonly scoop: { readonly enabled: boolean };
  readonly lid: { readonly enabled: boolean };
  readonly compartments: {
    readonly cells: readonly number[];
    readonly compartmentTexts?: readonly string[];
  };
  readonly cutouts?: readonly { readonly engraveLabel?: boolean; readonly label: string }[];
}

/**
 * The set of zones whose color a user can actually see in the current
 * configuration. Used uniformly by the panel (row visibility), the 3D
 * preview (multi-color gating), and the 3MF exporter — keeping them
 * aligned prevents drift like "preview reports single-color while the
 * exporter writes a multi-material 3MF because of a stale lip corner".
 */
export function computeActiveZones(p: ActiveZonesParams): ReadonlySet<ColorZone> {
  const cells = p.compartments.cells;
  const firstCell = cells[0] ?? 0;
  const hasDividers = cells.length > 1 && cells.some((c) => c !== firstCell);
  const hasTabText =
    p.label.enabled && (p.compartments.compartmentTexts ?? []).some((t) => t.trim().length > 0);
  const hasCutoutText = (p.cutouts ?? []).some(
    (c) => c.engraveLabel === true && c.label.trim().length > 0
  );

  const zones = new Set<ColorZone>(['body']);
  if (p.base.style !== 'flat') zones.add('base');
  if (p.base.stackingLip) {
    for (const corner of LIP_CORNERS) zones.add(lipCornerZone(corner));
  }
  if (p.label.enabled) zones.add('labelTab');
  if (p.scoop.enabled) zones.add('scoop');
  // Lid needs a stacking lip to click into; `shouldGenerateLid` enforces
  // the same precondition. Without this guard the panel would expose a
  // Lid color row for a config the worker won't export.
  if (p.lid.enabled && p.base.stackingLip) zones.add('lid');
  if (hasDividers) zones.add('dividers');
  if (hasTabText || hasCutoutText) zones.add('text');
  return zones;
}

export function resolveColorMapping(c: FeatureColorConfig): {
  colors: readonly string[];
  colorToIndex: ReadonlyMap<string, number>;
  defaultIndex: number;
} {
  // Normalize via `normalizeHex` before deduping so legacy/imported designs
  // with mixed-case or mixed-length hex (e.g. body `#FFF` vs text `#ffffff`)
  // collapse to a single material rather than spuriously splitting.
  // Lowercase 6-char hex is also the standard convention for `displaycolor`.
  const colorToIndex = new Map<string, number>();
  const colors: string[] = [];

  const bodyHex = normalizeHex(c.body);
  colorToIndex.set(bodyHex, 0);
  colors.push(bodyHex);

  for (const z of ZONE_ORDER) {
    if (z === 'body') continue;
    const hex = normalizeHex(getZoneColor(c, z));
    if (colorToIndex.has(hex)) continue;
    colorToIndex.set(hex, colors.length);
    colors.push(hex);
  }

  return { colors, colorToIndex, defaultIndex: 0 };
}
