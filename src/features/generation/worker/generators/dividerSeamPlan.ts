/**
 * Where a removable divider longer than the print bed is cut, decided before
 * the piece's wall pattern so the pattern can keep each joint's plate solid.
 * Offsets run along the piece length from its midpoint, as `PieceObstruction`
 * does. The left part of every seam carries the tongue, protruding +X.
 */

import { PUZZLE_PROTRUSION } from '@/shared/constants/connectors';
import {
  dividerJointClearance,
  partLengthBudget,
  tongueBandHalf,
} from '@/shared/utils/dividerJoint';
import type { DividerBedFit, PrintBedMm } from '@/shared/utils/dividerJoint';

// The bed and band math is shared so the designer preview reads the same plan.
export { dividerJointClearance, partLengthBudget, tongueBandHalf };
export type { DividerBedFit, PrintBedMm };
import type { PieceObstruction } from './dividerPiecePatterns';

/**
 * How far a seam may move from its evenly spaced position to clear a notch or
 * groove. Parts are planned this much short of the bed so a moved seam still
 * leaves every part inside it.
 */
export const DIVIDER_SEAM_SHIFT_ALLOWANCE_MM = 20;

/**
 * Solid plate kept behind the tongue's root and beyond the groove's head. Small
 * enough that the joint fits between cross-lap notches at the minimum 10mm
 * slot pitch.
 */
export const DIVIDER_JOINT_MARGIN_MM = 2;

const SEAM_SEARCH_STEP_MM = 0.5;

/** Below this plate height a second tongue would crowd the first. */
const TWO_TONGUE_MIN_HEIGHT_MM = 16;

const ROW_SEARCH_STEP_MM = 0.5;

/** The plate a joint at seam `x` needs solid: `[x - behind, x + ahead]`. */
export interface JointSpan {
  readonly behind: number;
  readonly ahead: number;
}

/** How far the tongue reaches past its seam into the next part. */
export function dividerJointReach(clearanceMm: number): number {
  return PUZZLE_PROTRUSION + clearanceMm;
}

export function dividerJointSpan(clearanceMm: number): JointSpan {
  return {
    behind: DIVIDER_JOINT_MARGIN_MM,
    ahead: dividerJointReach(clearanceMm) + DIVIDER_JOINT_MARGIN_MM,
  };
}

/** Gap between the joint at `x` and the nearest obstruction; negative on overlap. */
function jointGap(x: number, span: JointSpan, obstructions: readonly PieceObstruction[]): number {
  let gap = Number.POSITIVE_INFINITY;
  for (const o of obstructions) {
    const lo = o.offset - o.width / 2;
    const hi = o.offset + o.width / 2;
    gap = Math.min(gap, Math.max(lo - (x + span.ahead), x - span.behind - hi));
  }
  return gap;
}

/**
 * Seams that cut a piece of `lengthMm` into equal parts no longer than
 * `budgetMm` once each carries its tongue. Each seam moves, within the
 * allowance, to the nearest spot where the joint clears every obstruction, or
 * to the most open spot when none does. Empty when the piece fits or the
 * budget leaves no room for a jointed part.
 */
export function planDividerSeams(
  lengthMm: number,
  budgetMm: number,
  obstructions: readonly PieceObstruction[],
  clearanceMm: number
): number[] {
  if (lengthMm <= budgetMm) return [];
  const span = dividerJointSpan(clearanceMm);
  const usable = budgetMm - dividerJointReach(clearanceMm) - DIVIDER_SEAM_SHIFT_ALLOWANCE_MM;
  if (usable <= 0) return [];
  const parts = Math.ceil(lengthMm / usable);
  const halfShift = DIVIDER_SEAM_SHIFT_ALLOWANCE_MM / 2;

  return Array.from({ length: parts - 1 }, (_, i) => {
    const ideal = -lengthMm / 2 + (lengthMm * (i + 1)) / parts;
    let best = ideal;
    let bestGap = jointGap(ideal, span, obstructions);
    if (bestGap >= 0) return ideal;
    for (let d = SEAM_SEARCH_STEP_MM; d <= halfShift; d += SEAM_SEARCH_STEP_MM) {
      for (const x of [ideal + d, ideal - d]) {
        const gap = jointGap(x, span, obstructions);
        if (gap >= 0) return x;
        if (gap > bestGap) {
          best = x;
          bestGap = gap;
        }
      }
    }
    return best;
  });
}

/**
 * The column the wall pattern must leave solid around a seam, so the joint
 * lands in plate rather than in a pattern hole.
 */
export function seamKeepOut(seam: number, clearanceMm: number): PieceObstruction {
  const span = dividerJointSpan(clearanceMm);
  return { offset: seam + (span.ahead - span.behind) / 2, width: span.ahead + span.behind };
}

/**
 * Heights for a seam's tongues: two on a tall plate, one otherwise, each in a
 * band that `isSolid` reports solid across the joint. The evenly spaced
 * heights win when both are solid. When a notch or a lid relief blocks one,
 * the tongues move to the solid pair nearest them, else to the single nearest
 * solid band. The search includes both ends of the range, because a band
 * blocked from one edge leaves its solid room against the other.
 */
export function chooseTongueRows(
  minY: number,
  maxY: number,
  clearanceMm: number,
  isSolid: (y: number) => boolean
): number[] {
  const half = tongueBandHalf(clearanceMm);
  const lo = minY + half;
  const hi = maxY - half;
  if (hi < lo) return [];
  const height = maxY - minY;
  const preferred =
    height >= TWO_TONGUE_MIN_HEIGHT_MM
      ? [minY + height / 4, minY + (3 * height) / 4]
      : [minY + height / 2];
  const known = new Map<number, boolean>();
  const solid = (y: number): boolean => {
    const cached = known.get(y);
    if (cached !== undefined) return cached;
    const result = isSolid(y);
    known.set(y, result);
    return result;
  };
  if (preferred.every(solid)) return preferred;

  const candidates = [...preferred, hi];
  for (let y = lo; y < hi; y += ROW_SEARCH_STEP_MM) candidates.push(y);
  const open = [...new Set(candidates)].filter(solid).sort((a, c) => a - c);
  if (preferred.length === 2) {
    let pair: number[] = [];
    let pairCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < open.length; i++) {
      for (let j = i + 1; j < open.length; j++) {
        if (open[j] - open[i] < 2 * half) continue;
        const cost = Math.abs(open[i] - preferred[0]) + Math.abs(open[j] - preferred[1]);
        if (cost < pairCost) {
          pair = [open[i], open[j]];
          pairCost = cost;
        }
      }
    }
    if (pair.length > 0) return pair;
  }
  const distance = (y: number): number => Math.min(...preferred.map((p) => Math.abs(p - y)));
  let single: number | null = null;
  for (const y of open) if (single === null || distance(y) < distance(single)) single = y;
  return single === null ? [] : [single];
}
