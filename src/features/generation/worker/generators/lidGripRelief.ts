/**
 * Grip relief — material removed at the lid/bin seam so the lid can be got
 * off again (discussion #3272).
 *
 * Three shapes, all cut from the lid's outer face upward from the seam plane
 * (`anchorZ`), all confined to the enabled walls over a centered span:
 *
 *   chamfer  45° wedge at the seam. Opens a V against the bin's lip — a
 *            fingernail catch, the least intrusive treatment.
 *   reveal   crisp rectangular groove. Reads as a deliberate shadow line and
 *            leaves a downward-facing ledge at its top to hook.
 *   scallop  rounded-corner pocket, deeper and as tall as the skirt allows —
 *            a fingertip pocket that also bites the floor plate's outer edge.
 *
 * Every cutter is collected and applied in ONE `cutAll`, which is why four
 * relieved walls cost barely more than one; a per-side `cut` loop would pay a
 * full boolean per wall.
 *
 * Placement mirrors `lidClickRail`'s: rectangular lids get four axis-aligned
 * walls, polygon (`cellMask`) lids walk `maskToPolygon`'s straight edges. Both
 * modules read `gripPlacements` for where a side's centered span lives — the
 * rail split and the bin's lip dip register against this one derivation rather
 * than repeating it.
 *
 * Note that the relief never meets a click rail: it cuts UPWARD from `anchorZ`
 * and a rail's top sits at `wallBottomZ`, below it. Interrupting a rail is a
 * separate, opt-in trade (see `splitRailsAroundGrip`), not a consequence of
 * cutting here.
 */

import { draw, drawRoundedRectangle, unwrap, cutAll, rotate, translate } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid, Drawing } from 'brepjs';
import { maskToPolygon, MASK_CELL_SIZE } from '@/shared/utils/cellMask';
import {
  resolveLidGripSpanMm,
  resolveLidGripHeightMm,
  LID_GRIP_MIN_USEFUL_DEPTH_MM,
} from '@/shared/types/bin';
import type { LidGripMode, LidRailSide } from '@/shared/types/bin';
import { LID_COPLANAR_MARGIN } from './lidConstants';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import type { LidInputs } from './lidInputs';

/**
 * Corner radius (mm) of a scallop's elevation profile. Rounds the pocket's
 * ends and its top so it reads as a scallop rather than a slot, and keeps the
 * cut off the sharp inside corners a rectangular pocket would leave.
 */
const SCALLOP_CORNER_R = 1.2;

/** A relief on one wall: where its span is centered and how it is oriented. */
export interface GripPlacement {
  readonly side: LidRailSide;
  /** Midpoint of the wall's outer face, in lid-local XY. */
  readonly centerX: number;
  readonly centerY: number;
  /** Length of the relief along the wall. */
  readonly spanMm: number;
  /** Z rotation mapping the canonical (back-wall) cutter onto this wall. */
  readonly rotationDeg: number;
}

/**
 * Outward direction → side name and the Z rotation that maps the canonical
 * back-wall cutter onto it. Shared by both placement paths so the rectangle
 * and polygon cases cannot disagree about which wall is `left`.
 */
function sideForOutward(
  outX: number,
  outY: number
): { side: LidRailSide; rotationDeg: number } | null {
  if (outX === 0 && outY === 1) return { side: 'back', rotationDeg: 0 };
  if (outX === 0 && outY === -1) return { side: 'front', rotationDeg: 180 };
  if (outX === 1 && outY === 0) return { side: 'right', rotationDeg: -90 };
  if (outX === -1 && outY === 0) return { side: 'left', rotationDeg: 90 };
  return null;
}

/**
 * Straight run available on a wall — its length less the corner radius at each
 * end, matching the span a click rail is allowed. A relief that ran into a
 * corner would cut the mating shell's solid corner pillar.
 */
function usableRun(edgeLenMm: number, lidCornerR: number): number {
  return edgeLenMm - 2 * lidCornerR;
}

function gripPlacementsForRectangle(inputs: LidInputs): GripPlacement[] {
  const { lidOuterW, lidOuterD, lidCornerR, grip, outerOffsetX: offX, outerOffsetY: offY } = inputs;
  const runX = usableRun(lidOuterW, lidCornerR);
  const runY = usableRun(lidOuterD, lidCornerR);
  const spanX = resolveLidGripSpanMm(runX, grip.coverage);
  const spanY = resolveLidGripSpanMm(runY, grip.coverage);
  const halfW = lidOuterW / 2;
  const halfD = lidOuterD / 2;

  const candidates: readonly (GripPlacement & { readonly run: number })[] = [
    {
      side: 'back',
      centerX: offX,
      centerY: halfD + offY,
      spanMm: spanX,
      rotationDeg: 0,
      run: runX,
    },
    {
      side: 'front',
      centerX: offX,
      centerY: -halfD + offY,
      spanMm: spanX,
      rotationDeg: 180,
      run: runX,
    },
    {
      side: 'right',
      centerX: halfW + offX,
      centerY: offY,
      spanMm: spanY,
      rotationDeg: -90,
      run: runY,
    },
    {
      side: 'left',
      centerX: -halfW + offX,
      centerY: offY,
      spanMm: spanY,
      rotationDeg: 90,
      run: runY,
    },
  ];

  return candidates
    .filter((c) => grip.sides[c.side] && c.run > 0)
    .map(({ run: _run, ...placement }) => placement);
}

function gripPlacementsForPolygon(inputs: LidInputs): GripPlacement[] {
  const { cellMask, gridUnitMm, gridUnitMmY, lidCornerR, fitClearance, grip } = inputs;
  if (!cellMask) return [];

  const outer = maskToPolygon(cellMask)[0];
  const halfWidthMm = (cellMask.cols * MASK_CELL_SIZE * gridUnitMm) / 2;
  const halfDepthMm = (cellMask.rows * MASK_CELL_SIZE * gridUnitMmY) / 2;
  const verticesMm = outer.map((p) => ({
    x: p.x * gridUnitMm - halfWidthMm,
    y: p.y * gridUnitMmY - halfDepthMm,
  }));

  const placements: GripPlacement[] = [];
  for (let i = 0; i < verticesMm.length; i++) {
    const a = verticesMm[i];
    const b = verticesMm[(i + 1) % verticesMm.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLen = Math.abs(dx) + Math.abs(dy);
    const run = usableRun(edgeLen, lidCornerR);
    if (run <= 0) continue;

    const outX = Math.sign(dy);
    const outY = -Math.sign(dx);
    const classified = sideForOutward(outX, outY);
    if (!classified || !grip.sides[classified.side]) continue;

    // The lid's perimeter sits `fitClearance` inboard of the mask polygon, so
    // the outer face this relief cuts is that far in from the raw edge.
    placements.push({
      side: classified.side,
      centerX: (a.x + b.x) / 2 - outX * fitClearance,
      centerY: (a.y + b.y) / 2 - outY * fitClearance,
      spanMm: resolveLidGripSpanMm(run, grip.coverage),
      rotationDeg: classified.rotationDeg,
    });
  }
  return placements;
}

/**
 * Where each enabled wall's relief sits.
 *
 * Exported so `lidClickRail` can split a rail around the same span this
 * module cuts — the two must read one placement, not two derivations.
 */
export function gripPlacements(inputs: LidInputs): readonly GripPlacement[] {
  if (inputs.grip.mode === 'none' || inputs.gripDepthMm < LID_GRIP_MIN_USEFUL_DEPTH_MM) return [];
  return inputs.cellMask ? gripPlacementsForPolygon(inputs) : gripPlacementsForRectangle(inputs);
}

/**
 * Canonical cutter for the back wall (outward = +Y), centered on X, with the
 * wall's outer face at Y = 0. `rotate`/`translate` carry it to any other wall.
 *
 * Deliberately built from two plane conventions only:
 *
 * - `sketchOnPlane('YZ', -span/2)` + `extrude(span)`, the exact idiom
 *   `buildClickRailBar` uses, for the modes whose SECTION is constant along
 *   the wall (chamfer, reveal). The 2D profile reads (outward, z).
 * - an XY elevation extruded in Z and rotated upright, for the scallop, whose
 *   ELEVATION is the shaped part.
 *
 * `sketchOnPlane('XZ', pos)` would be the obvious plane for the scallop and is
 * the wrong one: it negates the Y origin, the bug that put split-connector
 * prisms 40mm off their wall and earned its own regression test. Nothing here
 * touches it.
 */
function buildCutter(
  scope: DisposalScope,
  mode: LidGripMode,
  spanMm: number,
  depthMm: number,
  heightMm: number,
  anchorZ: number
): Shape3D {
  // Overshoot outward so the cut bites through the outer face rather than
  // landing tangent to it.
  const M = LID_COPLANAR_MARGIN;

  if (mode === 'scallop') {
    // Elevation (span × height) drawn in XY, extruded to the cut depth, then
    // stood upright: +90° about X maps (x, y, z) → (x, -z, y), so the drawing's
    // vertical becomes +Z and the extrusion becomes -Y (inward on the canonical
    // back wall). -90° would invert the vertical — harmless on this symmetric
    // profile, wrong on an asymmetric one, so both this and the bin-side dip
    // use the same direction rather than each relying on its own symmetry.
    const radius = Math.max(Math.min(SCALLOP_CORNER_R, heightMm / 2 - LID_COPLANAR_MARGIN), 0);
    const slab = scope.register(
      drawRoundedRectangle(spanMm, heightMm, radius)
        .sketchOnPlane('XY', 0)
        .extrude(depthMm + M)
    );
    const upright = scope.register(rotate(slab, 90, { axis: [1, 0, 0] }));
    // Y ∈ [-(depth+M), 0] → [-depth, M]; Z centred on 0 → centred on the
    // relief's midpoint above the seam.
    return scope.register(translate(upright, [0, M, anchorZ + heightMm / 2]));
  }

  // Section profiles read (outward, z) — outward is +Y on the canonical wall,
  // so inward depths are negative.
  // A 45° wedge's two legs are equal, so the chamfer is sized by whichever of
  // depth and height is scarcer. Taking `depthMm` alone would let it climb past
  // the skirt the height clamp reserved — and would make the panel's height
  // readout, which reports the clamped value, describe geometry that isn't there.
  const chamferMm = Math.min(depthMm, heightMm);

  const profile: Drawing =
    mode === 'chamfer'
      ? // Deepest at the seam, running out to nothing `chamferMm` above it.
        draw([-chamferMm, anchorZ])
          .lineTo([M, anchorZ])
          .lineTo([M, anchorZ + chamferMm + M])
          .close()
      : // Crisp rectangular groove, leaving a downward-facing ledge at its top.
        draw([-depthMm, anchorZ])
          .lineTo([M, anchorZ])
          .lineTo([M, anchorZ + heightMm])
          .lineTo([-depthMm, anchorZ + heightMm])
          .close();

  return scope.register(profile.sketchOnPlane('YZ', -spanMm / 2).extrude(spanMm));
}

/**
 * Cut the grip relief out of the lid body.
 *
 * Returns `body` untouched when the feature is off, suppressed by the depth
 * clamp, or has no enabled wall long enough to carry it.
 */
export function addGripRelief(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const placements = gripPlacements(inputs);
  if (placements.length === 0) return body;

  const { grip, gripDepthMm, anchorZ } = inputs;
  const heightMm = resolveLidGripHeightMm(grip.mode, anchorZ);
  if (heightMm <= 0) return body;

  const cutters: Shape3D[] = [];
  for (const place of placements) {
    const cutter = buildCutter(scope, grip.mode, place.spanMm, gripDepthMm, heightMm, anchorZ);
    const oriented =
      place.rotationDeg === 0
        ? cutter
        : scope.register(rotate(cutter, place.rotationDeg, { axis: [0, 0, 1] }));
    const positioned = scope.register(translate(oriented, [place.centerX, place.centerY, 0]));
    // Tag the CUTTER, never the result. `setShapeOrigin` replaces a shape's
    // whole face-origin map, so tagging the post-boolean solid would stamp
    // every face on the lid `LID_GRIP` and wipe LID_BODY/LID_RAIL/LID_LIP with
    // it — the rail hover-glow and any per-face colouring go with them.
    if (originToTag) {
      collectOrigins(positioned, FeatureTag.LID_GRIP, originToTag);
    }
    cutters.push(positioned);
  }

  scope.register(body);
  return unwrap(cutAll(body as ValidSolid, cutters as ValidSolid[]));
}
