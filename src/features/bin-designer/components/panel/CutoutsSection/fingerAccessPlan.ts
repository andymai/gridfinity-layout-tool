/**
 * Where "Add finger access" puts a finger cut beside a pocket: across the
 * middle of one of its long sides, reaching into the plastic past it and back
 * over the pocket, so a fingertip can get beside the tool and lift it.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { maxEntryChamfer } from '@/features/bin-designer/types';
import { clearedProfile } from '@/shared/utils/cutoutFit';
import { cutoutOutlineRing, meshOutlineRings } from '@/shared/utils/cutoutOutline';
import { pathCutoutCut } from '@/shared/utils/pathCutoutOutline';
import { isCutoutOffBoard, type CutoutBoard } from './offBoardCutouts';

/** Along the pocket's side: an adult fingertip with room to spare. */
export const FINGER_WIDTH_MM = 20;
/**
 * Across the side: half of it past the pocket's edge, the rest back over the
 * pocket, short of its far side by {@link FAR_SIDE_GAP_MM}.
 */
export const FINGER_LENGTH_MM = 40;
/** Stops short of the pocket floor, so the two floors never share a plane. */
const FLOOR_LIFT_MM = 1;
/**
 * Plastic kept between the cut's inner end and the pocket's far wall, beyond
 * the entry edge's flare, so the cut never notches the wall behind the tool.
 */
const FAR_SIDE_GAP_MM = 1;
/** Lines across the cut's width the far wall is measured along. */
const WIDTH_SAMPLES = 21;
/**
 * Extra lines either side of each outline vertex, so a notch narrower than
 * the spacing above cannot slip between lines. Either side, never on it: a
 * line through a vertex at a notch's tip touches without crossing.
 */
const VERTEX_NUDGE_MM = 1e-4;
const MIN_FINGER_DEPTH_MM = 2;
const FINGER_ENTRY_MM = 1;

/** The fields show hundredths; the keep is two millimetres. */
const toHundredths = (mm: number): number => Math.round(mm * 100) / 100;

export type FingerAccessBlock = 'shape' | 'repeat';

/**
 * Why a cutout cannot take finger access, or null when it can. A repeat would
 * need one per copy, which a single cut beside the master cannot give.
 */
export function fingerAccessBlockedReason(
  pocket: Pick<Cutout, 'shape' | 'finger' | 'array'>
): FingerAccessBlock | null {
  if (pocket.shape === 'text' || pocket.shape === 'knifeSlot' || pocket.finger !== undefined) {
    return 'shape';
  }
  return pocket.array ? 'repeat' : null;
}

interface Vec {
  readonly x: number;
  readonly y: number;
}

/** A local direction in world terms; the inverse of how labels localize. */
function toWorld(local: Vec, rotationDeg: number): Vec {
  const t = (rotationDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: local.x * c + local.y * s, y: -local.x * s + local.y * c };
}

interface PocketOutline {
  /** Centred on the pocket's box and unturned; several for a mesh silhouette. */
  readonly rings: readonly (readonly Vec[])[];
  /** Clearance the rings leave out, which every edge still moves out by. */
  readonly pad: number;
}

/**
 * The pocket as cut. A degenerate path reads as its box; a mesh imprint whose
 * file has not arrived has no outline, and gets no plan rather than one stood
 * on its box, which for a U-shaped tool lies between the arms.
 */
function pocketOutline(
  pocket: Cutout,
  meshAssets: CutoutBoard['meshAssets']
): PocketOutline | null {
  const { clearance, w, d } = clearedProfile(pocket);
  const centred = { ...pocket, x: -pocket.width / 2, y: -pocket.depth / 2, rotation: 0 };
  if (pocket.shape === 'mesh') {
    const rings = meshOutlineRings(centred, meshAssets?.[pocket.meshId ?? '']);
    if (rings.length === 0) return null;
    return { rings: rings.map((ring) => ring.map(([x, y]) => ({ x, y }))), pad: clearance };
  }
  if (pocket.shape === 'path') {
    const cut = pathCutoutCut(pocket, clearance, 0);
    if (cut) return { rings: [cut.base.map((p) => ({ x: p.x, y: p.y }))], pad: 0 };
  } else {
    const ring = cutoutOutlineRing({
      ...pocket,
      x: -w / 2,
      y: -d / 2,
      width: w,
      depth: d,
      rotation: 0,
    });
    if (ring) return { rings: [ring.map(([x, y]) => ({ x, y }))], pad: 0 };
  }
  const box = [
    { x: -w / 2, y: -d / 2 },
    { x: w / 2, y: -d / 2 },
    { x: w / 2, y: d / 2 },
    { x: -w / 2, y: d / 2 },
  ];
  return { rings: [box], pad: 0 };
}

interface Crossing {
  /** Signed distance along the line. */
  readonly t: number;
  readonly at: Vec;
  /** The crossed edge. */
  readonly a: Vec;
  readonly b: Vec;
}

function distanceToSegment(p: Vec, a: Vec, b: Vec): number {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const len2 = ex * ex + ey * ey;
  const k = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ex + (p.y - a.y) * ey) / len2));
  return Math.hypot(p.x - (a.x + ex * k), p.y - (a.y + ey * k));
}

/**
 * How far from a crossing, back along the line toward the cut, a point has to
 * stand to be `keep` from the crossed edge. Measured to the edge itself rather
 * than its line, so a slanted wall asks for more than `keep` and the tip of a
 * thin tongue for only about `keep`. The distance only grows along the way.
 */
function clearanceAlong(c: Crossing, dir: Vec, keep: number): number {
  const from = (d: number) =>
    distanceToSegment({ x: c.at.x + dir.x * d, y: c.at.y + dir.y * d }, c.a, c.b);
  let hi = keep + Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y);
  if (from(hi) < keep) return hi;
  let lo = 0;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (from(mid) < keep) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Where the line through `origin` along `dir` crosses the rings, smallest
 * first. Each edge owns its start point only, so a line through a vertex
 * counts it once, and inside alternates with outside along the line however
 * many rings it crosses.
 */
function lineCrossings(rings: PocketOutline['rings'], origin: Vec, dir: Vec): Crossing[] {
  const crossings: Crossing[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      const px = p.x - origin.x;
      const py = p.y - origin.y;
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const denom = dir.x * ey - dir.y * ex;
      if (Math.abs(denom) < 1e-12) continue;
      const t = (px * ey - py * ex) / denom;
      const u = (px * dir.y - py * dir.x) / denom;
      if (u >= 0 && u < 1) {
        const at = { x: origin.x + dir.x * t, y: origin.y + dir.y * t };
        crossings.push({ t, at, a: p, b: q });
      }
    }
  }
  return crossings.sort((a, b) => a.t - b.t);
}

interface PocketSide {
  /** From the pocket's centre to its outer edge that way. */
  readonly reach: number;
  /** How far past that edge the cut's inner end may go. */
  readonly inward: number;
}

/**
 * The pocket's outer edge along a local axis, and how far a cut standing on it
 * may reach back over the pocket. Measured on lines across the cut's whole
 * width, so a far wall that closes in, as on a tapered tool, stops the cut's
 * corners as well as its middle; the cut's round end gives back what it does
 * not fill at each line. A line that misses the pocket sets no limit. Null when
 * the centre line meets no edge that way, as on the open side of a U, where a
 * cut would stand in the plastic between its legs.
 */
function pocketSide(outline: PocketOutline, dir: Vec, keep: number): PocketSide | null {
  const centreEdge = lineCrossings(outline.rings, { x: 0, y: 0 }, dir).at(-1)?.t;
  if (centreEdge === undefined || centreEdge <= 0) return null;
  const outer = centreEdge + outline.pad;
  const tangent = { x: -dir.y, y: dir.x };
  const end = FINGER_WIDTH_MM / 2;
  const lines: number[] = [];
  for (let i = 0; i < WIDTH_SAMPLES; i++) lines.push(-end + (2 * end * i) / (WIDTH_SAMPLES - 1));
  for (const ring of outline.rings) {
    for (const v of ring) {
      const at = v.x * tangent.x + v.y * tangent.y;
      for (const s of [at - VERTEX_NUDGE_MM, at + VERTEX_NUDGE_MM]) {
        if (Math.abs(s) <= end) lines.push(s);
      }
    }
  }
  let inward = Number.POSITIVE_INFINITY;
  for (const s of lines) {
    const crossings = lineCrossings(outline.rings, { x: tangent.x * s, y: tangent.y * s }, dir);
    let farWall: Crossing | null = null;
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      if (crossings[k].t <= centreEdge + 1e-9) farWall = crossings[k];
    }
    if (farWall === null) continue;
    const room = clearanceAlong(farWall, dir, keep);
    const unfilled = end - Math.sqrt(Math.max(0, end * end - s * s));
    inward = Math.min(inward, outer - (farWall.t - outline.pad) - room + unfilled);
  }
  return { reach: outer, inward };
}

/**
 * A finger cut for `pocket`, without an id, or null when the pocket cannot
 * take one. Prefers the long side facing the front of the bin, where a hand
 * comes from, then the other long side, then the short sides, taking the
 * first that stays on the board.
 */
export function planFingerAccess(
  pocket: Cutout,
  board: CutoutBoard,
  maxCutDepth: number
): Omit<Cutout, 'id'> | null {
  if (fingerAccessBlockedReason(pocket) !== null) return null;
  const ySides: readonly Vec[] = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
  ];
  const xSides: readonly Vec[] = [
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ];
  const [long, short] = pocket.width >= pocket.depth ? [ySides, xSides] : [xSides, ySides];
  const frontFirst = [...long].sort(
    (a, b) => toWorld(a, pocket.rotation).y - toWorld(b, pocket.rotation).y
  );

  const centre = { x: pocket.x + pocket.width / 2, y: pocket.y + pocket.depth / 2 };
  // Lifted from the depth the pocket is BUILT at: one stored deeper than the
  // fill is cut only to the fill, and lifting the stored depth would land both
  // floors on that one plane.
  const depth = Math.min(
    maxCutDepth,
    Math.max(MIN_FINGER_DEPTH_MM, Math.min(pocket.cutDepth, maxCutDepth) - FLOOR_LIFT_MM)
  );
  const outward = FINGER_LENGTH_MM / 2;

  const entry = Math.min(FINGER_ENTRY_MM, maxEntryChamfer(depth));
  const outline = pocketOutline(pocket, board.meshAssets);
  if (!outline) return null;
  const candidates: Omit<Cutout, 'id'>[] = [];
  for (const normal of [...frontFirst, ...short]) {
    const side = pocketSide(outline, normal, FAR_SIDE_GAP_MM + entry);
    if (!side) continue;
    const inward = Math.max(0, Math.min(outward, side.inward));
    const along = side.reach + (outward - inward) / 2;
    const offset = toWorld({ x: normal.x * along, y: normal.y * along }, pocket.rotation);
    const length = outward + inward;
    const acrossY = Math.abs(normal.y) > 0.5;
    const width = acrossY ? FINGER_WIDTH_MM : length;
    const depthMm = acrossY ? length : FINGER_WIDTH_MM;
    candidates.push({
      shape: 'slot',
      x: toHundredths(centre.x + offset.x - width / 2),
      y: toHundredths(centre.y + offset.y - depthMm / 2),
      width: toHundredths(width),
      depth: toHundredths(depthMm),
      cutDepth: depth,
      rotation: pocket.rotation,
      cornerRadius: 0,
      label: '',
      groupId: null,
      finger: { bottom: 'curved' },
      entryProfile: 'round',
      chamferWidth: entry,
    });
  }
  return (
    candidates.find((c) => !isCutoutOffBoard({ ...c, id: 'finger' }, board)) ??
    candidates.at(0) ??
    null
  );
}

/**
 * The same finger cut as the other shape, about the same centre: a round as
 * wide as the slot's narrow side, or a slot twice as long as the round.
 */
export function switchFingerShape(cutout: Cutout): Partial<Cutout> {
  const cx = cutout.x + cutout.width / 2;
  const cy = cutout.y + cutout.depth / 2;
  if (cutout.shape === 'slot') {
    const size = Math.min(cutout.width, cutout.depth);
    return { shape: 'circle', width: size, depth: size, x: cx - size / 2, y: cy - size / 2 };
  }
  const narrow = cutout.width;
  return {
    shape: 'slot',
    width: narrow,
    depth: narrow * 2,
    x: cx - narrow / 2,
    y: cy - narrow,
  };
}
