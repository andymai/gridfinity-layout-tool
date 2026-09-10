/** Feature-colour validation for shared bin designs: hex colours, lip grid, accent band. */

import { isNumber, inRange, isString, isBoolean, isObject } from './validationUtils.js';

// 3- or 6-digit CSS hex, plus the legacy slot IDs we migrate client-side.
// Anything else is rejected before it lands in the blob.
export const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const LEGACY_SLOT_IDS = new Set(['slot1', 'slot2', 'slot3', 'slot4']);

function isValidColor(v: unknown): boolean {
  if (!isString(v)) return false;
  return HEX_COLOR_REGEX.test(v) || LEGACY_SLOT_IDS.has(v);
}

export const LIP_CORNERS = ['frontLeft', 'frontRight', 'backRight', 'backLeft'] as const;

const ALLOWED_FEATURE_COLOR_KEYS = new Set([
  'enabled',
  'body',
  'lip',
  'labelTab',
  'base',
  'scoop',
  'dividers',
  'text',
  'lid',
  'lidLip',
  'topAccent',
  'bottomAccent',
]);

const ALLOWED_ACCENT_BAND_KEYS = new Set<string>(['enabled', 'heightMm', 'color']);

/** Generous upper bound (mm) — the client clamps to wall height; this only
 *  rejects absurd values a crafted share could smuggle past the size cap. */
const MAX_ACCENT_BAND_HEIGHT_MM = 1000;

const ALLOWED_LIP_CORNER_KEYS = new Set<string>(LIP_CORNERS);

const ALLOWED_LIP_GRID_KEYS = new Set<string>(['corners', 'bands', 'cells']);

export const VALID_LIP_AXIS_COUNTS = new Set<number>([1, 2, 4]);

const LIP_CELL_KEY_RE = /^lip:(frontLeft|frontRight|backRight|backLeft):[0-3]$/;

/**
 * Validate a quadrant×band lip grid shape `{ corners, bands, cells }`.
 * `cells` maps `lip:<corner>:<band>` ids to hex colors.
 *
 * `path` names the field under validation because both the bin lip and the
 * lid's own top lip store this shape — and `lidLip.cells` is keyed by the same
 * `lip:...` ids, so the two are structurally identical.
 */
function validateLipGrid(lip: Record<string, unknown>, path: string): string | null {
  for (const key of Object.keys(lip)) {
    if (!ALLOWED_LIP_GRID_KEYS.has(key)) return `${path} has unknown key: ${key}`;
  }
  for (const axis of ['corners', 'bands'] as const) {
    const v = lip[axis];
    if (v !== undefined && (!isNumber(v) || !VALID_LIP_AXIS_COUNTS.has(v))) {
      return `${path}.${axis} must be 1, 2, or 4`;
    }
  }
  const cells = lip.cells;
  if (cells !== undefined) {
    if (!isObject(cells)) return `${path}.cells must be an object`;
    for (const [id, color] of Object.entries(cells)) {
      if (!LIP_CELL_KEY_RE.test(id)) return `${path}.cells has unknown cell: ${id}`;
      if (!isValidColor(color)) return `${path}.cells.${id} must be a hex color`;
    }
  }
  return null;
}

/** Validate one accent band `{ enabled, heightMm, color }`. `path` names the
 *  field so the top and bottom bands report against themselves. */
function validateAccentBand(value: unknown, path: string): string | null {
  if (!isObject(value)) return `${path} must be an object`;
  for (const key of Object.keys(value)) {
    if (!ALLOWED_ACCENT_BAND_KEYS.has(key)) {
      return `${path} has unknown key: ${key}`;
    }
  }
  if (value.enabled !== undefined && !isBoolean(value.enabled)) {
    return `${path}.enabled must be boolean`;
  }
  if (
    value.heightMm !== undefined &&
    (!isNumber(value.heightMm) || !inRange(value.heightMm, 0, MAX_ACCENT_BAND_HEIGHT_MM))
  ) {
    return `${path}.heightMm must be 0-${MAX_ACCENT_BAND_HEIGHT_MM}`;
  }
  if (value.color !== undefined && !isValidColor(value.color)) {
    return `${path}.color must be a hex color`;
  }
  return null;
}

/**
 * Accepts three lip shapes so older and newer clients both sync: the legacy
 * `lip: string`, the legacy 4-corner object, or the current quadrant×band
 * grid `{ corners, bands, cells }`. Rejects unknown keys at every level so a
 * crafted share can't smuggle attacker-controlled junk past the size cap.
 */
export function validateFeatureColors(value: unknown): string | null {
  if (!isObject(value)) return 'featureColors must be an object';

  for (const key of Object.keys(value)) {
    if (!ALLOWED_FEATURE_COLOR_KEYS.has(key)) {
      return `featureColors has unknown key: ${key}`;
    }
  }

  if (value.enabled !== undefined && !isBoolean(value.enabled)) {
    return 'featureColors.enabled must be boolean';
  }

  for (const key of ['body', 'labelTab', 'base', 'scoop', 'dividers', 'text', 'lid'] as const) {
    if (value[key] !== undefined && !isValidColor(value[key])) {
      return `featureColors.${key} must be a hex color`;
    }
  }

  const lip = value.lip;
  if (lip !== undefined) {
    if (isString(lip)) {
      if (!isValidColor(lip)) return 'featureColors.lip must be a hex color';
    } else if (isObject(lip)) {
      // New grid shape if it carries any grid key; otherwise legacy 4-corner.
      const isGrid = 'corners' in lip || 'bands' in lip || 'cells' in lip;
      if (isGrid) {
        const err = validateLipGrid(lip, 'featureColors.lip');
        if (err) return err;
      } else {
        for (const key of Object.keys(lip)) {
          if (!ALLOWED_LIP_CORNER_KEYS.has(key)) {
            return `featureColors.lip has unknown corner: ${key}`;
          }
        }
        for (const corner of LIP_CORNERS) {
          if (lip[corner] !== undefined && !isValidColor(lip[corner])) {
            return `featureColors.lip.${corner} must be a hex color`;
          }
        }
      }
    } else {
      return 'featureColors.lip must be a hex color, 4-corner object, or grid';
    }
  }

  // The lid's own top lip carries the SAME grid shape as the bin lip and only
  // ever the grid shape — it postdates both legacy lip forms, so no string or
  // 4-corner fallback applies here.
  if (value.lidLip !== undefined) {
    if (!isObject(value.lidLip)) return 'featureColors.lidLip must be a grid';
    const err = validateLipGrid(value.lidLip, 'featureColors.lidLip');
    if (err) return err;
  }

  for (const key of ['topAccent', 'bottomAccent'] as const) {
    if (value[key] !== undefined) {
      const err = validateAccentBand(value[key], `featureColors.${key}`);
      if (err) return err;
    }
  }

  return null;
}
