/**
 * Feature color types for multi-color bin design.
 *
 * Each non-lip zone stores a hex color directly. The lip is a 2-D grid:
 * an XY corner quadrant (front-left, front-right, back-right, back-left)
 * crossed with a Z height band (bottom→top). The user picks an active
 * corner count (1/2/4) and band count (1/2/4); the full 4×4 = 16 cells are
 * always stored so changing counts is non-destructive. Classification
 * collapses a raycast/centroid hit down to the active grid's canonical cell.
 */

import { FeatureTag } from '@/shared/types/generation';
import type { BaseStyle } from './index';

/** Lip corner identifier — quadrant of the outer XY bbox. */
export type LipCorner = 'frontLeft' | 'frontRight' | 'backRight' | 'backLeft';

/** Lip band index — 0 = bottom (meets body), increasing upward to the rim. */
export type LipBand = 0 | 1 | 2 | 3;

/** Active corner / band counts. 1 collapses that axis to a single color. */
export type LipAxisCount = 1 | 2 | 4;

export const LIP_CORNERS: readonly LipCorner[] = [
  'frontLeft',
  'frontRight',
  'backRight',
  'backLeft',
] as const;

export const LIP_BANDS: readonly LipBand[] = [0, 1, 2, 3] as const;

export const LIP_AXIS_COUNTS: readonly LipAxisCount[] = [1, 2, 4] as const;

/** Default height (mm) of the top accent band when the user first enables it. */
export const TOP_ACCENT_DEFAULT_MM = 2;
/** Smallest band height the UI/slider allows (0 renders nothing). */
export const TOP_ACCENT_MIN_MM = 0;
/**
 * Top accent band — recolors the top `heightMm` of the bin (measured down from
 * the highest point of the body mesh) a single accent color, whether or not a
 * stacking lip is present. Geometry above the cut plane wins over every other
 * zone, including lip cells; the lid is a separate object and keeps its own
 * color. Height is absolute mm (slicer/layer-height agnostic).
 */
export interface TopAccentConfig {
  readonly enabled: boolean;
  readonly heightMm: number;
  readonly color: string;
}

/**
 * Lip color grid. `cells` always holds all 16 `lip:<corner>:<band>` entries
 * (uniform shape, no optional keys) so toggling `corners`/`bands` never drops
 * a stored color — collapsed cells stay dormant and reappear when the count
 * grows back. `corners`/`bands` are the *active* axis sizes.
 */
export interface LipColorConfig {
  readonly corners: LipAxisCount;
  readonly bands: LipAxisCount;
  readonly cells: { readonly [cellId: string]: string };
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
  readonly topAccent: TopAccentConfig;
}

/** A lip cell zone id, `lip:${corner}:${band}`. */
export type LipCellZone = `lip:${LipCorner}:${LipBand}`;

/**
 * All editable color zones — each backed by exactly one hex color.
 *
 * The lip splits into 16 `lip:<corner>:<band>` cells; the bare 'lip'
 * identifier is reserved for hover (highlighting the whole lip on
 * group-header hover) and is not a settable color slot.
 */
export type ColorZone =
  'body' | LipCellZone | 'labelTab' | 'base' | 'scoop' | 'dividers' | 'text' | 'lid' | 'topAccent';

/** Hover target — accepts every ColorZone plus the lip group header. */
export type HoverableZone = ColorZone | 'lip';

export function lipCellZone(corner: LipCorner, band: LipBand): LipCellZone {
  return `lip:${corner}:${band}` as const;
}

/** All 16 lip cell ids in canonical order (corner-major, band-minor). */
export const LIP_CELL_ZONES: readonly LipCellZone[] = LIP_CORNERS.flatMap((corner) =>
  LIP_BANDS.map((band) => lipCellZone(corner, band))
);

const LIP_CELL_RE = /^lip:(frontLeft|frontRight|backRight|backLeft):([0-3])$/;

/** Parse a lip cell zone id back to its corner/band, or null if not a lip cell. */
export function parseLipCell(zone: string): { corner: LipCorner; band: LipBand } | null {
  const m = LIP_CELL_RE.exec(zone);
  if (!m) return null;
  return { corner: m[1] as LipCorner, band: Number(m[2]) as LipBand };
}

/**
 * Collapse a raw (corner, band) to the canonical cell of the active grid.
 * Corner: 1 → frontLeft; 2 → front/back (frontLeft / backLeft); 4 → as-is.
 * Band: already classified into `0..bands-1` by `classifyLipBand`, so the
 * band index is canonical — only the corner axis needs folding here.
 */
export function collapseLipCell(
  corner: LipCorner,
  band: LipBand,
  counts: { corners: LipAxisCount; bands: LipAxisCount }
): LipCellZone {
  let c: LipCorner = corner;
  if (counts.corners === 1) {
    c = 'frontLeft';
  } else if (counts.corners === 2) {
    // Front/back split: collapse left/right within each half to the left key.
    c = corner === 'frontRight' ? 'frontLeft' : corner === 'backRight' ? 'backLeft' : corner;
  }
  return lipCellZone(c, band);
}

/** All 16 cells set to the same hex — used for defaults and migration. */
export function makeUniformLipCells(hex: string): { [cellId: string]: string } {
  const cells: { [cellId: string]: string } = {};
  for (const id of LIP_CELL_ZONES) cells[id] = hex;
  return cells;
}

function clampLipAxis(n: unknown): LipAxisCount {
  return n === 2 ? 2 : n === 4 ? 4 : 1;
}

/**
 * Apply a partial lip patch, merging `cells` entry-by-entry so a single-cell
 * write (or a corner/band count change) never drops the other stored cells —
 * count changes stay non-destructive.
 */
export function mergeLipConfig(
  current: LipColorConfig,
  patch: Partial<LipColorConfig>
): LipColorConfig {
  return {
    ...current,
    ...patch,
    cells: patch.cells ? { ...current.cells, ...patch.cells } : current.cells,
  };
}

/**
 * Coerce a persisted lip value of any era (legacy 4-corner object, or the
 * current grid) into a full {@link LipColorConfig}. Used when applying a saved
 * color palette, whose stored lip shape isn't run through the design migrator.
 */
export function normalizePaletteLip(raw: unknown, fallback: string): LipColorConfig {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if ('cells' in o || 'corners' in o || 'bands' in o) {
      const cells = makeUniformLipCells(fallback);
      const rawCells = o.cells;
      if (rawCells && typeof rawCells === 'object') {
        for (const id of LIP_CELL_ZONES) {
          const v = (rawCells as Record<string, unknown>)[id];
          if (typeof v === 'string') cells[id] = v;
        }
      }
      return { corners: clampLipAxis(o.corners), bands: clampLipAxis(o.bands), cells };
    }
    // Legacy 4-corner palette → canonicalize to a uniform 1×1 grid.
    const fl = typeof o.frontLeft === 'string' ? o.frontLeft : fallback;
    return { corners: 1, bands: 1, cells: makeUniformLipCells(fl) };
  }
  return { corners: 1, bands: 1, cells: makeUniformLipCells(fallback) };
}

/**
 * Canonical zone ordering. Used as both the iteration order for full-zone
 * walks and the index for the 3D preview's per-zone material array — body
 * at 0 makes it the natural fallback for triangles outside any face group.
 * The 16 lip cells occupy fixed slots so `zoneIndex` stays stable when the
 * user changes corner/band counts (no material-index churn mid-session).
 */
export const ZONE_ORDER: readonly ColorZone[] = [
  'body',
  ...LIP_CELL_ZONES,
  'labelTab',
  'base',
  'scoop',
  'dividers',
  'text',
  'lid',
  'topAccent',
] as const;

/** Position of a zone in ZONE_ORDER. */
export function zoneIndex(zone: ColorZone): number {
  return ZONE_ORDER.indexOf(zone);
}

/** Highest Z across a flat xyz vertex buffer (stride 3). Works for both the
 *  preview's indexed vertices and the exporter's flat 9-floats/triangle array,
 *  since both interleave x,y,z. Returns -Infinity for an empty buffer. */
export function maxZOfVertices(vertices: ArrayLike<number>): number {
  let max = -Infinity;
  for (let i = 2; i < vertices.length; i += 3) {
    if (vertices[i] > max) max = vertices[i];
  }
  return max;
}

/**
 * The Z plane above which geometry becomes the top-accent color, or null when
 * the accent is off (disabled, non-positive height, or an empty mesh). The
 * band hangs `heightMm` down from the mesh's highest point. Callers pass the
 * bin-body mesh top (the lid is a separate object and never contributes here).
 */
export function topAccentCutZ(topAccent: TopAccentConfig, meshTopZ: number): number | null {
  if (!topAccentActive(topAccent) || !Number.isFinite(meshTopZ)) return null;
  return meshTopZ - topAccent.heightMm;
}

/** True when the top-accent band paints anything (enabled with positive height).
 *  Fully determined by the config — unlike scoop/dividers, it needs no external
 *  feature flag — so preview/export can derive its activeness without relying on
 *  a caller-supplied active-zone set. */
export function topAccentActive(topAccent: {
  readonly enabled: boolean;
  readonly heightMm: number;
}): boolean {
  return topAccent.enabled && topAccent.heightMm > 0;
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
    case 'topAccent':
      return c.topAccent.color;
    default:
      // lip cell — fall back to body for a missing/legacy cell.
      return c.lip.cells[z] ?? c.body;
  }
}

/**
 * Maps a non-LIP FeatureTag to its ColorZone. LIP returns null because
 * lip faces need centroid-based classification into one of the grid cells.
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
  readonly label: { readonly enabled: boolean; readonly mode?: 'text' | 'socket' };
  readonly scoop: { readonly enabled: boolean };
  readonly lid: { readonly enabled: boolean };
  readonly compartments: {
    readonly cells: readonly number[];
    readonly compartmentTexts?: readonly string[];
  };
  readonly cutouts?: readonly { readonly engraveLabel?: boolean; readonly label: string }[];
  /**
   * Active lip color-grid sizes. Determines which lip cells are exposed as
   * editable/active zones. Absent → treated as a uniform 1×1 lip (single
   * canonical cell), matching the pre-grid behavior.
   */
  readonly featureColors?: {
    readonly lip: { readonly corners: LipAxisCount; readonly bands: LipAxisCount };
    /**
     * Top accent band. Exposed as an active zone whenever it's enabled with a
     * positive height — it's independent of the lip and every other feature.
     */
    readonly topAccent?: { readonly enabled: boolean; readonly heightMm: number };
  };
}

/** Canonical active lip cells for the given corner/band counts. */
/** Active corner quadrants, in left→right display order, for a corner count. */
export function activeCornerColumns(corners: LipAxisCount): LipCorner[] {
  if (corners === 1) return ['frontLeft'];
  if (corners === 2) return ['frontLeft', 'backLeft'];
  return ['frontLeft', 'frontRight', 'backRight', 'backLeft'];
}

export function activeLipCells(counts: {
  corners: LipAxisCount;
  bands: LipAxisCount;
}): LipCellZone[] {
  const corners = activeCornerColumns(counts.corners);
  const bands = LIP_BANDS.slice(0, counts.bands);
  return corners.flatMap((corner) => bands.map((band) => lipCellZone(corner, band)));
}

/**
 * True when every active lip cell shares one color — i.e. the grid renders as a
 * single color and the seam split can be skipped (no boundaries to honor).
 */
export function lipCellsUniform(lip: LipColorConfig): boolean {
  const active = activeLipCells({ corners: lip.corners, bands: lip.bands });
  if (active.length <= 1) return true;
  const first = lip.cells[active[0]];
  return active.every((zone) => lip.cells[zone] === first);
}

/**
 * The set of zones whose color a user can actually see in the current
 * configuration. Used uniformly by the panel (row visibility), the 3D
 * preview (multi-color gating), and the 3MF exporter — keeping them
 * aligned prevents drift like "preview reports single-color while the
 * exporter writes a multi-material 3MF because of a stale lip cell".
 */
export function computeActiveZones(p: ActiveZonesParams): ReadonlySet<ColorZone> {
  const cells = p.compartments.cells;
  const firstCell = cells[0] ?? 0;
  const hasDividers = cells.length > 1 && cells.some((c) => c !== firstCell);
  // Socket-mode tabs carry a plate pocket, not engraved text — texts may
  // persist in the config (they label grid cells and feed future plates)
  // but produce no text geometry, so the zone must not reach the exporter.
  const hasTabText =
    p.label.enabled &&
    (p.label.mode ?? 'text') !== 'socket' &&
    (p.compartments.compartmentTexts ?? []).some((t) => t.trim().length > 0);
  const hasCutoutText = (p.cutouts ?? []).some(
    (c) => c.engraveLabel === true && c.label.trim().length > 0
  );

  const zones = new Set<ColorZone>(['body']);
  if (p.base.style !== 'flat') zones.add('base');
  if (p.base.stackingLip) {
    const grid = p.featureColors?.lip ?? { corners: 1, bands: 1 };
    for (const cell of activeLipCells(grid)) zones.add(cell);
  }
  if (p.label.enabled) zones.add('labelTab');
  if (p.scoop.enabled) zones.add('scoop');
  // Lid needs a stacking lip to click into; `shouldGenerateLid` enforces
  // the same precondition. Without this guard the panel would expose a
  // Lid color row for a config the worker won't export.
  if (p.lid.enabled && p.base.stackingLip) zones.add('lid');
  if (hasDividers) zones.add('dividers');
  if (hasTabText || hasCutoutText) zones.add('text');
  // Top accent is independent of every other feature — a positive-height band
  // recolors the top of the bin whether or not it has a lip.
  const topAccent = p.featureColors?.topAccent;
  if (topAccent && topAccentActive(topAccent)) zones.add('topAccent');
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
