/** Text validation for shared bin designs: text defaults and overrides, surface captions, wall label slots, label tabs. */

import { isNumber, inRange, isString, isBoolean, isObject } from './validationUtils.js';
import { CONSTRAINTS } from './designerValidationConstants.js';

export const VALID_TEXT_FONTS = [
  'atkinson',
  'atkinson-bold',
  'jetbrains-mono',
  'jetbrains-mono-bold',
  'barlow-condensed',
  'poppins',
  'allerta-stencil',
] as const;

const VALID_TEXT_MODES = ['engrave', 'emboss', 'through-cut'] as const;

export const VALID_TEXT_ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
] as const;

const VALID_TEXT_SIZE_MODES = ['auto', 'fixed'] as const;

export const VALID_TEXT_CASES = ['as-typed', 'upper', 'title'] as const;

export const VALID_TEXT_CUT_PROFILES = ['straight', 'drafted'] as const;

const ALLOWED_TEXT_DEFAULTS_KEYS = new Set([
  'font',
  'mode',
  'depth',
  'margin',
  'minFontSize',
  'maxFontSize',
  'anchor',
  'offset',
  'sizeMode',
  'fixedSize',
  'snapToScale',
  'uniformAcrossWalls',
  'tracking',
  'autoTracking',
  'textCase',
  'lineScale',
  'lineGap',
  'cutProfile',
  'draftAngleDeg',
]);

/**
 * Caps mirror the geometry-pipeline safe ranges that ship in the next PR;
 * keeping them server-side now means a crafted share can't smuggle in a
 * `depth: -1` or `maxFontSize: 1e9` that crashes the BREP worker.
 */
export function validateTextDefaults(value: unknown, label = 'textDefaults'): string | null {
  if (!isObject(value)) return `${label} must be an object`;

  for (const key of Object.keys(value)) {
    if (!ALLOWED_TEXT_DEFAULTS_KEYS.has(key)) {
      return `${label} has unknown key: ${key}`;
    }
  }

  if (
    value.font !== undefined &&
    !VALID_TEXT_FONTS.includes(value.font as (typeof VALID_TEXT_FONTS)[number])
  ) {
    return `${label}.font must be one of: ${VALID_TEXT_FONTS.join(', ')}`;
  }
  if (
    value.mode !== undefined &&
    !VALID_TEXT_MODES.includes(value.mode as (typeof VALID_TEXT_MODES)[number])
  ) {
    return `${label}.mode must be one of: ${VALID_TEXT_MODES.join(', ')}`;
  }
  if (value.depth !== undefined && (!isNumber(value.depth) || !inRange(value.depth, 0, 10))) {
    return `${label}.depth must be 0-10`;
  }
  if (value.margin !== undefined && (!isNumber(value.margin) || !inRange(value.margin, 0, 50))) {
    return `${label}.margin must be 0-50`;
  }
  if (
    value.minFontSize !== undefined &&
    (!isNumber(value.minFontSize) || !inRange(value.minFontSize, 0.5, 100))
  ) {
    return `${label}.minFontSize must be 0.5-100`;
  }
  if (
    value.maxFontSize !== undefined &&
    (!isNumber(value.maxFontSize) || !inRange(value.maxFontSize, 0.5, 200))
  ) {
    return `${label}.maxFontSize must be 0.5-200`;
  }

  const enumErr =
    checkEnum(value, 'anchor', VALID_TEXT_ANCHORS, label) ??
    checkEnum(value, 'sizeMode', VALID_TEXT_SIZE_MODES, label) ??
    checkEnum(value, 'textCase', VALID_TEXT_CASES, label) ??
    checkEnum(value, 'cutProfile', VALID_TEXT_CUT_PROFILES, label);
  if (enumErr) return enumErr;

  for (const key of ['snapToScale', 'uniformAcrossWalls', 'autoTracking'] as const) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') {
      return `${label}.${key} must be a boolean`;
    }
  }

  // Every numeric bound exists because the value reaches the BREP worker.
  // `tracking` is in em and multiplies the font size, so an unbounded value
  // scatters glyphs across (and past) the host; `draftAngleDeg` drives a swept
  // profile that collapses on itself as it approaches 90.
  const numeric: readonly [string, number, number][] = [
    ['fixedSize', 0.5, 200],
    ['tracking', -0.5, 2],
    ['lineScale', 0.1, 2],
    ['lineGap', 0, 4],
    ['draftAngleDeg', 0, 45],
  ];
  for (const [key, min, max] of numeric) {
    const raw = value[key];
    if (raw !== undefined && (!isNumber(raw) || !inRange(raw, min, max))) {
      return `${label}.${key} must be ${min}-${max}`;
    }
  }

  if (value.offset !== undefined) {
    if (!isObject(value.offset)) return `${label}.offset must be an object`;
    for (const key of Object.keys(value.offset)) {
      if (key !== 'x' && key !== 'y') return `${label}.offset has unknown key: ${key}`;
    }
    for (const axis of ['x', 'y'] as const) {
      const raw = value.offset[axis];
      if (raw !== undefined && (!isNumber(raw) || !inRange(raw, -500, 500))) {
        return `${label}.offset.${axis} must be -500-500`;
      }
    }
  }
  return null;
}

/** Shared enum guard: the new style fields are all small closed sets. */
function checkEnum(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  label: string
): string | null {
  const raw = value[key];
  if (raw === undefined) return null;
  if (typeof raw !== 'string' || !allowed.includes(raw)) {
    return `${label}.${key} must be one of: ${allowed.join(', ')}`;
  }
  return null;
}

/**
 * Per-instance text style override (cutout labels, label tabs): the same field
 * caps as `textDefaults` plus `fontSizeOverride`, bounded so a crafted share
 * can't smuggle a size that crashes the BREP worker. `label` prefixes each
 * error with the offending path; the shared fields delegate to
 * `validateTextDefaults`, which also rejects any unknown key.
 */
export function validateTextStyleOverride(value: unknown, label: string): string | null {
  if (!isObject(value)) return `${label} must be an object`;

  const { fontSizeOverride, ...shared } = value;
  const sharedErr = validateTextDefaults(shared, label);
  if (sharedErr) return sharedErr;

  if (
    fontSizeOverride !== undefined &&
    (!isNumber(fontSizeOverride) || !inRange(fontSizeOverride, 0.5, 200))
  ) {
    return `${label}.fontSizeOverride must be 0.5-200`;
  }
  return null;
}

const ALLOWED_SURFACE_TEXT_KEYS = new Set([
  'lidText',
  'walls',
  'wallAlign',
  'style',
  'lidStyle',
  'wallStyles',
]);

/**
 * Mirrors the client `TEXT_MAX_TOTAL_LENGTH`. A caption may now hold explicit
 * line breaks, so the budget covers the whole string including separators, and
 * the client truncates to the same number rather than letting an honest
 * oversized paste come back as a 400.
 */
const SURFACE_TEXT_MAX_LENGTH = 152;

const SURFACE_TEXT_MAX_LINES = 3;

/** A caption is within budget only if BOTH its length and its line count are. */
function checkCaption(text: string, label: string): string | null {
  if (text.length > SURFACE_TEXT_MAX_LENGTH) {
    return `${label} must not exceed ${SURFACE_TEXT_MAX_LENGTH} characters`;
  }
  if (text.split('\n').length > SURFACE_TEXT_MAX_LINES) {
    return `${label} must not exceed ${SURFACE_TEXT_MAX_LINES} lines`;
  }
  return null;
}

export const VALID_WALL_TEXT_SIDES = ['front', 'back', 'left', 'right'] as const;

export const VALID_WALL_TEXT_ALIGNS = ['top', 'center', 'bottom'] as const;

/**
 * Exterior-surface text: a lid-top string plus per-wall strings
 * and a shared vertical alignment. Strings share the client's
 * `TEXT_MAX_LENGTH = 50` cap (mirrored numerically, like `compartmentTexts`);
 * the style override reuses the `textDefaults` field caps so a crafted share
 * can't smuggle a depth/size that crashes the BREP worker.
 */
export function validateSurfaceText(value: unknown): string | null {
  if (!isObject(value)) return 'surfaceText must be an object';

  for (const key of Object.keys(value)) {
    if (!ALLOWED_SURFACE_TEXT_KEYS.has(key)) {
      return `surfaceText has unknown key: ${key}`;
    }
  }

  if (value.lidText !== undefined) {
    if (typeof value.lidText !== 'string') return 'surfaceText.lidText must be a string';
    const err = checkCaption(value.lidText, 'surfaceText.lidText');
    if (err) return err;
  }
  if (value.walls !== undefined) {
    if (!isObject(value.walls)) return 'surfaceText.walls must be an object';
    for (const key of Object.keys(value.walls)) {
      if (!(VALID_WALL_TEXT_SIDES as readonly string[]).includes(key)) {
        return `surfaceText.walls has unknown key: ${key}`;
      }
      const text = value.walls[key];
      if (typeof text !== 'string') return `surfaceText.walls.${key} must be a string`;
      const err = checkCaption(text, `surfaceText.walls.${key}`);
      if (err) return err;
    }
  }
  if (
    value.wallAlign !== undefined &&
    !(VALID_WALL_TEXT_ALIGNS as readonly string[]).includes(value.wallAlign as string)
  ) {
    return `surfaceText.wallAlign must be one of: ${VALID_WALL_TEXT_ALIGNS.join(', ')}`;
  }
  if (value.style !== undefined) {
    const styleErr = validateTextStyleOverride(value.style, 'surfaceText.style');
    if (styleErr) return styleErr;
  }
  if (value.lidStyle !== undefined) {
    const styleErr = validateTextStyleOverride(value.lidStyle, 'surfaceText.lidStyle');
    if (styleErr) return styleErr;
  }
  if (value.wallStyles !== undefined) {
    if (!isObject(value.wallStyles)) return 'surfaceText.wallStyles must be an object';
    for (const key of Object.keys(value.wallStyles)) {
      if (!(VALID_WALL_TEXT_SIDES as readonly string[]).includes(key)) {
        return `surfaceText.wallStyles has unknown key: ${key}`;
      }
      const styleErr = validateTextStyleOverride(
        value.wallStyles[key],
        `surfaceText.wallStyles.${key}`
      );
      if (styleErr) return styleErr;
    }
  }
  return null;
}

const ALLOWED_WALL_LABEL_SLOTS_KEYS = new Set<string>(['enabled', 'sides', 'everyCells']);

const WALL_LABEL_SLOT_SIDES = ['front', 'back', 'left', 'right'] as const;

export function validateWallLabelSlots(value: unknown): string | null {
  if (!isObject(value)) return 'wallLabelSlots must be an object';
  for (const key of Object.keys(value)) {
    if (!ALLOWED_WALL_LABEL_SLOTS_KEYS.has(key)) return `wallLabelSlots has unknown key: ${key}`;
  }
  if (!isBoolean(value.enabled)) return 'wallLabelSlots.enabled must be boolean';
  if (!isObject(value.sides)) return 'wallLabelSlots.sides must be an object';
  for (const key of Object.keys(value.sides)) {
    if (!(WALL_LABEL_SLOT_SIDES as readonly string[]).includes(key)) {
      return `wallLabelSlots.sides has unknown key: ${key}`;
    }
  }
  for (const side of WALL_LABEL_SLOT_SIDES) {
    if (!isBoolean(value.sides[side])) return `wallLabelSlots.sides.${side} must be boolean`;
  }
  if (
    !isNumber(value.everyCells) ||
    !Number.isInteger(value.everyCells) ||
    !inRange(value.everyCells, 1, CONSTRAINTS.MAX_WALL_LABEL_SLOT_PITCH_CELLS)
  ) {
    return `wallLabelSlots.everyCells must be an integer 1-${CONSTRAINTS.MAX_WALL_LABEL_SLOT_PITCH_CELLS}`;
  }
  return null;
}

/** Mirrors the client `TEXT_MAX_LENGTH`, as `compartmentTexts` does numerically. */
export const LABEL_TEXT_MAX_LENGTH = 50;

const VALID_LABEL_TAB_SUPPORTS = ['bracket', 'solid', 'fillet'] as const;

// Mirrors `LabelTabMode` in `src/features/bin-designer/types/index.ts`.
const VALID_LABEL_TAB_MODES = ['text', 'socket'] as const;

export const VALID_LABEL_SOCKET_STYLES = ['clickIn', 'slideChannel'] as const;

export function validateLabel(label: unknown): string | null {
  if (!isObject(label)) return 'label must be an object';
  if (!isBoolean(label.enabled)) return 'label.enabled must be boolean';

  // Only validate detail fields when the feature is enabled (matches client-side logic)
  if (label.enabled) {
    if (
      !isNumber(label.depth) ||
      !inRange(label.depth, CONSTRAINTS.MIN_LABEL_TAB_DEPTH, CONSTRAINTS.MAX_LABEL_TAB_DEPTH)
    ) {
      return `label.depth must be ${CONSTRAINTS.MIN_LABEL_TAB_DEPTH}-${CONSTRAINTS.MAX_LABEL_TAB_DEPTH}`;
    }
    if (
      !isNumber(label.width) ||
      !inRange(label.width, CONSTRAINTS.MIN_LABEL_TAB_WIDTH, CONSTRAINTS.MAX_LABEL_TAB_WIDTH)
    ) {
      return `label.width must be ${CONSTRAINTS.MIN_LABEL_TAB_WIDTH}-${CONSTRAINTS.MAX_LABEL_TAB_WIDTH}`;
    }
    if (
      label.support !== undefined &&
      !VALID_LABEL_TAB_SUPPORTS.includes(label.support as (typeof VALID_LABEL_TAB_SUPPORTS)[number])
    ) {
      return `label.support must be one of: ${VALID_LABEL_TAB_SUPPORTS.join(', ')}`;
    }
    if (
      label.alignment !== undefined &&
      !['left', 'center', 'right'].includes(label.alignment as string)
    ) {
      return 'label.alignment must be "left", "center", or "right"';
    }
    // Optional field; absent = anchor shelf at the wall top (legacy behavior).
    if (label.height !== undefined) {
      if (
        !isNumber(label.height) ||
        !inRange(label.height, CONSTRAINTS.MIN_LABEL_TAB_HEIGHT, CONSTRAINTS.MAX_LABEL_TAB_HEIGHT)
      ) {
        return `label.height must be ${CONSTRAINTS.MIN_LABEL_TAB_HEIGHT}-${CONSTRAINTS.MAX_LABEL_TAB_HEIGHT}`;
      }
      // Cross-field: gusset needs at least 1mm clearance above the floor,
      // so the shelf top must sit above the tab depth. Without this guard,
      // the payload passes range checks but the builder silently drops the
      // tab — the consumer's design loses geometry with no error signal.
      if (isNumber(label.depth) && label.height <= label.depth) {
        return 'label.height must be greater than label.depth';
      }
    }
    // Optional field; absent = back-edge anchor (legacy).
    if (label.edges !== undefined && !['back', 'front', 'both'].includes(label.edges as string)) {
      return 'label.edges must be "back", "front", or "both"';
    }
    // Optional field; absent = per-compartment tabs (legacy).
    if (label.span !== undefined && !isBoolean(label.span)) {
      return 'label.span must be boolean';
    }
    // Row captions for full-width tabs. Bounded like `compartmentTexts` so a
    // direct HTTP POST can't smuggle an unbounded array past the UI.
    if (label.rowTexts !== undefined) {
      if (!Array.isArray(label.rowTexts)) {
        return 'label.rowTexts must be an array';
      }
      if (label.rowTexts.length > CONSTRAINTS.MAX_COMPARTMENT_GRID) {
        return `label.rowTexts length must not exceed ${CONSTRAINTS.MAX_COMPARTMENT_GRID}`;
      }
      for (let i = 0; i < label.rowTexts.length; i++) {
        const t = label.rowTexts[i] as unknown;
        if (!isString(t)) {
          return `label.rowTexts[${i}] must be a string`;
        }
        if (t.length > LABEL_TEXT_MAX_LENGTH) {
          return `label.rowTexts[${i}] must not exceed ${LABEL_TEXT_MAX_LENGTH} characters`;
        }
      }
    }
    // Optional field; absent = 0 (tab abuts anchor wall).
    if (label.inset !== undefined) {
      if (
        !isNumber(label.inset) ||
        !inRange(label.inset, CONSTRAINTS.MIN_LABEL_TAB_INSET, CONSTRAINTS.MAX_LABEL_TAB_INSET)
      ) {
        return `label.inset must be ${CONSTRAINTS.MIN_LABEL_TAB_INSET}-${CONSTRAINTS.MAX_LABEL_TAB_INSET}`;
      }
    }
    if (label.textStyle !== undefined) {
      const styleErr = validateTextStyleOverride(label.textStyle, 'label.textStyle');
      if (styleErr) return styleErr;
    }
    // Optional swappable-label mode; absent = 'text' (legacy).
    if (
      label.mode !== undefined &&
      !VALID_LABEL_TAB_MODES.includes(label.mode as (typeof VALID_LABEL_TAB_MODES)[number])
    ) {
      return `label.mode must be one of: ${VALID_LABEL_TAB_MODES.join(', ')}`;
    }
    // Optional socket profile; absent = 'clickIn'.
    if (
      label.socketStyle !== undefined &&
      !VALID_LABEL_SOCKET_STYLES.includes(
        label.socketStyle as (typeof VALID_LABEL_SOCKET_STYLES)[number]
      )
    ) {
      return `label.socketStyle must be one of: ${VALID_LABEL_SOCKET_STYLES.join(', ')}`;
    }
    // Cross-field: socket-mode tabs must be deep enough to host the pocket.
    // Without this a crafted payload passes the generic depth range but the
    // builder silently drops every socket.
    if (
      label.mode === 'socket' &&
      isNumber(label.depth) &&
      label.depth < CONSTRAINTS.MIN_LABEL_SOCKET_TAB_DEPTH
    ) {
      return `label.depth must be at least ${CONSTRAINTS.MIN_LABEL_SOCKET_TAB_DEPTH} when label.mode is "socket"`;
    }
    // Optional signed fit offset for socket clearance calibration.
    if (label.plateFitOffset !== undefined) {
      if (
        !isNumber(label.plateFitOffset) ||
        !inRange(
          label.plateFitOffset,
          CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN,
          CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MAX
        )
      ) {
        return `label.plateFitOffset must be ${CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN}-${CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MAX}`;
      }
    }
  }
  return null;
}
