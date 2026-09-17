/**
 * Press-fit options for a magnet hole, shared by every surface that drills one
 * to the bin's magnet spec (bin socket, lightweight pads, detachable feet,
 * stackable lid top, lid retention bosses) and by the baseplate.
 *
 * Both options are fixed geometry rather than user-tuned: the crush-rib bore is
 * a sinusoidal wave whose peaks sit on the nominal bore and whose troughs
 * intrude by {@link MAGNET_CRUSH_RIB_DEPTH_MM}, so a slightly undersize print
 * still grips and an oversize one still crushes in. The chamfer is a 45 degree
 * lead-in at the mouth.
 */

export interface MagnetHoleStyle {
  readonly crushRibs: boolean;
  readonly chamfer: boolean;
}

export const PLAIN_MAGNET_HOLE: MagnetHoleStyle = { crushRibs: false, chamfer: false };

export const MAGNET_CRUSH_RIB_COUNT = 8;
/** Radial intrusion of each rib trough below the nominal bore (mm). */
export const MAGNET_CRUSH_RIB_DEPTH_MM = 0.3;
/** Lead-in width at the mouth (mm); the chamfer is 45 degrees so depth equals width. */
export const MAGNET_CHAMFER_MM = 0.8;
/**
 * Solid wall a chamfer must leave beyond its widened mouth. A wall thinner than
 * this keeps the plain mouth: the bore governs the fit, the lead-in does not.
 */
export const MAGNET_CHAMFER_MIN_WALL_MM = 0.8;
/** Bore vertices per rib for the ribbed ring, enough for the wave to read as a curve. */
const RIB_SEGMENTS = 8;

export function magnetHoleStyleFrom(source: {
  readonly magnetCrushRibs?: boolean;
  readonly magnetChamfer?: boolean;
}): MagnetHoleStyle {
  return { crushRibs: source.magnetCrushRibs === true, chamfer: source.magnetChamfer === true };
}

/** The style an item envelope's attachment summary carries. */
export function attachmentHoleStyle(attachment: {
  readonly magnetCrushRibs?: boolean;
  readonly magnetChamfer?: boolean;
}): MagnetHoleStyle {
  return magnetHoleStyleFrom(attachment);
}

export function isPlainMagnetHole(style: MagnetHoleStyle): boolean {
  return !style.crushRibs && !style.chamfer;
}

/** Cache-key segment: empty for a plain bore so pre-existing keys stay byte-identical. */
export function magnetHoleStyleKey(style: MagnetHoleStyle): string {
  const parts = [style.crushRibs ? 'ribs' : '', style.chamfer ? 'chamfer' : ''].filter(Boolean);
  return parts.join('+');
}

/** True when a chamfer can open into `wallMm` of solid beyond the bore without thinning it out. */
export function magnetChamferFits(wallMm: number): boolean {
  return wallMm >= MAGNET_CHAMFER_MM + MAGNET_CHAMFER_MIN_WALL_MM;
}

/** Radius the mouth opens to when the chamfer applies. */
export function magnetMouthRadius(radius: number, style: MagnetHoleStyle): number {
  return style.chamfer ? radius + MAGNET_CHAMFER_MM : radius;
}

/** Bore radius at polar angle `theta` (radians) for the given style. */
export function magnetBoreRadiusAt(theta: number, radius: number, style: MagnetHoleStyle): number {
  if (!style.crushRibs) return radius;
  const half = MAGNET_CRUSH_RIB_DEPTH_MM / 2;
  return radius - half + half * Math.cos(MAGNET_CRUSH_RIB_COUNT * theta);
}

/** Vertex count for a bore ring: the wave needs several points per rib. */
export function magnetBoreSegments(style: MagnetHoleStyle, plainSegments: number): number {
  return style.crushRibs
    ? Math.max(plainSegments, MAGNET_CRUSH_RIB_COUNT * RIB_SEGMENTS)
    : plainSegments;
}

/** Closed ring of bore points, counter-clockwise from +X, `segments` long. */
export function magnetBoreProfile(
  radius: number,
  style: MagnetHoleStyle,
  segments: number
): ReadonlyArray<readonly [number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const r = magnetBoreRadiusAt(theta, radius, style);
    pts.push([r * Math.cos(theta), r * Math.sin(theta)]);
  }
  return pts;
}
