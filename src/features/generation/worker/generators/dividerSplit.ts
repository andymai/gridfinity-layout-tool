/**
 * Cuts a flat removable-divider plate that is longer than the print bed into
 * parts that fit, joined by the baseplate's puzzle tongue so the parts lock
 * back into one plate before it slides into the bin.
 *
 * A plate lies flat in its print frame: length along X, installed height along
 * Y, thickness along Z (see `buildDividerPiece`). Every cut is a plane of
 * constant X.
 */

import { box, cut, fuse, getBounds, intersect, measureVolume, translate, unwrap } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import {
  PUZZLE_HEAD_HALF,
  PUZZLE_PROTRUSION,
  TONGUE_CLEARANCE,
  effectiveClearance,
} from '@/shared/constants/connectors';
import { makePuzzleGroove, makePuzzleTongue } from './connectorShapes';

/**
 * Room each cut keeps for moving off a notch or a pattern hole. Planning
 * against `maxLengthMm` minus this means a moved cut still leaves every part
 * inside the bed.
 */
export const DIVIDER_CUT_SHIFT_ALLOWANCE_MM = 20;

/** Below this plate height a second tongue would crowd the first. */
const TWO_TONGUE_MIN_HEIGHT_MM = 16;

/** A section counts as solid when it keeps this share of the window's volume. */
const SOLID_WINDOW_RATIO = 0.999;

/**
 * Solid plate kept on each side of a joint, so a seam beside a cross-lap
 * notch does not leave a thin strip between the two.
 */
const JOINT_SOLID_MARGIN_MM = 3;

/**
 * Cut positions (X) that split `[minX, maxX]` into equal parts short enough to
 * fit `maxLengthMm` with a tongue of `reachMm` on one end. Empty when the
 * plate already fits or the bed is too short for any jointed part.
 */
export function planDividerCuts(
  minX: number,
  maxX: number,
  maxLengthMm: number,
  reachMm: number
): number[] {
  const length = maxX - minX;
  if (length <= maxLengthMm) return [];
  const usable = maxLengthMm - reachMm - DIVIDER_CUT_SHIFT_ALLOWANCE_MM;
  if (usable <= 0) return [];
  const parts = Math.ceil(length / usable);
  return Array.from({ length: parts - 1 }, (_, i) => minX + (length * (i + 1)) / parts);
}

/** Offsets tried around a planned cut, nearest first, inside the allowance. */
export function cutSearchOffsets(stepMm = 1): number[] {
  const max = DIVIDER_CUT_SHIFT_ALLOWANCE_MM / 2;
  const offsets = [0];
  for (let d = stepMm; d <= max; d += stepMm) offsets.push(d, -d);
  return offsets;
}

/** Tongue centers along the plate height: two on a tall plate, one otherwise. */
export function tongueCenters(minY: number, maxY: number, clearanceMm: number): number[] {
  const height = maxY - minY;
  const headSpan = 2 * (PUZZLE_HEAD_HALF + clearanceMm);
  if (height < headSpan + 2) return [];
  if (height >= TWO_TONGUE_MIN_HEIGHT_MM) return [minY + height / 4, minY + (3 * height) / 4];
  return [minY + height / 2];
}

function volumeOf(shape: Shape3D): number {
  const v = measureVolume(shape);
  return isOk(v) ? v.value : 0;
}

/**
 * True when the plate is full-height and full-thickness across the joint's
 * footprint at `x`, so the tongue and groove land in solid material rather
 * than in a cross-lap notch or a wall-pattern hole.
 */
function isSolidAt(piece: Shape3D, x: number, halfWidth: number): boolean {
  const b = getBounds(piece);
  const w = 2 * halfWidth;
  const h = b.yMax - b.yMin;
  const t = b.zMax - b.zMin;
  const window = box(w, h, t, {
    at: [x, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2],
  });
  try {
    const section = intersect(piece, window);
    if (!isOk(section)) return false;
    const solid = volumeOf(section.value) >= SOLID_WINDOW_RATIO * w * h * t;
    section.value.delete();
    return solid;
  } finally {
    window.delete();
  }
}

/** Half-space slab from `fromX` to `toX`, padded past the plate in Y and Z. */
function slab(piece: Shape3D, fromX: number, toX: number): Shape3D {
  const b = getBounds(piece);
  const pad = 2;
  return box(toX - fromX, b.yMax - b.yMin + 2 * pad, b.zMax - b.zMin + 2 * pad, {
    at: [(fromX + toX) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2],
  });
}

/** A puzzle prism through the plate's thickness at seam `x`, protruding +X. */
function jointPrism(
  piece: Shape3D,
  x: number,
  centers: readonly number[],
  clearanceMm: number,
  kind: 'tongue' | 'groove'
): Shape3D | null {
  if (centers.length === 0) return null;
  const b = getBounds(piece);
  const depth = b.zMax - b.zMin + 4;
  const at = (wall: number, along: number): [number, number] => [wall, along];
  const prisms = centers.map((y) =>
    kind === 'tongue'
      ? makePuzzleTongue(at, x, y, 1, depth)
      : makePuzzleGroove(at, x, y, -1, clearanceMm, 1, depth)
  );
  const lifted = prisms.map((p) => {
    const moved = translate(p, [0, 0, b.zMax + 2]);
    p.delete();
    return moved;
  });
  if (lifted.length === 1) return lifted[0];
  const fused = unwrap(fuse(lifted[0], lifted[1]));
  for (const p of lifted) p.delete();
  return fused;
}

/**
 * Split `piece` into parts no longer than `maxLengthMm`, each joined to the
 * next by puzzle tongues. Returns the piece itself, unconsumed, when it fits.
 * Otherwise the piece is consumed and the parts are returned left to right.
 */
export function splitDividerPieceToFit(
  piece: Shape3D,
  maxLengthMm: number,
  nozzleSizeMm?: number
): Shape3D[] {
  const clearance = effectiveClearance(TONGUE_CLEARANCE, 0, nozzleSizeMm);
  const reach = PUZZLE_PROTRUSION + clearance;
  const b = getBounds(piece);
  const planned = planDividerCuts(b.xMin, b.xMax, maxLengthMm, reach);
  if (planned.length === 0) return [piece];

  const centers = tongueCenters(b.yMin, b.yMax, clearance);
  const jointHalfWidth = reach + JOINT_SOLID_MARGIN_MM;
  const cuts = planned.map((ideal) => {
    for (const offset of cutSearchOffsets()) {
      const x = ideal + offset;
      if (isSolidAt(piece, x, jointHalfWidth)) return { x, jointed: centers.length > 0 };
    }
    return { x: ideal, jointed: false };
  });

  const parts: Shape3D[] = [];
  let left = b.xMin - 1;
  let pendingGroove: Shape3D | null = null;
  for (const [i, c] of cuts.entries()) {
    const right = i + 1 < cuts.length ? cuts[i + 1].x : b.xMax + 1;
    const region = slab(piece, left, c.x);
    let part = unwrap(intersect(piece, region));
    region.delete();
    if (pendingGroove) {
      const grooved = unwrap(cut(part, pendingGroove));
      part.delete();
      pendingGroove.delete();
      pendingGroove = null;
      part = grooved;
    }
    if (c.jointed) {
      const tongue = jointPrism(piece, c.x, centers, clearance, 'tongue');
      if (tongue) {
        const tongueMaterial = unwrap(intersect(piece, tongue));
        tongue.delete();
        const joined = unwrap(fuse(part, tongueMaterial));
        part.delete();
        tongueMaterial.delete();
        part = joined;
      }
      pendingGroove = jointPrism(piece, c.x, centers, clearance, 'groove');
    }
    parts.push(part);
    left = c.x;
    if (i + 1 === cuts.length) {
      const lastRegion = slab(piece, left, right);
      let last = unwrap(intersect(piece, lastRegion));
      lastRegion.delete();
      if (pendingGroove) {
        const grooved = unwrap(cut(last, pendingGroove));
        last.delete();
        pendingGroove.delete();
        pendingGroove = null;
        last = grooved;
      }
      parts.push(last);
    }
  }
  piece.delete();
  return parts;
}
