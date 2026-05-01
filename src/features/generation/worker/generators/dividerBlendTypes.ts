/**
 * Shared types, constants, and predicates for the divider-cutout blend
 * pipeline. Split out so the resolvers (`dividerBlendResolvers`) and cut
 * builders (`dividerBlendCuts`) can each import only what they need.
 */

/** Resolved outer-wall cutout geometry in bin-global coordinates. */
export interface OuterWallCutoutInfo {
  readonly side: 'front' | 'back' | 'left' | 'right';
  /** Full wall span along the span axis (mm). */
  readonly wallSpan: number;
  /** Cutout width (mm). */
  readonly cutWidth: number;
  /** Cutout height from wall top (mm). */
  readonly userCutHeight: number;
  /** Z coordinate of cutout bottom edge. */
  readonly cutBottom: number;
  /** Cutout center offset from wall center along span axis (mm). */
  readonly centerOffset: number;
  /** Left edge of cutout in global span-axis coords (mm). */
  readonly cutLeft: number;
  /** Right edge of cutout in global span-axis coords (mm). */
  readonly cutRight: number;
  /** Coordinate of the wall face (e.g. -innerD/2 for front). */
  readonly wallFaceCoord: number;
  /** Sign of inward direction from this wall (+1 for front, -1 for back). */
  readonly inwardSign: number;
  /** Span axis: 'x' for front/back, 'y' for left/right. */
  readonly spanAxis: 'x' | 'y';
}

/** Divider wall segment in bin-global coordinates. */
export interface DividerInfo {
  /** Vertical = between columns (runs along Y), horizontal = between rows (runs along X). */
  readonly axis: 'vertical' | 'horizontal';
  /** Position along the perpendicular axis (X for vertical dividers, Y for horizontal). */
  readonly posAlongPerp: number;
  /** Start of segment along span axis (mm). */
  readonly spanStart: number;
  /** End of segment along span axis (mm). */
  readonly spanEnd: number;
  /** Divider wall thickness (mm). */
  readonly thickness: number;
}

/** Minimum geometry dimension to avoid degenerate shapes (mm). */
export const MIN_DIM = 0.5;

/** Tolerance for matching divider endpoints to wall face coordinates (mm). */
export const WALL_TOUCH_TOL = 0.01;

/** Minimal wall face descriptor shared by cutout info and junction detection. */
export interface WallFaceInfo {
  readonly wallFaceCoord: number;
  readonly inwardSign: number;
  readonly spanAxis: 'x' | 'y';
}

/** Build a WallFaceInfo for a given side from bin inner dimensions. */
export function getWallFaceInfo(
  side: 'front' | 'back' | 'left' | 'right',
  innerW: number,
  innerD: number
): WallFaceInfo {
  // Tighter than Record<string, …> so a typo or missing side breaks
  // compilation rather than returning undefined at runtime.
  const info: Record<'front' | 'back' | 'left' | 'right', WallFaceInfo> = {
    front: { wallFaceCoord: -innerD / 2, inwardSign: 1, spanAxis: 'x' },
    back: { wallFaceCoord: innerD / 2, inwardSign: -1, spanAxis: 'x' },
    left: { wallFaceCoord: -innerW / 2, inwardSign: 1, spanAxis: 'y' },
    right: { wallFaceCoord: innerW / 2, inwardSign: -1, spanAxis: 'y' },
  };
  return info[side];
}

/**
 * Check if a divider is perpendicular to a given wall face.
 * Vertical dividers (run along Y) are perpendicular to front/back walls.
 * Horizontal dividers (run along X) are perpendicular to left/right walls.
 */
export function isPerpendicular(divider: DividerInfo, wall: WallFaceInfo): boolean {
  if (divider.axis === 'vertical') return wall.spanAxis === 'x'; // front/back
  return wall.spanAxis === 'y'; // left/right
}

/**
 * Check if a divider's end touches a specific wall face.
 */
export function dividerTouchesWall(divider: DividerInfo, wall: WallFaceInfo): boolean {
  if (divider.axis === 'vertical' && wall.spanAxis === 'x') {
    // Vertical divider, front/back wall
    if (wall.inwardSign > 0)
      return Math.abs(divider.spanStart - wall.wallFaceCoord) < WALL_TOUCH_TOL;
    return Math.abs(divider.spanEnd - wall.wallFaceCoord) < WALL_TOUCH_TOL;
  }
  if (divider.axis === 'horizontal' && wall.spanAxis === 'y') {
    // Horizontal divider, left/right wall
    if (wall.inwardSign > 0)
      return Math.abs(divider.spanStart - wall.wallFaceCoord) < WALL_TOUCH_TOL;
    return Math.abs(divider.spanEnd - wall.wallFaceCoord) < WALL_TOUCH_TOL;
  }
  return false;
}

/** Ramp zone descriptor for hex pattern clipping on a specific wall. */
export interface RampZone {
  /** Offset along the wall span from wall center (mm). */
  readonly offsetAlongWall: number;
  /** Width of the ramp zone along the wall span (mm). */
  readonly width: number;
  /** Height of the ramp zone (mm). */
  readonly height: number;
}
