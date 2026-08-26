/**
 * Mount-down screw hole planning: pure geometry, no BREP kernel.
 *
 * Owns the ONE decision every layer has to agree on: for each screw, does it sit
 * in the solid drawer-fit margin, or does it fall back to the pocket floor?
 * That choice drives the plate's printed height, so it is resolved once at PLATE
 * level and handed down, never re-derived per piece.
 *
 * Why plate level: each split piece is generated from its own params, but the
 * pieces have to assemble flush. An interior piece has no margin at all, so it
 * always needs the pocket-floor fallback, and if any one piece needs the pad,
 * every piece must carry the same taller slab or the assembled plate is stepped.
 *
 * Every slot carries a `target` in piece-centred mm, whatever its site. A margin
 * target IS the hole centre. A floor target is the IDEAL point, and the geometry
 * layer snaps it to the nearest legal `magnetPositionsForCell` position. Stating
 * the snap as one rule ("nearest magnet position to the anchor") is what keeps
 * the exact build, the draft mesh and the margin path from each inventing their
 * own "corner cell" and drifting apart.
 *
 * Plan against a PIECE's own resolved params, never the parent plate's. Under
 * `preferIdenticalPieces` a piece is built in a canonical orientation and rotated
 * 180° at placement, and padding/edges/corner radii are already rotated for it;
 * planning from those keeps the screws rotating in lockstep.
 */

import {
  SCREW_COUNTERBORE_DEFAULT_DEPTH_MM,
  SCREW_COUNTERBORE_DEFAULT_DIAMETER_MM,
  SCREW_COUNTERSINK_DEFAULT_DIAMETER_MM,
  SCREW_COUNTERSINK_INCLUDED_ANGLE_DEG,
  SCREW_PAD_MIN_RETAIN_MM,
  SCREWS_PER_PIECE_DEFAULT,
  SCREWS_PER_PIECE_MAX,
} from '@/core/baseplateDefaults';
import type { ScrewHeadStyle, ScrewHoleParams } from '@/core/types/baseplate';

/**
 * Plastic kept between a head recess and the edges of the margin band it sits
 * in. One extrusion width at a 0.4mm nozzle would be too optimistic for a
 * feature the user drives a screw through, so this is three.
 */
export const SCREW_MARGIN_MIN_WALL_MM = 1.2;

/** Which material a screw passes through. */
export type ScrewSite = 'margin' | 'floor';

/**
 * Where on a piece a screw can sit, in the order slots are filled: the four
 * corners first (a piece fastened only at its corners cannot pivot), then the
 * four edge midpoints for counts above four.
 *
 * The corner block is deliberately a complete set of four. Under
 * `preferIdenticalPieces` a piece may be placed 180° rotated, which maps
 * bl↔tr and br↔tl; a full set is invariant under that, a partial one is not and
 * would break the rotated pair's shared fingerprint.
 *
 * WITHIN each block the order is by half-turn pair, not by the compass: bl/tr
 * before br/tl, and b/t before r/l, so every even count closes under that same
 * rotation (#3698). It also picks the better two-screw layout for free, since a
 * diagonal pair resists the pivot that two screws sharing an edge allow. Odd
 * counts cannot close and are left asymmetric rather than pretended otherwise.
 */
export const SCREW_ANCHORS = ['bl', 'tr', 'br', 'tl', 'b', 't', 'r', 'l'] as const;
export type ScrewAnchor = (typeof SCREW_ANCHORS)[number];

export interface ScrewSlot {
  readonly anchor: ScrewAnchor;
  readonly site: ScrewSite;
  /**
   * Piece-centred mm. Exact hole centre for a margin slot; for a floor slot the
   * ideal point that the geometry layer snaps to the nearest magnet position.
   */
  readonly target: readonly [number, number];
}

/** Per-side solid margin band widths (mm) available on a piece. */
export interface ScrewMarginBands {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

/** Corner radii (mm) of the piece's outer profile, matching `CornerRadii`. */
export interface ScrewCornerRadii {
  readonly tl: number;
  readonly tr: number;
  readonly bl: number;
  readonly br: number;
}

export interface ScrewPieceInput {
  /** Full printed footprint of the piece in mm. */
  readonly widthMm: number;
  readonly depthMm: number;
  readonly bands: ScrewMarginBands;
  /** Outer rounding, so a hole is not placed in material the arc removes. */
  readonly cornerRadii?: ScrewCornerRadii;
  /**
   * True when a disc of `radius` at (x, y) lies wholly inside a custom
   * perimeter. Piece-centred mm. Absent ⇒ the piece is a plain rectangle.
   *
   * Consulted while ASSIGNING sites, not while pruning, because an outline is
   * resolved-param data known exactly as early as padding is. A shaped plate
   * whose corner falls outside the perimeter therefore falls back to the floor
   * and gets its pad, instead of silently shipping with fewer fasteners.
   */
  readonly isInsidePerimeter?: (x: number, y: number, radius: number) => boolean;
  /**
   * True when a candidate collides with something that owns that material: a
   * connector tongue or groove, or a seam. Piece-centred mm; `radius` is the
   * head radius.
   *
   * Consulted only while PRUNING. Unlike the perimeter, connector geometry is
   * computed downstream and is not reliably known when plate height is decided,
   * so it may remove a screw but never move one between sites.
   */
  readonly isBlocked?: (x: number, y: number, radius: number) => boolean;
  /**
   * Whether the PLATE provisioned the floor pad, from
   * `ResolvedBaseplateParams.screwPadThicknessMm`.
   *
   * The plate decides and the piece obeys. A piece cannot derive this for
   * itself: pieces of one plate share a slab height, and a piece that concluded
   * "I need a pad" would cut floor screws into material the plate never made
   * room for. Omitted ⇒ derived from this piece alone, which is only correct
   * for an unsplit plate.
   */
  readonly floorPadProvisioned?: boolean;
}

/**
 * Margin bands a piece can actually put a screw in.
 *
 * Padding survives in resolved params under `overTile`, but the material there
 * is functional grid rather than the solid ring a screw needs, so those bands
 * read as zero. `detachMargins` needs no handling here: it already zeroes the
 * body's padding, and each detached rail is planned as its own piece.
 */
export function effectiveMarginBands(params: {
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly overTile?: boolean;
}): ScrewMarginBands {
  if (params.overTile === true) return { left: 0, right: 0, front: 0, back: 0 };
  return {
    left: params.paddingLeft,
    right: params.paddingRight,
    front: params.paddingFront,
    back: params.paddingBack,
  };
}

/** Resolved head diameter for a style, honouring an explicit override. */
export function resolveScrewHeadDiameter(headStyle: ScrewHeadStyle, headDiameter?: number): number {
  if (headDiameter !== undefined) return headDiameter;
  return headStyle === 'countersink'
    ? SCREW_COUNTERSINK_DEFAULT_DIAMETER_MM
    : SCREW_COUNTERBORE_DEFAULT_DIAMETER_MM;
}

/**
 * Depth (mm) the head recess sinks below the surface it enters.
 *
 * For a countersink this is derived, not configured: the cone's depth follows
 * from how far it widens and the included angle, so a 90° cone over a ø3.4 shaft
 * widening to ø8.0 is exactly 2.3mm deep. This is the number that makes a 0.8mm
 * floor unusable as a countersink host and forces either the margin or a thicker
 * pad. A counterbore is a flat pocket, so its depth is whatever was asked for.
 */
export function screwHeadRecessDepth(params: ScrewHoleParams): number {
  if (params.headStyle === 'counterbore') {
    return params.counterboreDepth ?? SCREW_COUNTERBORE_DEFAULT_DEPTH_MM;
  }
  const headD = resolveScrewHeadDiameter('countersink', params.headDiameter);
  const radialWidening = Math.max(0, (headD - params.diameter) / 2);
  const halfAngleRad = ((SCREW_COUNTERSINK_INCLUDED_ANGLE_DEG / 2) * Math.PI) / 180;
  return radialWidening / Math.tan(halfAngleRad);
}

/** The recess a magnet pocket already provides at a screw position, when the
 * screw is concentric with a magnet. */
export interface MagnetPocket {
  readonly diameterMm: number;
  readonly depthMm: number;
}

/**
 * Extra slab thickness (mm) a plate needs so a floor-sited screw can recess its
 * head and still retain material beneath it. Returns 0 when the plate already
 * has somewhere for the head to go.
 *
 * `existingFloorDepthMm` must be the floor the plate has WITHOUT this pad, or
 * the two feed back into each other and the plate grows on every recompute.
 *
 * The magnet case is not just "a deeper floor". Because a screw is placed
 * concentric with a magnet, the ø6.5 × 2mm magnet pocket IS the head recess: the
 * screw goes in first, the magnet drops in over it, and the 0.5mm retaining
 * floor below only has to pass the shaft. So no pad is needed at all, but only
 * while the head actually fits that envelope. A ø8 countersink is wider than the
 * pocket and a 3mm counterbore is deeper than it, so either one still has to buy
 * its own pad.
 */
export function screwPadThicknessMm(
  params: ScrewHoleParams,
  existingFloorDepthMm: number,
  magnetPocket?: MagnetPocket
): number {
  const recess = screwHeadRecessDepth(params);
  const headD = resolveScrewHeadDiameter(params.headStyle, params.headDiameter);

  if (
    magnetPocket !== undefined &&
    headD <= magnetPocket.diameterMm &&
    recess <= magnetPocket.depthMm
  ) {
    return 0;
  }

  const required = recess + SCREW_PAD_MIN_RETAIN_MM;
  return Math.max(0, required - existingFloorDepthMm);
}

/** Narrowest margin band (mm) that can host a head of this diameter. */
export function minBandForHead(headDiameterMm: number): number {
  return headDiameterMm + 2 * SCREW_MARGIN_MIN_WALL_MM;
}

/**
 * Where a screw's features sit, measured DOWN from the plate's top face.
 *
 * Expressed against that one datum because the two geometry layers disagree on
 * the origin: the BREP build puts the top face at Z=0 and grows downward, while
 * the direct-mesh draft puts the slab bottom at Z=0 and grows up. Each converts
 * once, at the edge, instead of open-coding a sign.
 *
 * A margin screw enters at the top face. A floor screw enters at the pocket
 * floor, which is `SOCKET_HEIGHT` below it, and both run out through the
 * underside so the screw can reach the drawer.
 */
export interface ScrewCutDepths {
  /** Depth of the entry plane below the top face. */
  readonly entryBelowTop: number;
  /** How far the head recess sinks below the entry plane. */
  readonly recessDepth: number;
  /** Depth of the underside below the entry plane, i.e. the shaft's run. */
  readonly throughDepth: number;
}

export function screwCutDepths(
  params: ScrewHoleParams,
  site: ScrewSite,
  socketHeightMm: number,
  totalHeightMm: number
): ScrewCutDepths {
  const entryBelowTop = site === 'margin' ? 0 : socketHeightMm;
  return {
    entryBelowTop,
    recessDepth: screwHeadRecessDepth(params),
    throughDepth: totalHeightMm - entryBelowTop,
  };
}

/**
 * Whether a disc of `radius` centred at (x, y) fits inside a rounded rectangle.
 * Shrinking the rectangle by the radius reduces this to a point-containment
 * test, corner arcs included, which is what stops a screw being placed in
 * material a large corner radius has already cut away.
 */
export function discFitsRoundedRect(
  x: number,
  y: number,
  halfW: number,
  halfD: number,
  cornerR: number,
  radius: number
): boolean {
  const hw = halfW - radius;
  const hd = halfD - radius;
  if (hw <= 0 || hd <= 0) return false;
  // A corner radius can never exceed half the shorter side; a caller passing a
  // larger one (the max-radius bound used for edge anchors) would otherwise put
  // the arc centre outside the rectangle and invert the test.
  const clampedCornerR = Math.min(cornerR, halfW, halfD);
  const r = Math.max(0, Math.min(clampedCornerR - radius, hw, hd));
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax > hw || ay > hd) return false;
  const dx = ax - (hw - r);
  const dy = ay - (hd - r);
  if (dx <= 0 || dy <= 0) return true;
  return Math.hypot(dx, dy) <= r;
}

/** Unit direction of an anchor: 0 on an axis means "centred on that axis". */
function anchorSigns(anchor: ScrewAnchor): readonly [number, number] {
  switch (anchor) {
    case 'bl':
      return [-1, -1];
    case 'br':
      return [1, -1];
    case 'tr':
      return [1, 1];
    case 'tl':
      return [-1, 1];
    case 'b':
      return [0, -1];
    case 'r':
      return [1, 0];
    case 't':
      return [0, 1];
    case 'l':
      return [-1, 0];
  }
}

/** Band width on each side an anchor touches; 0 where it touches none. */
function anchorBands(
  anchor: ScrewAnchor,
  bands: ScrewMarginBands
): { readonly xBand: number; readonly yBand: number } {
  const [sx, sy] = anchorSigns(anchor);
  const xBand = sx === 0 ? 0 : sx < 0 ? bands.left : bands.right;
  const yBand = sy === 0 ? 0 : sy < 0 ? bands.front : bands.back;
  return { xBand, yBand };
}

/** Corner radius nearest an anchor, used for the containment test. */
function anchorCornerRadius(anchor: ScrewAnchor, radii: ScrewCornerRadii | undefined): number {
  if (radii === undefined) return 0;
  const [sx, sy] = anchorSigns(anchor);
  // An edge-midpoint anchor sits far from every arc, so the largest radius is a
  // safe bound without needing to know which corner it drifts toward.
  if (sx === 0 || sy === 0) return Math.max(radii.tl, radii.tr, radii.bl, radii.br);
  if (sx < 0) return sy < 0 ? radii.bl : radii.tl;
  return sy < 0 ? radii.br : radii.tr;
}

/**
 * Which way a floor snap leans when two candidates are equidistant (#3698).
 *
 * Mirror symmetry is not on the table: a magnet sits at `cellCenter ±
 * HOLE_OFFSET`, so nothing ever lands on a centreline for one screw to sit on.
 * The lean instead makes the SET invariant under a HALF-TURN, the symmetry a
 * rectangular piece can have and the one `preferIdenticalPieces` already relies
 * on. So opposite anchors lean opposite ways, and a corner leans outboard along
 * its own diagonal, which its half-turn partner mirrors.
 */
export function screwSnapPreference(anchor: ScrewAnchor): readonly [number, number] {
  const [sx, sy] = anchorSigns(anchor);
  // An edge midpoint is free along the axis it does not name. Turning the
  // anchor's own direction a quarter turn selects that axis and hands 'b'/'t'
  // (and 'l'/'r') the opposing leans a half-turn demands. A corner names both
  // axes, so it keeps its own direction.
  if (sx === 0 || sy === 0) return [sy, sx === 0 ? 0 : -sx];
  return [sx, sy];
}

/** The ideal point for an anchor, used as the floor snap target. */
function anchorTarget(
  anchor: ScrewAnchor,
  halfW: number,
  halfD: number
): readonly [number, number] {
  const [sx, sy] = anchorSigns(anchor);
  return [sx * halfW, sy * halfD];
}

/**
 * Hole centre for an anchor riding the margin, or undefined when neither
 * adjacent band can host the head.
 *
 * Rides the wider band, centred across its width and pushed toward the anchor
 * along the run, so a corner screw lands in the corner of the L-shaped margin
 * rather than drifting down one arm.
 */
function marginPosition(
  anchor: ScrewAnchor,
  input: ScrewPieceInput,
  headDiameterMm: number
): readonly [number, number] | undefined {
  const { xBand, yBand } = anchorBands(anchor, input.bands);
  const needed = minBandForHead(headDiameterMm);
  if (xBand < needed && yBand < needed) return undefined;

  const [sx, sy] = anchorSigns(anchor);
  const halfW = input.widthMm / 2;
  const halfD = input.depthMm / 2;
  const endInset = headDiameterMm / 2 + SCREW_MARGIN_MIN_WALL_MM;

  const useX = xBand >= yBand && xBand >= needed;
  const x = useX ? sx * (halfW - xBand / 2) : sx * (halfW - endInset);
  const y = useX ? sy * (halfD - endInset) : sy * (halfD - yBand / 2);
  return [x, y];
}

/**
 * Assign every anchor a site from DIMENSIONS ALONE.
 *
 * This is the height-critical half of planning and it deliberately takes no
 * collision callbacks. Band widths, over-tile and corner radii are all known
 * early and deterministically; connector collisions are not, and letting one
 * flip an anchor to the floor would make the plate 3.1mm taller because a screw
 * moved. See {@link planPieceScrews} for the invariant that follows from this.
 */
function assignAnchorSites(params: ScrewHoleParams, input: ScrewPieceInput): readonly ScrewSlot[] {
  const headDiameterMm = resolveScrewHeadDiameter(params.headStyle, params.headDiameter);
  const headRadius = headDiameterMm / 2;
  const halfW = input.widthMm / 2;
  const halfD = input.depthMm / 2;

  return SCREW_ANCHORS.map((anchor) => {
    const cornerR = anchorCornerRadius(anchor, input.cornerRadii);
    const margin = marginPosition(anchor, input, headDiameterMm);
    if (
      margin !== undefined &&
      discFitsRoundedRect(margin[0], margin[1], halfW, halfD, cornerR, headRadius) &&
      input.isInsidePerimeter?.(margin[0], margin[1], headRadius) !== false
    ) {
      return { anchor, site: 'margin', target: margin } as const;
    }
    return { anchor, site: 'floor', target: anchorTarget(anchor, halfW, halfD) } as const;
  });
}

function needsFloorPad(assignments: readonly ScrewSlot[], wanted: number): boolean {
  return assignments.slice(0, wanted).some((slot) => slot.site === 'floor');
}

function wantedScrewCount(params: ScrewHoleParams): number {
  const requested = params.screwsPerPiece ?? SCREWS_PER_PIECE_DEFAULT;
  return Math.min(Math.max(0, requested), SCREWS_PER_PIECE_MAX, SCREW_ANCHORS.length);
}

/**
 * Fill up to `screwsPerPiece` slots on one piece.
 *
 * Walks {@link SCREW_ANCHORS} in order and skips any anchor that is not legal,
 * so a corner a connector owns shifts the screw to the next anchor rather than
 * being silently lost. Anchors are never reused, so a count above the anchor
 * list is capped rather than stacking two holes on one spot.
 *
 * INVARIANT: blocking prunes, it never re-sites. When the piece's nominal
 * anchors all fit margins the plate carries no floor pad, so a later anchor that
 * would have been floor-sited is dropped rather than placed into material that
 * was never provisioned for it. That is what keeps the plate's printed height a
 * pure function of its dimensions.
 *
 * Floor targets are still only IDEAL points here. The geometry layer snaps each
 * to the nearest legal magnet position and owns the containment check for the
 * snapped result; this function has already done that check for margin slots.
 */
export function planPieceScrews(
  params: ScrewHoleParams,
  input: ScrewPieceInput
): readonly ScrewSlot[] {
  if (!params.enabled) return [];

  const wanted = wantedScrewCount(params);
  const assignments = assignAnchorSites(params, input);
  const floorPadProvisioned = input.floorPadProvisioned ?? needsFloorPad(assignments, wanted);
  const headRadius = resolveScrewHeadDiameter(params.headStyle, params.headDiameter) / 2;

  const slots: ScrewSlot[] = [];

  for (const slot of assignments) {
    if (slots.length >= wanted) break;

    if (slot.site === 'margin') {
      if (input.isBlocked?.(slot.target[0], slot.target[1], headRadius) === true) continue;
    } else if (!floorPadProvisioned) {
      // No pad was provisioned, so there is no material here to cut into.
      continue;
    }

    slots.push(slot);
  }

  return slots;
}
