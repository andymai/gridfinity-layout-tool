/**
 * Mount-down screw hole planning (#3425) — pure geometry, no BREP kernel.
 *
 * Owns the ONE decision every layer has to agree on: for each screw, does it sit
 * in the solid drawer-fit margin, or does it fall back to the pocket floor?
 * That choice drives the plate's printed height, so it is resolved once at PLATE
 * level and handed down, never re-derived per piece.
 *
 * Why plate level: each split piece is generated from its own params, but the
 * pieces have to assemble flush. An interior piece has no margin at all, so it
 * always needs the pocket-floor fallback — and if any one piece needs the pad,
 * every piece must carry the same taller slab or the assembled plate is stepped.
 *
 * This module deliberately does NOT resolve a floor site to millimetres. Those
 * positions come from `magnetPositionsForCell` (features/generation), which is
 * also what the magnets, the lightweight pads and the bin base all use; keeping
 * one source for them is what stops the shelf-off-its-wall class of bug where
 * three layers each compute "the same" position slightly differently.
 */

import {
  SCREW_COUNTERBORE_DEFAULT_DEPTH_MM,
  SCREW_COUNTERBORE_DEFAULT_DIAMETER_MM,
  SCREW_COUNTERSINK_DEFAULT_DIAMETER_MM,
  SCREW_COUNTERSINK_INCLUDED_ANGLE_DEG,
  SCREW_PAD_MIN_RETAIN_MM,
  SCREWS_PER_PIECE_DEFAULT,
} from '@/core/constants';
import type { ScrewHeadStyle, ScrewHoleParams } from '@/core/types/baseplate';

/**
 * Plastic kept between a head recess and the edges of the margin band it sits
 * in. One extrusion width at a 0.4mm nozzle would be too optimistic for a
 * feature the user drives a screw through, so this is three.
 */
export const SCREW_MARGIN_MIN_WALL_MM = 1.2;

/** Which material a screw passes through. */
export type ScrewSite = 'margin' | 'floor';

/** The four corners of a piece, in the order holes are assigned. */
export const SCREW_CORNERS = ['bl', 'br', 'tr', 'tl'] as const;
export type ScrewCorner = (typeof SCREW_CORNERS)[number];

/** A margin-sited screw carries its position; a floor-sited one is resolved to
 * millimetres later, by the layer that owns `magnetPositionsForCell`. */
export type ScrewPlacement =
  | {
      readonly site: 'margin';
      readonly corner: ScrewCorner;
      readonly x: number;
      readonly y: number;
    }
  | { readonly site: 'floor'; readonly corner: ScrewCorner };

export interface ScrewPiecePlan {
  readonly placements: readonly ScrewPlacement[];
  /** Corners that had no legal position at all and carry no screw. */
  readonly dropped: readonly ScrewCorner[];
}

/** Per-side solid margin band widths (mm) available on a piece. */
export interface ScrewMarginBands {
  readonly left: number;
  readonly right: number;
  readonly front: number;
  readonly back: number;
}

export interface ScrewPieceInput {
  /** Piece footprint in mm, excluding nothing — the full printed extent. */
  readonly widthMm: number;
  readonly depthMm: number;
  readonly bands: ScrewMarginBands;
  /**
   * True when a candidate position collides with something that owns that
   * material: a connector tongue or groove, a seam, or the outside of a shaped
   * perimeter. Coordinates are piece-centred mm; `radius` is the head radius.
   */
  readonly isBlocked?: (x: number, y: number, radius: number) => boolean;
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
 * The magnet case is not just "a deeper floor". Because a screw is placed
 * concentric with a magnet, the ø6.5 × 2mm magnet pocket IS the head recess: the
 * screw goes in first, the magnet drops in over it, and the 0.5mm retaining
 * floor below only has to pass the shaft. So no pad is needed at all — but only
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

/** The two bands adjacent to a corner, nearest-first along X then Y. */
function cornerBands(
  corner: ScrewCorner,
  bands: ScrewMarginBands
): { readonly xBand: number; readonly yBand: number } {
  const xBand = corner === 'bl' || corner === 'tl' ? bands.left : bands.right;
  const yBand = corner === 'bl' || corner === 'br' ? bands.front : bands.back;
  return { xBand, yBand };
}

/** Sign of a corner along each axis (-1 = low side, +1 = high side). */
function cornerSigns(corner: ScrewCorner): readonly [number, number] {
  const sx = corner === 'bl' || corner === 'tl' ? -1 : 1;
  const sy = corner === 'bl' || corner === 'br' ? -1 : 1;
  return [sx, sy];
}

/**
 * Place one corner's screw in the margin if either adjacent band can host it.
 *
 * Prefers the wider band, and sits the hole centred across that band's width and
 * inset from the piece's end by the same clearance — so the screw lands in the
 * corner of the L-shaped margin rather than drifting down one arm.
 */
function planMarginPlacement(
  corner: ScrewCorner,
  input: ScrewPieceInput,
  headDiameterMm: number
): ScrewPlacement | undefined {
  const { xBand, yBand } = cornerBands(corner, input.bands);
  const needed = minBandForHead(headDiameterMm);
  if (xBand < needed && yBand < needed) return undefined;

  const [sx, sy] = cornerSigns(corner);
  const halfW = input.widthMm / 2;
  const halfD = input.depthMm / 2;
  const endInset = headDiameterMm / 2 + SCREW_MARGIN_MIN_WALL_MM;

  // Ride the wider band; the hole is centred across it and pushed toward the
  // corner along the run.
  const useX = xBand >= yBand;
  const x = useX ? sx * (halfW - xBand / 2) : sx * (halfW - endInset);
  const y = useX ? sy * (halfD - endInset) : sy * (halfD - yBand / 2);

  if (input.isBlocked?.(x, y, headDiameterMm / 2) === true) return undefined;
  return { site: 'margin', corner, x, y };
}

/**
 * Decide a site for every screw on one piece.
 *
 * Each corner tries the margin first, then falls back to the pocket floor. A
 * corner is only dropped when the margin cannot host it AND the caller reports
 * the floor candidate blocked too — the caller owns that test because floor
 * positions are resolved against `magnetPositionsForCell` downstream.
 *
 * `screwsPerPiece` above four repeats the corner cycle, so a long piece can take
 * eight by going round twice; the geometry layer walks inward for the repeats.
 */
export function planPieceScrews(
  params: ScrewHoleParams,
  input: ScrewPieceInput,
  floorBlocked?: (corner: ScrewCorner) => boolean
): ScrewPiecePlan {
  const count = params.screwsPerPiece ?? SCREWS_PER_PIECE_DEFAULT;
  const headDiameterMm = resolveScrewHeadDiameter(params.headStyle, params.headDiameter);

  const placements: ScrewPlacement[] = [];
  const dropped: ScrewCorner[] = [];

  for (let i = 0; i < count; i++) {
    const corner = SCREW_CORNERS[i % SCREW_CORNERS.length];
    const margin = planMarginPlacement(corner, input, headDiameterMm);
    if (margin !== undefined) {
      placements.push(margin);
      continue;
    }
    if (floorBlocked?.(corner) === true) {
      dropped.push(corner);
      continue;
    }
    placements.push({ site: 'floor', corner });
  }

  return { placements, dropped };
}

/** True when any placement in a plate's plans needs the pocket-floor fallback. */
export function planNeedsFloorPad(plans: readonly ScrewPiecePlan[]): boolean {
  return plans.some((plan) => plan.placements.some((p) => p.site === 'floor'));
}

/**
 * Pad thickness (mm) for a whole plate: the pieces share one slab height, so a
 * single floor-sited screw anywhere makes every piece carry the pad. Returns 0
 * when every screw found a margin, which is the common unsplit, padded case.
 */
export function platePadThicknessMm(
  params: ScrewHoleParams,
  plans: readonly ScrewPiecePlan[],
  existingFloorDepthMm: number,
  magnetPocket?: MagnetPocket
): number {
  if (!planNeedsFloorPad(plans)) return 0;
  return screwPadThicknessMm(params, existingFloorDepthMm, magnetPocket);
}
