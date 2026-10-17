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

export interface BinOverhangShape {
  enabled?: boolean;
  left: number;
  right: number;
  front: number;
  back: number;
  feet?: boolean;
}

export interface BinFitFields {
  clearanceHeight?: number;
  extendToMargin?: true;
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

function sanitizeOverhang(value: unknown): BinOverhangShape | undefined {
  if (!isObject(value)) return undefined;
  const left = mmWithin(value.left, BIN_OVERHANG_MM_MAX);
  const right = mmWithin(value.right, BIN_OVERHANG_MM_MAX);
  const front = mmWithin(value.front, BIN_OVERHANG_MM_MAX);
  const back = mmWithin(value.back, BIN_OVERHANG_MM_MAX);
  if (left === undefined || right === undefined || front === undefined || back === undefined) {
    return undefined;
  }
  return {
    ...(isBoolean(value.enabled) ? { enabled: value.enabled } : {}),
    left,
    right,
    front,
    back,
    ...(isBoolean(value.feet) ? { feet: value.feet } : {}),
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
    ...(bin.extendToMargin === true ? { extendToMargin: true as const } : {}),
    ...(marginTaper ? { marginTaper } : {}),
    ...(overhang ? { overhang } : {}),
  };
}
