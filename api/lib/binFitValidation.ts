/**
 * Per-bin drawer-fit fields a layout bin may carry: extra clearance above it,
 * the opt-in into the baseplate margin, the margin taper, and an explicit
 * Expand-to-Fit overhang. Each is kept when well-formed and dropped alone when
 * not, so one malformed value never costs the bin or the layout.
 */
import { isBoolean, isNumber, isObject, inRange } from './validationUtils.js';

/** Mirror `DESIGNER_CONSTRAINTS` and `WallTaperProfile` on the client; pinned by the cross-boundary test. */
export const BIN_OVERHANG_MM_MAX = 42;
export const TAPER_FLARE_MM_MAX = 42;
export const TAPER_BAND_MM_MAX = 350;
export const TAPER_PROFILES = ['chamfer', 'fillet'] as const;

type TaperProfile = (typeof TAPER_PROFILES)[number];

export interface MarginTaperShape {
  profile: TaperProfile;
  bandHeight: number;
  enabled?: boolean;
  flare?: number;
}

export interface WallTaperShape {
  enabled?: boolean;
  profile: TaperProfile;
  bandHeight: number;
  left: number;
  right: number;
  front: number;
  back: number;
}

export interface BinOverhangShape {
  enabled?: boolean;
  left: number;
  right: number;
  front: number;
  back: number;
  feet?: boolean;
  taper?: WallTaperShape;
}

export interface BinFitFields {
  clearanceHeight?: number;
  extendToMargin?: boolean;
  marginTaper?: MarginTaperShape;
  overhang?: BinOverhangShape;
}

function isTaperProfile(value: unknown): value is TaperProfile {
  return TAPER_PROFILES.some((profile) => profile === value);
}

function mmWithin(value: unknown, max: number): number | undefined {
  return isNumber(value) && inRange(value, 0, max) ? value : undefined;
}

function sanitizeMarginTaper(value: unknown): MarginTaperShape | undefined {
  if (!isObject(value) || !isTaperProfile(value.profile)) return undefined;
  const bandHeight = mmWithin(value.bandHeight, TAPER_BAND_MM_MAX);
  if (bandHeight === undefined) return undefined;
  const flare = mmWithin(value.flare, TAPER_FLARE_MM_MAX);
  return {
    profile: value.profile,
    bandHeight,
    ...(isBoolean(value.enabled) ? { enabled: value.enabled } : {}),
    ...(flare === undefined ? {} : { flare }),
  };
}

type Sides = Pick<BinOverhangShape, 'left' | 'right' | 'front' | 'back'>;

function sides(value: Record<string, unknown>, max: number): Sides | undefined {
  const left = mmWithin(value.left, max);
  const right = mmWithin(value.right, max);
  const front = mmWithin(value.front, max);
  const back = mmWithin(value.back, max);
  if (left === undefined || right === undefined || front === undefined || back === undefined) {
    return undefined;
  }
  return { left, right, front, back };
}

function sanitizeWallTaper(value: unknown): WallTaperShape | undefined {
  if (!isObject(value) || !isTaperProfile(value.profile)) return undefined;
  const bandHeight = mmWithin(value.bandHeight, TAPER_BAND_MM_MAX);
  const taperSides = sides(value, TAPER_FLARE_MM_MAX);
  if (bandHeight === undefined || !taperSides) return undefined;
  return {
    ...(isBoolean(value.enabled) ? { enabled: value.enabled } : {}),
    profile: value.profile,
    bandHeight,
    ...taperSides,
  };
}

/** A stored side is the rim: the base overhang plus that side's flare, each up to its own ceiling. */
function rimSides(
  value: Record<string, unknown>,
  taper: WallTaperShape | undefined
): Sides | undefined {
  const side = (name: keyof Sides): number | undefined =>
    mmWithin(value[name], BIN_OVERHANG_MM_MAX + (taper?.[name] ?? 0));
  const left = side('left');
  const right = side('right');
  const front = side('front');
  const back = side('back');
  if (left === undefined || right === undefined || front === undefined || back === undefined) {
    return undefined;
  }
  return { left, right, front, back };
}

function sanitizeOverhang(value: unknown): BinOverhangShape | undefined {
  if (!isObject(value)) return undefined;
  const taper = sanitizeWallTaper(value.taper);
  const overhangSides = rimSides(value, taper);
  if (!overhangSides) return undefined;
  return {
    ...(isBoolean(value.enabled) ? { enabled: value.enabled } : {}),
    ...overhangSides,
    ...(isBoolean(value.feet) ? { feet: value.feet } : {}),
    ...(taper ? { taper } : {}),
  };
}

export function sanitizeBinFitFields(value: unknown): BinFitFields {
  if (!isObject(value)) return {};
  const bin = value;
  const marginTaper = sanitizeMarginTaper(bin.marginTaper);
  const overhang = sanitizeOverhang(bin.overhang);
  return {
    ...(isNumber(bin.clearanceHeight) && bin.clearanceHeight >= 0
      ? { clearanceHeight: bin.clearanceHeight }
      : {}),
    ...(isBoolean(bin.extendToMargin) ? { extendToMargin: bin.extendToMargin } : {}),
    ...(marginTaper ? { marginTaper } : {}),
    ...(overhang ? { overhang } : {}),
  };
}

export function withSanitizedOverhang(params: Record<string, unknown>): Record<string, unknown> {
  const { overhang, ...rest } = params;
  const clean = sanitizeOverhang(overhang);
  return clean ? { ...rest, overhang: clean } : rest;
}
