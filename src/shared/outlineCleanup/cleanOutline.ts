import { MAX_PATH_POINTS, MIN_PATH_POINTS, type PathPoint } from '@/shared/types/bin';
import { flattenPath } from '@/shared/utils/pathGeometryBezier';
import { closeRegion, type ClosedRegion } from './closeRegion';
import {
  mirrorAxis,
  mirrorRegion,
  type MirrorAxisKind,
  type MirrorKeep,
  type Region,
} from './mirror';
import { fitRing, type Pt } from './runs';

export interface MirrorSetting {
  readonly axis: MirrorAxisKind;
  readonly keep: MirrorKeep;
}

export interface CleanupSettings {
  /** How far, in mm, the outline may stray from the original to lose detail; 0 keeps it all. */
  readonly simplify: number;
  /** Fit curves with handles rather than straight segments. */
  readonly curves: boolean;
  /** Square nearly square straight edges to the axes. */
  readonly straighten: boolean;
  readonly mirror: MirrorSetting | null;
  /** Radius, in mm, every inside corner is rounded to; 0 leaves them. */
  readonly roundInside: number;
}

export const NO_CLEANUP: CleanupSettings = {
  simplify: 0,
  curves: false,
  straighten: false,
  mirror: null,
  roundInside: 0,
};

export const isNoCleanup = (s: CleanupSettings): boolean =>
  s.simplify === 0 && !s.curves && !s.straighten && s.mirror === null && s.roundInside === 0;

export interface CleanedOutline {
  readonly path: PathPoint[];
  readonly holes: PathPoint[][];
}

/** Finest fit, in mm, once any step has reshaped the outline. */
const FLOOR_MM = 0.02;
/** Each retry for a ring over the point limit loosens the fit by this much. */
const LOOSEN = 1.5;
const MAX_LOOSENINGS = 12;

function fitWithin(
  ring: readonly Pt[],
  tolerance: number,
  settings: CleanupSettings,
  axisAngle: number
): PathPoint[] | null {
  let t = tolerance;
  for (let i = 0; i <= MAX_LOOSENINGS; i++) {
    const path = fitRing(ring, {
      tolerance: t,
      curves: settings.curves,
      axisAngle: settings.straighten ? axisAngle : null,
      window: Math.max(1, 3 * t),
    });
    if (path.length <= MAX_PATH_POINTS) return path.length >= MIN_PATH_POINTS ? path : null;
    t *= LOOSEN;
  }
  return null;
}

/** Each rounding already made, keyed by every setting that shaped what it rounded. */
export type RoundingCache = Map<string, ClosedRegion | null>;

/** Flattening step for a fitted outline about to be rounded, in mm. */
const ROUNDING_STEP_MM = 0.05;

function fitRegion(
  region: Region,
  tolerance: number,
  settings: CleanupSettings,
  axisAngle: number
): CleanedOutline | null {
  const path = fitWithin(region.outline, tolerance, settings, axisAngle);
  if (!path) return null;
  const holes = region.holes
    .map((hole) => fitWithin(hole, tolerance, settings, axisAngle))
    .filter((hole): hole is PathPoint[] => hole !== null);
  return { path, holes };
}

/**
 * `region` cleaned up: mirrored, then each ring fitted corner to corner as
 * straight segments or curves, square edges squared to axes at `axisAngle`,
 * and last its inside corners rounded and the result fitted again. Rounding
 * comes after the fit so it rounds the outline's real corners, not every dip
 * in a traced edge's noise. Every step starts from the rings it is given, so
 * a caller that keeps the original and re-runs on each change never
 * compounds one fit on another. Null when the steps leave no pocket.
 *
 * `rounded` keeps the roundings already made of this one `region`, for a
 * caller re-running on every step of a slider: the raster close is slow.
 */
export function cleanOutline(
  region: Region,
  settings: CleanupSettings,
  axisAngle = 0,
  rounded?: RoundingCache
): CleanedOutline | null {
  let current = region;
  if (settings.mirror) {
    const axis = mirrorAxis(current.outline, settings.mirror.axis);
    const mirrored = mirrorRegion(current, axis, settings.mirror.keep);
    if (!mirrored) return null;
    current = mirrored;
  }
  const fitted = fitRegion(current, Math.max(settings.simplify, FLOOR_MM), settings, axisAngle);
  if (!fitted || settings.roundInside <= 0) return fitted;

  const key = JSON.stringify({ ...settings, axisAngle });
  let closed = rounded?.get(key);
  if (closed === undefined) {
    const dense = {
      outline: flattenPath(fitted.path, ROUNDING_STEP_MM),
      holes: fitted.holes.map((hole) => flattenPath(hole, ROUNDING_STEP_MM)),
    };
    closed = closeRegion(dense, settings.roundInside);
    rounded?.set(key, closed);
  }
  if (!closed) return null;
  return fitRegion(closed.region, Math.max(settings.simplify, closed.pixel), settings, axisAngle);
}
