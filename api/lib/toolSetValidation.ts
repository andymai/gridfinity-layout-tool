/**
 * The recipe of each tool set in a design (`cutoutToolSets`). Editor metadata
 * the generator never reads, but a crafted payload can carry any keys it
 * likes, so both the map and each spec are bounded.
 */
import { isNumber, isObject, isString } from './validationUtils.js';

// eslint-disable-next-line no-control-regex -- reject control chars in user-supplied keys and sizes
const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F]/;

/** MIRROR: `TOOL_FAMILY_IDS`, `TOOL_UNITS`, `TOOL_SET_STYLES` and `TOOL_SET_LIMITS` in `src/features/bin-designer/types/toolSet.ts`. */
export const TOOL_SET_CONSTRAINTS = {
  FAMILIES: ['combinationWrench'],
  UNITS: ['metric', 'sae'],
  STYLES: ['flat'],
  MAX_SIZES: 30,
  MAX_SIZE_KEY_LENGTH: 12,
  MIN_CLEARANCE_MM: 0,
  MAX_CLEARANCE_MM: 2,
  MIN_LABEL_MM: 0,
  MAX_LABEL_MM: 12,
  /** MIRROR: `MAX_CUTOUT_TOOL_SETS` in `src/features/bin-designer/constants/paramMigrationToolSets.ts`. */
  MAX_SETS: 1000,
  MAX_ID_LENGTH: 64,
} as const;

const SPEC_KEYS = new Set([
  'family',
  'units',
  'sizes',
  'style',
  'clearanceMm',
  'labelSizeMm',
  'fingerChannel',
]);

function inList(list: readonly string[], value: unknown): boolean {
  return isString(value) && list.includes(value);
}

function specError(id: string, spec: unknown): string | null {
  const at = `cutoutToolSets.${id}`;
  if (!isObject(spec)) return `${at} must be an object`;
  for (const key of Object.keys(spec)) {
    if (!SPEC_KEYS.has(key)) return `${at}.${key} is not a known field`;
  }
  const c = TOOL_SET_CONSTRAINTS;
  if (!inList(c.FAMILIES, spec.family)) return `${at}.family is not a known tool family`;
  if (!inList(c.UNITS, spec.units)) return `${at}.units must be one of ${c.UNITS.join(', ')}`;
  if (!inList(c.STYLES, spec.style)) return `${at}.style must be one of ${c.STYLES.join(', ')}`;
  const sizes = spec.sizes;
  if (!Array.isArray(sizes) || sizes.length === 0 || sizes.length > c.MAX_SIZES) {
    return `${at}.sizes must be a list of 1 to ${c.MAX_SIZES} sizes`;
  }
  for (const size of sizes) {
    if (
      !isString(size) ||
      size === '' ||
      size.length > c.MAX_SIZE_KEY_LENGTH ||
      CONTROL_CHARS_REGEX.test(size)
    ) {
      return `${at}.sizes must hold clean strings (max ${c.MAX_SIZE_KEY_LENGTH} chars)`;
    }
  }
  const clearance = spec.clearanceMm;
  if (!isNumber(clearance) || clearance < c.MIN_CLEARANCE_MM || clearance > c.MAX_CLEARANCE_MM) {
    return `${at}.clearanceMm must be ${c.MIN_CLEARANCE_MM} to ${c.MAX_CLEARANCE_MM}`;
  }
  const label = spec.labelSizeMm;
  if (!isNumber(label) || label < c.MIN_LABEL_MM || label > c.MAX_LABEL_MM) {
    return `${at}.labelSizeMm must be ${c.MIN_LABEL_MM} to ${c.MAX_LABEL_MM}`;
  }
  if (spec.fingerChannel !== undefined && typeof spec.fingerChannel !== 'boolean') {
    return `${at}.fingerChannel must be a boolean`;
  }
  return null;
}

export function validateCutoutToolSets(value: unknown): string | null {
  if (value === undefined) return null;
  if (!isObject(value)) return 'cutoutToolSets must be an object';
  const entries = Object.entries(value);
  if (entries.length > TOOL_SET_CONSTRAINTS.MAX_SETS) {
    return `cutoutToolSets must have at most ${TOOL_SET_CONSTRAINTS.MAX_SETS} entries`;
  }
  for (const [id, spec] of entries) {
    if (
      id === '' ||
      id.length > TOOL_SET_CONSTRAINTS.MAX_ID_LENGTH ||
      CONTROL_CHARS_REGEX.test(id)
    ) {
      return `cutoutToolSets keys must be clean strings (max ${TOOL_SET_CONSTRAINTS.MAX_ID_LENGTH} chars)`;
    }
    const err = specError(id, spec);
    if (err) return err;
  }
  return null;
}
