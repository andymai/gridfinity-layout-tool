/** Migration of persisted feature colours: legacy slot colours, lip corners and grid, accent band. */

import type { AccentBandConfig, FeatureColorConfig, LipAxisCount } from '../types/featureColors';
import { makeUniformLipCells, LIP_CELL_ZONES } from '../types/featureColors';
import { DEFAULT_FEATURE_COLOR_CONFIG } from './defaults';

/** Map legacy FilamentSlotId values (from pre-v4.30 designs) to hex colors for migration */
const LEGACY_SLOT_COLORS: Record<string, string> = {
  slot1: '#d4d8dc',
  slot2: '#3b82f6',
  slot3: '#22c55e',
  slot4: '#ef4444',
};

/** Old per-corner lip object (pre quadrant×band grid). */
interface LegacyLipCorners {
  frontLeft?: string;
  frontRight?: string;
  backRight?: string;
  backLeft?: string;
}

/** New quadrant×band lip grid (current shape, possibly partial on reload). */
interface GridLipInput {
  corners?: number;
  bands?: number;
  cells?: { [cellId: string]: string };
}

export interface LegacyFeatureColorInput {
  enabled?: boolean;
  body?: string;
  /** Legacy single-color string, legacy 4-corner object, or the new grid. */
  lip?: string | LegacyLipCorners | GridLipInput;
  labelTab?: string;
  base?: string;
  scoop?: string;
  dividers?: string;
  text?: string;
  lid?: string;
  lidLip?: string | LegacyLipCorners | GridLipInput;
  topAccent?: { enabled?: unknown; heightMm?: unknown; color?: unknown };
  bottomAccent?: { enabled?: unknown; heightMm?: unknown; color?: unknown };
}

/** Coerce a persisted accent band (any era) into a full config, backfilling
 *  from the default when a field is missing or the wrong type. */
function migrateAccentBand(
  raw: LegacyFeatureColorInput['topAccent'],
  body: string,
  maxHeightMm: number
): AccentBandConfig {
  const fallback = DEFAULT_FEATURE_COLOR_CONFIG.topAccent;
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, heightMm: Math.min(fallback.heightMm, maxHeightMm), color: body };
  }
  const rawHeight =
    typeof raw.heightMm === 'number' && Number.isFinite(raw.heightMm) && raw.heightMm >= 0
      ? raw.heightMm
      : fallback.heightMm;
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
    // Clamp to this design's wall-height bound so a persisted band taller than
    // the bin (saved tall, then shrunk) can't recolor the whole bin on load —
    // mirrors the UI slider cap.
    heightMm: Math.min(rawHeight, maxHeightMm),
    color: typeof raw.color === 'string' ? resolveColor(raw.color, body) : body,
  };
}

function resolveColor(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  return LEGACY_SLOT_COLORS[raw] ?? raw;
}

/** Clamp an arbitrary number to the nearest allowed lip axis count {1,2,4}. */
function clampAxisCount(n: number | undefined): LipAxisCount {
  if (n === 2) return 2;
  if (n === 4) return 4;
  return 1;
}

function isGridLip(lip: LegacyLipCorners | GridLipInput): lip is GridLipInput {
  return 'cells' in lip || 'corners' in lip || 'bands' in lip;
}

/**
 * Resolve the lip grid from any of the three eras. Always returns the full
 * 16-cell grid so callers never see a partial config.
 */
function migrateLip(raw: LegacyFeatureColorInput['lip'], body: string): FeatureColorConfig['lip'] {
  // Era 1: single hex string → uniform 1×1.
  if (typeof raw === 'string') {
    return { corners: 1, bands: 1, cells: makeUniformLipCells(resolveColor(raw, body)) };
  }
  if (raw && typeof raw === 'object') {
    // Era 3: already the grid shape → backfill missing cells from body, clamp counts.
    if (isGridLip(raw)) {
      const cells = makeUniformLipCells(body);
      if (raw.cells) {
        for (const id of LIP_CELL_ZONES) {
          if (typeof raw.cells[id] === 'string') cells[id] = raw.cells[id];
        }
      }
      return { corners: clampAxisCount(raw.corners), bands: clampAxisCount(raw.bands), cells };
    }
    // Era 2: legacy 4-corner object. The per-corner editor was rolled back to a
    // single mirrored picker, so mismatched corners were unreachable from the
    // UI; canonicalize to frontLeft → a uniform 1×1 grid (the visible look the
    // rolled-back single picker already produced; discussion).
    const fl = raw.frontLeft ?? body;
    return { corners: 1, bands: 1, cells: makeUniformLipCells(fl) };
  }
  // Missing → uniform body, 1×1.
  return { corners: 1, bands: 1, cells: makeUniformLipCells(body) };
}

/**
 * Migrate featureColors. Handles three eras of saved designs:
 * - Pre-v4.30: slot IDs like 'slot1' → mapped to hex via LEGACY_SLOT_COLORS.
 * - v4.30..pre-corner-lip: `lip` is a single hex string; all four corners inherit it.
 * - New zones (base / scoop / dividers) missing → inherit body so render is unchanged.
 *
 * `enabled` is back-filled on first load — any pre-existing design with any color
 * customization is treated as opted-in so the user's colored designs keep their look.
 */
export function migrateFeatureColors(
  raw: LegacyFeatureColorInput | undefined,
  maxTopAccentMm: number
): FeatureColorConfig {
  if (!raw) return DEFAULT_FEATURE_COLOR_CONFIG;

  const body = resolveColor(raw.body, DEFAULT_FEATURE_COLOR_CONFIG.body);
  const labelTab = resolveColor(raw.labelTab, body);

  const lip = migrateLip(raw.lip, body);

  const base = resolveColor(raw.base, body);
  const scoop = resolveColor(raw.scoop, body);
  const dividers = resolveColor(raw.dividers, body);
  // Text defaults to the label-tab color so single-color designs see no shift
  // when this field is added by migration.
  const text = resolveColor(raw.text, labelTab);
  const lid = resolveColor(raw.lid, body);
  // Backfilled from the LID colour, not from `body`: a design saved before the
  // lid had a lip grid rendered its whole lid one colour, and inheriting `body`
  // instead would visibly repaint that lid's top on first load. Emitted ONLY
  // when it actually diverges from `lid`, so a design that never touched the lid
  // lip keeps its exact params fingerprint (see `FeatureColorConfig.lidLip`).
  const lidLipRaw = raw.lidLip === undefined ? undefined : migrateLip(raw.lidLip, lid);
  const lidLip =
    lidLipRaw !== undefined &&
    LIP_CELL_ZONES.some((id) => (lidLipRaw.cells[id] ?? lid).toLowerCase() !== lid.toLowerCase())
      ? lidLipRaw
      : undefined;
  const topAccent = migrateAccentBand(raw.topAccent, body, maxTopAccentMm);
  // Emitted ONLY when the design actually carries one, so a design that never
  // touched the bottom band keeps its exact params fingerprint (see
  // `FeatureColorConfig.bottomAccent`).
  const bottomAccent =
    raw.bottomAccent === undefined
      ? undefined
      : migrateAccentBand(raw.bottomAccent, body, maxTopAccentMm);

  // Pre-`enabled` design counts as multi-color if body or any zone diverges
  // from the default — zone editors only existed behind the old Labs flag, so
  // any customized color implies multi-color intent.
  const bodyLower = body.toLowerCase();
  const isCustom = (c: string): boolean => c.toLowerCase() !== bodyLower;
  const hasCustomColor =
    bodyLower !== DEFAULT_FEATURE_COLOR_CONFIG.body.toLowerCase() ||
    [labelTab, base, scoop, dividers, text, lid].some(isCustom) ||
    LIP_CELL_ZONES.some((id) => isCustom(lip.cells[id] ?? body)) ||
    lidLip !== undefined ||
    (topAccent.enabled && isCustom(topAccent.color)) ||
    (bottomAccent?.enabled === true && isCustom(bottomAccent.color));

  return {
    enabled: raw.enabled ?? hasCustomColor,
    body,
    lip,
    labelTab,
    base,
    scoop,
    dividers,
    text,
    lid,
    // Spread so the key is absent, not `undefined` — a literal `undefined`
    // still serialises differently from an omitted key in some hashers.
    ...(lidLip ? { lidLip } : {}),
    topAccent,
    ...(bottomAccent ? { bottomAccent } : {}),
  };
}
