/**
 * Mount-down screw hole planning: pure geometry, no BREP kernel.
 *
 * Owns the ONE decision every layer has to agree on: for each screw, does it sit
 * in the solid drawer-fit margin, in the solid post where four pockets meet, or
 * does it fall back to the pocket floor? The floor costs height, and so does a
 * margin screw recessed deeper than the plate can retain, so whether any piece
 * has one is resolved once at PLATE level and handed down as the pad, never
 * re-derived per piece.
 *
 * Why plate level: each split piece is generated from its own params, but the
 * pieces have to assemble flush. A 1xN piece has neither a margin nor a
 * junction, so it needs the pocket-floor fallback, and if any one piece needs
 * the pad, every piece must carry the same taller slab or the assembled plate is
 * stepped.
 *
 * Every slot carries a `target` in piece-centred mm, whatever its site. A margin
 * or junction target IS the hole centre. A floor target is the IDEAL point, and
 * the geometry layer snaps it to the nearest legal `magnetPositionsForCell`
 * position. Stating the snap as one rule ("nearest magnet position to the
 * anchor") is what keeps the exact build, the draft mesh and the margin path
 * from each inventing their own "corner cell" and drifting apart.
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
  SCREW_COUNTERSINK_UNSET_DIAMETER_MM,
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

/**
 * Which material a screw passes through: the solid drawer-fit margin, the
 * solid post where four pockets meet (`junction`), or the pocket floor.
 */
export type ScrewSite = 'margin' | 'junction' | 'floor';

/**
 * A four-pocket junction whose post holds the head, in the same frame as the
 * floor candidates. `seatBelowTopMm` is where the head's top face sits: low
 * enough that a seated bin foot's rounded corner clears it.
 */
export interface ScrewJunctionSite {
  readonly x: number;
  readonly y: number;
  readonly seatBelowTopMm: number;
}

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
   * Piece-centred mm. Exact hole centre for a margin or junction slot; for a
   * floor slot the ideal point that the geometry layer snaps to the nearest
   * magnet position.
   */
  readonly target: readonly [number, number];
  /** Head seat depth below the top face, junction slots only. */
  readonly seatBelowTopMm?: number;
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
   * Junctions whose post holds this head, already fit-checked by the geometry
   * layer against the plate's height WITHOUT any screw pad. Absent ⇒ none.
   *
   * Consulted while ASSIGNING sites, like the perimeter: the cell grid and the
   * profile are known as early as padding. Checked against the unpadded height
   * so a site never depends on the pad it decides.
   */
  readonly junctions?: readonly ScrewJunctionSite[];
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
 * body's padding, and each detached rail is planned as its own piece. An edge
 * inset zeroes them too: the padding is under the drawer lip it keeps screws
 * away from.
 */
export function effectiveMarginBands(params: {
  readonly paddingLeft: number;
  readonly paddingRight: number;
  readonly paddingFront: number;
  readonly paddingBack: number;
  readonly overTile?: boolean;
  readonly screwHoles?: Pick<ScrewHoleParams, 'edgeInsetCells'>;
}): ScrewMarginBands {
  if (params.overTile === true || (params.screwHoles?.edgeInsetCells ?? 0) > 0) {
    return { left: 0, right: 0, front: 0, back: 0 };
  }
  return {
    left: params.paddingLeft,
    right: params.paddingRight,
    front: params.paddingFront,
    back: params.paddingBack,
  };
}

/**
 * Resolved head diameter for a style, honouring an explicit override. An
 * absent countersink width is {@link SCREW_COUNTERSINK_UNSET_DIAMETER_MM}, not
 * the default a new config starts at (see {@link defaultScrewHeadDiameter}).
 */
export function resolveScrewHeadDiameter(headStyle: ScrewHeadStyle, headDiameter?: number): number {
  if (headDiameter !== undefined) return headDiameter;
  return headStyle === 'countersink'
    ? SCREW_COUNTERSINK_UNSET_DIAMETER_MM
    : SCREW_COUNTERBORE_DEFAULT_DIAMETER_MM;
}

/** Head width a new config, or a switch to this style, starts at. */
export function defaultScrewHeadDiameter(headStyle: ScrewHeadStyle): number {
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
 * floor, `pocketDepthMm` below it. A junction screw's head seats `seatBelowTopMm`
 * down in the post, reached through a bore of the head's width that opens at the
 * top face and notches the four pocket corners. All of them run out through the
 * underside so the screw can reach the drawer.
 */
export interface ScrewCutDepths {
  /** Depth below the top face where the head-wide bore opens. */
  readonly openBelowTop: number;
  /** Depth of the entry plane (the head's top face) below the top face. */
  readonly entryBelowTop: number;
  /** How far the head recess sinks below the entry plane. */
  readonly recessDepth: number;
  /** Depth of the underside below the entry plane, i.e. the shaft's run. */
  readonly throughDepth: number;
}

export function screwCutDepths(
  params: ScrewHoleParams,
  site: ScrewSite,
  pocketDepthMm: number,
  totalHeightMm: number,
  seatBelowTopMm: number = 0
): ScrewCutDepths {
  const entryBelowTop =
    site === 'margin' ? 0 : site === 'junction' ? seatBelowTopMm : pocketDepthMm;
  return {
    openBelowTop: site === 'junction' ? 0 : entryBelowTop,
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

/** The ideal point for an anchor, used as the floor and junction snap target. */
function anchorTarget(
  anchor: ScrewAnchor,
  halfW: number,
  halfD: number
): readonly [number, number] {
  const [sx, sy] = anchorSigns(anchor);
  return [sx * halfW, sy * halfD];
}

/**
 * Squared-mm slack within which two candidates count as EQUIDISTANT, so the
 * lean decides between them rather than arrival order. Detecting the tie is the
 * point: the two magnets flanking a centreline are equidistant by construction,
 * so a strict `<` never reaches the lean at all.
 *
 * Compared against a SQUARED distance, so the slack it admits is `eps / 2r`,
 * not `sqrt(eps)`: ~0.04nm at an edge anchor's ~128mm², far under the lattice.
 */
const SNAP_TIE_EPSILON_MM2 = 1e-6;

/**
 * Index of the candidate nearest `target`, or -1 when there is none.
 *
 * Nearest alone is ambiguous: an edge-midpoint anchor ties exactly between the
 * two points flanking it, and taking the first leans every edge screw toward
 * one corner. Ties go to the candidate furthest along `lean`, which
 * {@link screwSnapPreference} supplies.
 */
export function nearestWithLean(
  target: readonly [number, number],
  lean: readonly [number, number],
  candidates: ReadonlyArray<readonly [number, number]>
): number {
  let bestIndex = -1;
  let bestDist = Number.POSITIVE_INFINITY;
  let bestLean = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < candidates.length; i++) {
    const dx = candidates[i][0] - target[0];
    const dy = candidates[i][1] - target[1];
    const d = dx * dx + dy * dy;
    if (d > bestDist + SNAP_TIE_EPSILON_MM2) continue;

    const along = dx * lean[0] + dy * lean[1];
    if (d < bestDist - SNAP_TIE_EPSILON_MM2 || along > bestLean) {
      bestDist = Math.min(bestDist, d);
      bestLean = along;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** Below this a coordinate counts as ON the centreline, in neither half. */
const CENTRELINE_EPSILON_MM = 1e-6;

/**
 * Whether a junction lies in the anchor's own quadrant (corner) or half (edge
 * midpoint), measured from the junction lattice's centre.
 *
 * Restricting each anchor to its own region is what keeps junction screws
 * spread and half-turn symmetric: the region maps onto its partner's under the
 * rotation, and a junction on a centreline (a 2xN piece's only row, or the
 * middle of an even piece) belongs to no corner, so a lone centre junction can
 * never pair one corner with a floor screw at the opposite one.
 */
function junctionInAnchorRegion(anchor: ScrewAnchor, x: number, y: number): boolean {
  const [sx, sy] = anchorSigns(anchor);
  return (
    (sx === 0 || x * sx > CENTRELINE_EPSILON_MM) && (sy === 0 || y * sy > CENTRELINE_EPSILON_MM)
  );
}

/**
 * Take the junction an anchor screws into, removing it from `available`, or
 * undefined when its region has none left.
 */
function takeJunction(
  anchor: ScrewAnchor,
  available: ScrewJunctionSite[],
  halfW: number,
  halfD: number
): ScrewJunctionSite | undefined {
  const inRegion = available.filter((j) => junctionInAnchorRegion(anchor, j.x, j.y));
  const pick = nearestWithLean(
    anchorTarget(anchor, halfW, halfD),
    screwSnapPreference(anchor),
    inRegion.map((j) => [j.x, j.y] as const)
  );
  if (pick < 0) return undefined;
  const junction = inRegion[pick];
  available.splice(available.indexOf(junction), 1);
  return junction;
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
 * Assign every anchor a site from DIMENSIONS ALONE: the margin when a band
 * hosts the head, else a junction in the anchor's own region, else the floor.
 *
 * This is the height-critical half of planning and it deliberately takes no
 * collision callbacks. Band widths, over-tile, corner radii and the junction
 * lattice are all known early and deterministically; connector collisions are
 * not, and letting one flip an anchor to the floor would make the plate 3.1mm
 * taller because a screw moved. See {@link planPieceScrews} for the invariant
 * that follows from this.
 */
function assignAnchorSites(params: ScrewHoleParams, input: ScrewPieceInput): readonly ScrewSlot[] {
  const headDiameterMm = resolveScrewHeadDiameter(params.headStyle, params.headDiameter);
  const headRadius = headDiameterMm / 2;
  const halfW = input.widthMm / 2;
  const halfD = input.depthMm / 2;
  const junctions = [...(input.junctions ?? [])];

  return SCREW_ANCHORS.map((anchor): ScrewSlot => {
    const cornerR = anchorCornerRadius(anchor, input.cornerRadii);
    const margin = marginPosition(anchor, input, headDiameterMm);
    if (
      margin !== undefined &&
      discFitsRoundedRect(margin[0], margin[1], halfW, halfD, cornerR, headRadius) &&
      input.isInsidePerimeter?.(margin[0], margin[1], headRadius) !== false
    ) {
      return { anchor, site: 'margin', target: margin };
    }
    const junction = takeJunction(anchor, junctions, halfW, halfD);
    if (junction !== undefined) {
      return {
        anchor,
        site: 'junction',
        target: [junction.x, junction.y],
        seatBelowTopMm: junction.seatBelowTopMm,
      };
    }
    return { anchor, site: 'floor', target: anchorTarget(anchor, halfW, halfD) };
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
 * anchors all fit margins or junctions the plate carries no floor pad, so a
 * later anchor that would have been floor-sited is dropped rather than placed
 * into material that was never provisioned for it. That is what keeps the
 * plate's printed height a pure function of its dimensions.
 *
 * Floor targets are still only IDEAL points here. The geometry layer snaps each
 * to the nearest legal magnet position and owns the containment check for the
 * snapped result; this function has already done that check for margin slots,
 * and the junction list arrives checked.
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

    if (slot.site !== 'floor') {
      if (input.isBlocked?.(slot.target[0], slot.target[1], headRadius) === true) continue;
    } else if (!floorPadProvisioned) {
      // No pad was provisioned, so there is no material here to cut into.
      continue;
    }

    slots.push(slot);
  }

  return slots;
}
