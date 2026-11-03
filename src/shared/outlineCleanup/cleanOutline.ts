import { MAX_PATH_POINTS, MIN_PATH_POINTS, type PathPoint } from '@/shared/types/bin';
import { closeRegion } from './closeRegion';
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

/**
 * `region` cleaned up: inside corners rounded, mirrored, then each ring fitted
 * corner to corner as straight segments or curves, square edges squared to
 * axes at `axisAngle`. Every step works from the dense rings it is given, so a
 * caller that keeps the original and re-runs on each change never compounds
 * one fit on another. Null when the steps leave no pocket.
 */
export function cleanOutline(
  region: Region,
  settings: CleanupSettings,
  axisAngle = 0
): CleanedOutline | null {
  let current = region;
  let floor = FLOOR_MM;
  if (settings.roundInside > 0) {
    const closed = closeRegion(current, settings.roundInside);
    if (!closed) return null;
    current = closed.region;
    floor = Math.max(floor, closed.pixel);
  }
  if (settings.mirror) {
    const axis = mirrorAxis(current.outline, settings.mirror.axis);
    const mirrored = mirrorRegion(current, axis, settings.mirror.keep);
    if (!mirrored) return null;
    current = mirrored;
  }
  const tolerance = Math.max(settings.simplify, floor);
  const path = fitWithin(current.outline, tolerance, settings, axisAngle);
  if (!path) return null;
  const holes = current.holes
    .map((hole) => fitWithin(hole, tolerance, settings, axisAngle))
    .filter((hole): hole is PathPoint[] => hole !== null);
  return { path, holes };
}
