/**
 * Wall-pattern placement for REMOVABLE divider pieces (#2811, follow-up to the
 * integrated-divider work in `dividerPatterns.ts`).
 *
 * A slotted bin's dividers are separate printed parts, not part of the bin
 * body, so they have an entirely different set of things the pattern must not
 * perforate: the tab engagement that seats each end in a wall slot, the
 * cross-lap notches that let perpendicular pieces interlock, and the face
 * grooves used as receptacles or snap-off score lines.
 *
 * Pure — no brepjs. Coordinates match the piece's own flat print frame: `u`
 * runs along the piece length with 0 at its midpoint, `z` is height above the
 * INSTALLED bottom edge (so the band rules read the same as the integrated
 * dividers').
 */

import type { DividerKeepOut } from './dividerPatterns';
import { BOTTOM_SOLID_SKIRT, TOP_KEEP_OUT } from './wallPatterns';

/** A groove or notch column that must stay solid, in piece-local u. */
export interface PieceObstruction {
  /** Centre offset along the piece length, relative to its midpoint. */
  readonly offset: number;
  /** Opening along the length. */
  readonly width: number;
}

export interface PiecePatternInput {
  /** Total piece length including tab engagement at both ends. */
  readonly length: number;
  /** Installed height of the piece. */
  readonly height: number;
  /** Depth of tab engagement at EACH end (0 for an abutting T-junction end). */
  readonly tabEngagement: number;
  /** Cross-lap notches cut from one edge. */
  readonly notches: readonly PieceObstruction[];
  /** Full-height face grooves (receptacles / snap score lines). */
  readonly grooves: readonly PieceObstruction[];
  /** Solid margin held around every obstruction and at both ends. */
  readonly border: number;
}

export interface PiecePatternPlan {
  /** Span the pattern may occupy, centred on the piece. */
  readonly patternSpan: number;
  readonly keepOuts: readonly DividerKeepOut[];
  readonly bandZ0: number;
  readonly bandHeight: number;
}

/**
 * Resolve the pattern band and keep-outs for one removable piece, or null when
 * nothing can be patterned.
 *
 * Every obstruction is cleared over the FULL band height rather than just its
 * own extent. A cross-lap notch already removes half the piece's height at that
 * column, so the surviving ligament carries the whole joint; a receptacle
 * groove leaves a 40% web (`RECEPTACLE_DEPTH_RATIO`) that a through-hole would
 * cut in two; and a snap score line only breaks cleanly if the web behind it is
 * continuous. Perforating any of them is what turns a printable joint into a
 * snapped one.
 */
export function planPiecePattern(input: PiecePatternInput): PiecePatternPlan | null {
  const { length, height, tabEngagement, border } = input;

  // Free-standing part: both edges need a solid rim, so the same band rules as
  // the integrated dividers apply symmetrically (there is no floor slab here,
  // hence no wallThickness term on the bottom).
  const bandZ0 = BOTTOM_SOLID_SKIRT;
  const bandHeight = height - TOP_KEEP_OUT - BOTTOM_SOLID_SKIRT;
  if (bandHeight <= 0) return null;
  const bandTop = bandZ0 + bandHeight;

  // The tab is buried in the wall slot — perforating it would leave the piece
  // seated on air. Held clear at both ends plus the border.
  const patternSpan = length - 2 * (tabEngagement + border);
  if (patternSpan <= 0) return null;

  const keepOuts: DividerKeepOut[] = [];
  for (const obstruction of [...input.notches, ...input.grooves]) {
    const half = obstruction.width / 2 + border;
    keepOuts.push({
      uMin: obstruction.offset - half,
      uMax: obstruction.offset + half,
      zMin: 0,
      zMax: bandTop,
    });
  }

  return { patternSpan, keepOuts, bandZ0, bandHeight };
}
