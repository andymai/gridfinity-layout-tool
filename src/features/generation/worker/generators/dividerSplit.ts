/**
 * Cuts a flat removable-divider plate at its planned seams into parts joined
 * by the baseplate's puzzle tongue, so the parts lock back into one plate
 * before it slides into the bin.
 *
 * A plate lies flat in its print frame: length along X, installed height along
 * Y, thickness along Z (see `buildDividerPiece`). Every seam is a plane of
 * constant X, and the part left of it carries the tongue.
 */

import { box, cut, fuse, getBounds, intersect, measureVolume, translate, unwrap } from 'brepjs';
import type { Bounds3D, Shape3D } from 'brepjs';
import { err, isOk, ok } from '@/core/result';
import type { Result } from '@/core/result';
import { PUZZLE_HEAD_HALF } from '@/shared/constants/connectors';
import { makePuzzleGroove, makePuzzleTongue } from './connectorShapes';
import { dividerJointClearance, dividerJointSpan } from './dividerSeamPlan';
import type { JointSpan } from './dividerSeamPlan';

/** Below this plate height a second tongue would crowd the first. */
const TWO_TONGUE_MIN_HEIGHT_MM = 16;

/** Plate kept between a groove's head and the plate's edge or a notch. */
const JOINT_EDGE_MARGIN_MM = 1;

/** A band counts as solid when it keeps this share of its box's volume. */
const SOLID_BAND_RATIO = 0.999;

const ROW_SEARCH_STEP_MM = 1;

interface Joint {
  readonly x: number;
  readonly rows: readonly number[];
}

function volumeOf(shape: Shape3D): number {
  const v = measureVolume(shape);
  return isOk(v) ? v.value : 0;
}

function isSolidBand(
  section: Shape3D,
  xLo: number,
  xHi: number,
  y: number,
  half: number,
  b: Bounds3D
): boolean {
  const t = b.zMax - b.zMin;
  const band = box(xHi - xLo, 2 * half, t, { at: [(xLo + xHi) / 2, y, (b.zMin + b.zMax) / 2] });
  try {
    const hit = intersect(section, band);
    if (!isOk(hit)) return false;
    const solid = volumeOf(hit.value) >= SOLID_BAND_RATIO * (xHi - xLo) * 2 * half * t;
    hit.value.delete();
    return solid;
  } finally {
    band.delete();
  }
}

/**
 * Heights for a seam's tongues: two on a tall plate, one otherwise, each in a
 * band that is solid across the whole joint. The evenly spaced heights come
 * first; a cross-lap notch or a lid relief there moves the tongue to the
 * nearest solid band instead.
 */
function tongueRows(section: Shape3D, xLo: number, xHi: number, b: Bounds3D, cl: number): number[] {
  const half = PUZZLE_HEAD_HALF + cl + JOINT_EDGE_MARGIN_MM;
  const lo = b.yMin + half;
  const hi = b.yMax - half;
  if (hi < lo) return [];
  const height = b.yMax - b.yMin;
  const preferred =
    height >= TWO_TONGUE_MIN_HEIGHT_MM
      ? [b.yMin + height / 4, b.yMin + (3 * height) / 4]
      : [b.yMin + height / 2];
  const nearestPreferred = (y: number): number =>
    Math.min(...preferred.map((p) => Math.abs(p - y)));
  const scan: number[] = [];
  for (let y = lo; y <= hi; y += ROW_SEARCH_STEP_MM) scan.push(y);
  scan.sort((a, c) => nearestPreferred(a) - nearestPreferred(c));

  const rows: number[] = [];
  for (const y of [...preferred, ...scan]) {
    if (rows.length === preferred.length) break;
    if (y < lo || y > hi || rows.some((r) => Math.abs(r - y) < 2 * half)) continue;
    if (isSolidBand(section, xLo, xHi, y, half, b)) rows.push(y);
  }
  return rows.sort((a, c) => a - c);
}

function jointAt(piece: Shape3D, x: number, span: JointSpan, b: Bounds3D, cl: number): Joint {
  const xLo = x - span.behind;
  const xHi = x + span.ahead;
  const window = box(xHi - xLo, b.yMax - b.yMin + 2, b.zMax - b.zMin + 2, {
    at: [(xLo + xHi) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2],
  });
  const section = intersect(piece, window);
  window.delete();
  if (!isOk(section)) return { x, rows: [] };
  try {
    return { x, rows: tongueRows(section.value, xLo, xHi, b, cl) };
  } finally {
    section.value.delete();
  }
}

/** The part of `piece` between two X planes, padded past the plate in Y and Z. */
function slab(piece: Shape3D, fromX: number, toX: number, b: Bounds3D): Shape3D {
  const region = box(toX - fromX, b.yMax - b.yMin + 4, b.zMax - b.zMin + 4, {
    at: [(fromX + toX) / 2, (b.yMin + b.yMax) / 2, (b.zMin + b.zMax) / 2],
  });
  try {
    return unwrap(intersect(piece, region));
  } finally {
    region.delete();
  }
}

/** A puzzle prism through the plate's thickness at seam `x`, protruding +X. */
function jointPrism(
  x: number,
  y: number,
  b: Bounds3D,
  cl: number,
  kind: 'tongue' | 'groove'
): Shape3D {
  const depth = b.zMax - b.zMin + 4;
  const at = (wall: number, along: number): [number, number] => [wall, along];
  const prism =
    kind === 'tongue'
      ? makePuzzleTongue(at, x, y, 1, depth)
      : makePuzzleGroove(at, x, y, -1, cl, 1, depth);
  try {
    return translate(prism, [0, 0, b.zMax + 2]);
  } finally {
    prism.delete();
  }
}

function cutParts(piece: Shape3D, joints: readonly Joint[], b: Bounds3D, cl: number): Shape3D[] {
  const parts: Shape3D[] = [];
  let current: Shape3D | null = null;
  try {
    for (let i = 0; i <= joints.length; i++) {
      const fromX = i === 0 ? b.xMin - 1 : joints[i - 1].x;
      const toX = i === joints.length ? b.xMax + 1 : joints[i].x;
      current = slab(piece, fromX, toX, b);
      for (const y of i > 0 ? joints[i - 1].rows : []) {
        const groove = jointPrism(fromX, y, b, cl, 'groove');
        try {
          const grooved: Shape3D = unwrap(cut(current, groove));
          current.delete();
          current = grooved;
        } finally {
          groove.delete();
        }
      }
      for (const y of i < joints.length ? joints[i].rows : []) {
        const prism = jointPrism(toX, y, b, cl, 'tongue');
        let tongue: Shape3D;
        try {
          tongue = unwrap(intersect(piece, prism));
        } finally {
          prism.delete();
        }
        try {
          const joined: Shape3D = unwrap(fuse(current, tongue));
          current.delete();
          current = joined;
        } finally {
          tongue.delete();
        }
      }
      parts.push(current);
      current = null;
    }
    return parts;
  } catch (e) {
    current?.delete();
    for (const p of parts) p.delete();
    throw e;
  }
}

/**
 * Split `piece` at `seams` into parts joined by puzzle tongues, left to right.
 * With no seams the piece comes back alone. On success the piece is consumed;
 * on failure it is left whole for the caller, and nothing else stays live.
 */
export function splitDividerPieceAtSeams(
  piece: Shape3D,
  seams: readonly number[],
  nozzleSizeMm?: number
): Result<Shape3D[]> {
  if (seams.length === 0) return ok([piece]);
  try {
    const cl = dividerJointClearance(nozzleSizeMm);
    const span = dividerJointSpan(cl);
    const b = getBounds(piece);
    const joints = seams.map((x) => jointAt(piece, x, span, b, cl));
    const blocked = joints.find((j) => j.rows.length === 0);
    if (blocked) {
      return err(new Error(`No solid band for a divider joint at x=${blocked.x.toFixed(1)}`));
    }
    const parts = cutParts(piece, joints, b, cl);
    piece.delete();
    return ok(parts);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
