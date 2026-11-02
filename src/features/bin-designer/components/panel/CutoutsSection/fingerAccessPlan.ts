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
 * Where the line through the outline's centre along `dir` crosses it, as
 * signed distances along `dir`, smallest first. Each edge owns its start
 * point only, so a line through a vertex counts it once.
 */
function lineCrossings(outline: readonly Vec[], dir: Vec): number[] {
  const crossings: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i];
    const q = outline[(i + 1) % outline.length];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const t = (p.x * ey - p.y * ex) / denom;
    const u = (p.x * dir.y - p.y * dir.x) / denom;
    if (u >= 0 && u < 1) crossings.push(t);
  }
  return crossings.sort((a, b) => a - b);
}

interface PocketSide {
  /** From the pocket's centre to its outer edge that way. */
  readonly reach: number;
  /** How much pocket lies inward of that edge before the next one. */
  readonly span: number;
}

/**
 * The pocket's outer edge along a local axis and the pocket behind it: the
 * whole pocket across for a plain shape, only the arm a C or U shape ends in.
 * Null when the line through the centre meets no edge that way, as on the
 * open side of a U, where a cut would stand in the plastic between its legs.
 */
function pocketSide(pocket: Cutout, dir: Vec): PocketSide | null {
  const cleared = clearedProfile(pocket);
  const outline = pocket.shape === 'path' ? pathCutoutOutline(pocket) : null;
  if (outline) {
    const crossings = lineCrossings(outline, dir);
    const outer = crossings.at(-1);
    if (outer === undefined || outer <= 0) return null;
    const inner = crossings.at(-2) ?? -outer;
    return { reach: outer + cleared.clearance, span: outer - inner + 2 * cleared.clearance };
  }
  const half = Math.abs(dir.x) > 0.5 ? cleared.w / 2 : cleared.d / 2;
  return { reach: half, span: 2 * half };
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

  const candidates: Omit<Cutout, 'id'>[] = [];
  for (const normal of [...frontFirst, ...short]) {
    const side = pocketSide(pocket, normal);
    if (!side) continue;
    const inward = Math.max(0, Math.min(outward, side.span - FAR_SIDE_GAP_MM));
    const along = side.reach + (outward - inward) / 2;
    const offset = toWorld({ x: normal.x * along, y: normal.y * along }, pocket.rotation);
    const length = outward + inward;
    const acrossY = Math.abs(normal.y) > 0.5;
    const width = acrossY ? FINGER_WIDTH_MM : length;
    const depthMm = acrossY ? length : FINGER_WIDTH_MM;
    candidates.push({
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
