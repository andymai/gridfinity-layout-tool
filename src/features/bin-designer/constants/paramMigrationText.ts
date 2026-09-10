/** Migration of persisted text: style overrides, surface text, wall label slots. */

import type { WallLabelSlotsConfig } from '../types';
import type {
  SurfaceTextConfig,
  TextFontFamily,
  TextMode,
  TextStyleOverride,
  WallTextSide,
  WallTextVerticalAlign,
} from '../types/text';
import {
  TEXT_ANCHORS,
  TEXT_CASES,
  TEXT_CUT_PROFILES,
  TEXT_FONT_FAMILIES,
  WALL_ALIGN_TO_ANCHOR,
  normalizeTextInput,
  WALL_TEXT_ALIGNS,
  WALL_TEXT_SIDES,
} from '../types/text';
import { isDefaultWallLabelSlots } from '@/shared/utils/wallLabelSlotPlan';
import { MAX_WALL_LABEL_SLOT_PITCH_CELLS } from '../types/walls';
import { clampNumber, isObj } from './paramMigrationHelpers';

/**
 * Normalize a persisted `surfaceText` value. Clamps the string to
 * `TEXT_MAX_LENGTH` and collapses empty/junk objects to `undefined` so
 * pre-feature designs (and designs whose text was cleared) serialize
 * byte-identically to before the field existed. The style override passes
 * through shape-checked only — field ranges are the share/sync validator's
 * job, matching how `label.textStyle` is handled.
 */
const MIGRATE_TEXT_FONTS: readonly TextFontFamily[] = TEXT_FONT_FAMILIES;

const MIGRATE_TEXT_MODES: readonly TextMode[] = ['engrave', 'emboss', 'through-cut'];

function migrateTextStyleOverride(raw: unknown): TextStyleOverride | undefined {
  if (!isObj(raw)) return undefined;
  const value = raw;
  const num = (v: unknown, min: number, max: number): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  const depth = num(value.depth, 0, 10);
  const margin = num(value.margin, 0, 50);
  const minFontSize = num(value.minFontSize, 0.5, 100);
  const maxFontSize = num(value.maxFontSize, 0.5, 200);
  const fontSizeOverride = num(value.fontSizeOverride, 0.5, 200);
  const enumField = <T extends string>(raw: unknown, allowed: readonly T[]): T | undefined =>
    allowed.includes(raw as T) ? (raw as T) : undefined;
  const boolField = (raw: unknown): boolean | undefined =>
    typeof raw === 'boolean' ? raw : undefined;

  const anchor = enumField(value.anchor, TEXT_ANCHORS);
  const sizeMode = enumField(value.sizeMode, ['auto', 'fixed'] as const);
  const textCase = enumField(value.textCase, TEXT_CASES);
  const cutProfile = enumField(value.cutProfile, TEXT_CUT_PROFILES);
  const fixedSize = num(value.fixedSize, 0.5, 200);
  const tracking = num(value.tracking, -0.5, 2);
  const lineScale = num(value.lineScale, 0.1, 2);
  const lineGap = num(value.lineGap, 0, 4);
  const draftAngleDeg = num(value.draftAngleDeg, 0, 45);
  const snapToScale = boolField(value.snapToScale);
  const uniformAcrossWalls = boolField(value.uniformAcrossWalls);
  const autoTracking = boolField(value.autoTracking);
  // An offset only survives with BOTH axes finite: a half-migrated `{x: 3}`
  // would leave `offset.y` undefined and NaN out every baseline it touches.
  const offsetX = isObj(value.offset) ? num(value.offset.x, -500, 500) : undefined;
  const offsetY = isObj(value.offset) ? num(value.offset.y, -500, 500) : undefined;
  const offset =
    offsetX !== undefined && offsetY !== undefined ? { x: offsetX, y: offsetY } : undefined;

  const out: TextStyleOverride = {
    ...(MIGRATE_TEXT_FONTS.includes(value.font as TextFontFamily)
      ? { font: value.font as TextFontFamily }
      : {}),
    ...(MIGRATE_TEXT_MODES.includes(value.mode as TextMode)
      ? { mode: value.mode as TextMode }
      : {}),
    ...(depth !== undefined ? { depth } : {}),
    ...(margin !== undefined ? { margin } : {}),
    ...(minFontSize !== undefined ? { minFontSize } : {}),
    ...(maxFontSize !== undefined ? { maxFontSize } : {}),
    ...(fontSizeOverride !== undefined ? { fontSizeOverride } : {}),
    ...(anchor !== undefined ? { anchor } : {}),
    ...(offset !== undefined ? { offset } : {}),
    ...(sizeMode !== undefined ? { sizeMode } : {}),
    ...(fixedSize !== undefined ? { fixedSize } : {}),
    ...(snapToScale !== undefined ? { snapToScale } : {}),
    ...(uniformAcrossWalls !== undefined ? { uniformAcrossWalls } : {}),
    ...(tracking !== undefined ? { tracking } : {}),
    ...(autoTracking !== undefined ? { autoTracking } : {}),
    ...(textCase !== undefined ? { textCase } : {}),
    ...(lineScale !== undefined ? { lineScale } : {}),
    ...(lineGap !== undefined ? { lineGap } : {}),
    ...(cutProfile !== undefined ? { cutProfile } : {}),
    ...(draftAngleDeg !== undefined ? { draftAngleDeg } : {}),
  };
  return Object.keys(out).length > 0 ? out : undefined;
}

export function migrateSurfaceText(raw: unknown): SurfaceTextConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const { lidText, walls, wallAlign, style, lidStyle, wallStyles } = raw as {
    lidText?: unknown;
    walls?: unknown;
    wallAlign?: unknown;
    style?: unknown;
    lidStyle?: unknown;
    wallStyles?: unknown;
  };
  // Trimmed on write (store setters) — trim again here so the worker (which
  // trims before generating) and persisted state can't disagree.
  const text = typeof lidText === 'string' ? normalizeTextInput(lidText).trim() : undefined;
  const hasText = text !== undefined && text !== '';

  // Per-wall strings: keep only known sides with non-empty values, clamped
  // and trimmed like the lid text.
  const migratedWalls: Partial<Record<WallTextSide, string>> = {};
  if (typeof walls === 'object' && walls !== null) {
    for (const side of WALL_TEXT_SIDES) {
      const value = (walls as Record<string, unknown>)[side];
      if (typeof value === 'string' && value.trim() !== '') {
        migratedWalls[side] = normalizeTextInput(value).trim();
      }
    }
  }
  const hasWalls = Object.keys(migratedWalls).length > 0;

  // The legacy one-knob alignment folds into the style's anchor and the key is
  // dropped. Horizontal was always centred back then, so the three values map
  // exactly onto three of the nine anchors and nothing about an existing design
  // moves. An anchor already on the style wins: it can only have been written
  // by the newer control, which supersedes the knob.
  // Only where wall text survives: the knob was meaningless without it, so a
  // design that had none must still collapse to absent rather than gaining a
  // style key it never had.
  const legacyAnchor =
    hasWalls &&
    typeof wallAlign === 'string' &&
    (WALL_TEXT_ALIGNS as readonly string[]).includes(wallAlign)
      ? WALL_ALIGN_TO_ANCHOR[wallAlign as WallTextVerticalAlign]
      : undefined;

  const baseStyle = migrateTextStyleOverride(style);
  const migratedStyle =
    legacyAnchor !== undefined && legacyAnchor !== 'center' && baseStyle?.anchor === undefined
      ? { ...baseStyle, anchor: legacyAnchor }
      : baseStyle;

  const migratedLidStyle = migrateTextStyleOverride(lidStyle);
  const migratedWallStyles: Partial<Record<WallTextSide, TextStyleOverride>> = {};
  if (isObj(wallStyles)) {
    for (const side of WALL_TEXT_SIDES) {
      const migrated = migrateTextStyleOverride(wallStyles[side]);
      if (migrated !== undefined) migratedWallStyles[side] = migrated;
    }
  }
  const hasWallStyles = Object.keys(migratedWallStyles).length > 0;

  if (
    !hasText &&
    !hasWalls &&
    migratedStyle === undefined &&
    migratedLidStyle === undefined &&
    !hasWallStyles
  ) {
    return undefined;
  }
  return {
    ...(hasText ? { lidText: text } : {}),
    ...(hasWalls ? { walls: migratedWalls } : {}),
    ...(migratedStyle !== undefined ? { style: migratedStyle } : {}),
    ...(migratedLidStyle !== undefined ? { lidStyle: migratedLidStyle } : {}),
    ...(hasWallStyles ? { wallStyles: migratedWallStyles } : {}),
  };
}

/**
 * Normalize persisted `wallLabelSlots`. An invalid shape drops to `undefined`,
 * and so does the default: a design that switched the slots on and off again
 * must fingerprint like one that never did.
 */
export function migrateWallLabelSlots(raw: unknown): WallLabelSlotsConfig | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = raw as Record<string, unknown>;
  if (typeof value.enabled !== 'boolean') return undefined;
  const rawSides =
    typeof value.sides === 'object' && value.sides !== null
      ? (value.sides as Record<string, unknown>)
      : {};
  const config: WallLabelSlotsConfig = {
    enabled: value.enabled,
    sides: {
      front: rawSides.front === true,
      back: rawSides.back === true,
      left: rawSides.left === true,
      right: rawSides.right === true,
    },
    everyCells: Math.round(clampNumber(value.everyCells, 1, MAX_WALL_LABEL_SLOT_PITCH_CELLS, 1)),
  };
  return isDefaultWallLabelSlots(config) ? undefined : config;
}
