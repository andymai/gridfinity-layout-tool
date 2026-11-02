/**
 * Where "Add finger access" puts a finger cut beside a pocket: across the
 * middle of one of its long sides, reaching into the plastic past it and back
 * over the pocket, so a fingertip can get beside the tool and lift it.
 */

import type { Cutout } from '@/features/bin-designer/types';
import { maxEntryChamfer } from '@/features/bin-designer/types';
import { clearedProfile } from '@/shared/utils/cutoutFit';
import { pathCutoutOutline } from '@/shared/utils/pathCutoutOutline';
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
/** Keeps the cut's inner end off the pocket's far wall, which it would notch. */
const FAR_SIDE_GAP_MM = 1;
const MIN_FINGER_DEPTH_MM = 2;
const FINGER_ENTRY_MM = 1;

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

/**
 * The farthest point at which a ray from the outline's centre along `dir`
 * crosses it: the outer silhouette that way, even when the centre itself falls
 * outside the shape, as it does for a C-shaped tool.
 */
function outlineReach(outline: readonly Vec[], dir: Vec): number | null {
  let best: number | null = null;
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const t = (p.x * ey - p.y * ex) / denom;
    const u = (p.x * dir.y - p.y * dir.x) / denom;
    if (t > 0 && u >= 0 && u <= 1 && (best === null || t > best)) best = t;
  }
  return best;
}

/** How far the pocket's cut outline reaches from its centre along a local axis. */
function pocketReach(pocket: Cutout, dir: Vec): number {
  const cleared = clearedProfile(pocket);
  if (pocket.shape === 'path') {
    const outline = pathCutoutOutline(pocket);
    const reach = outline ? outlineReach(outline, dir) : null;
    if (reach !== null) return reach + cleared.clearance;
  }
  return Math.abs(dir.x) > 0.5 ? cleared.w / 2 : cleared.d / 2;
}

/**
 * A finger cut for `pocket`, without an id, or null when the pocket cannot
 * take one. Prefers the long side facing the front of the bin, where a hand
 * comes from, and turns to the other side when the front one would leave the
 * board.
 */
export function planFingerAccess(
  pocket: Cutout,
  board: CutoutBoard,
  maxCutDepth: number
): Omit<Cutout, 'id'> | null {
  if (fingerAccessBlockedReason(pocket) !== null) return null;
  const alongX = pocket.width >= pocket.depth;
  const normals: readonly Vec[] = alongX
    ? [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
      ]
    : [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];
  const ordered = [...normals].sort(
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

  const candidates = ordered.map((normal): Omit<Cutout, 'id'> => {
    const reach = pocketReach(pocket, normal);
    const across = reach + pocketReach(pocket, { x: -normal.x, y: -normal.y });
    const inward = Math.max(0, Math.min(outward, across - FAR_SIDE_GAP_MM));
    const along = reach + (outward - inward) / 2;
    const offset = toWorld({ x: normal.x * along, y: normal.y * along }, pocket.rotation);
    const length = outward + inward;
    const width = alongX ? FINGER_WIDTH_MM : length;
    const depthMm = alongX ? length : FINGER_WIDTH_MM;
    return {
      shape: 'slot',
      x: centre.x + offset.x - width / 2,
      y: centre.y + offset.y - depthMm / 2,
      width,
      depth: depthMm,
      cutDepth: depth,
      rotation: pocket.rotation,
      cornerRadius: 0,
      label: '',
      groupId: null,
      finger: { bottom: 'curved' },
      entryProfile: 'round',
      chamferWidth: Math.min(FINGER_ENTRY_MM, maxEntryChamfer(depth)),
    };
  });
  return candidates.find((c) => !isCutoutOffBoard({ ...c, id: 'finger' }, board)) ?? candidates[0];
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
