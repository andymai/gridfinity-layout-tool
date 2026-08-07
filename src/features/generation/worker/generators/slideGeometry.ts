/**
 * Sliding-tray geometry resolver.
 *
 * Pure and separate from the BREP builders so the relationship that actually
 * matters — that the tray is narrower than the track it runs in, by the
 * clearance, on every face — can be asserted without a kernel. Both the rail
 * fused onto the bin and the companion tray are derived from ONE call here, so
 * they cannot disagree about where the bearing surfaces are.
 *
 * Neither mount uses a tongue-and-groove. The tray's own floor is the runner:
 *
 *  - `interior` — two ledges protrude inward from the front/back walls. The
 *    tray's floor rests on them and the walls above the ledges guide it in Y.
 *  - `rim` — two strips stand on the front/back wall tops. The tray's floor
 *    bridges the opening, resting on the wall tops, guided in Y by the strips.
 *    Because it sits above every wall, it crosses to an adjacent railed bin.
 *
 * Fewer mating faces means fewer places for a fit to go wrong, and nothing
 * here needs support material.
 */

import { LIP_HEIGHT, LIP_TAPER_WIDTH, BOX_CORNER_RADIUS } from './generatorConstants';
import type { SlideConfig } from '@/shared/types/bin';

/** One rail bar, as an axis-aligned box in bin-centred mm. */
export interface SlideRailBar {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly zMin: number;
  readonly zMax: number;
}

export interface SlideGeometry {
  /** Front and back rail bars. Empty when the config cannot produce a rail. */
  readonly rails: readonly SlideRailBar[];
  /** Companion tray outer footprint and height, in mm. */
  readonly tray: {
    readonly widthMm: number;
    readonly depthMm: number;
    readonly heightMm: number;
    readonly wallMm: number;
    /** Z the tray's underside sits at when placed on its track. */
    readonly restZ: number;
  } | null;
  /**
   * Why no geometry was produced, for the caller to surface. `null` when the
   * resolve succeeded.
   */
  readonly rejection: SlideRejection | null;
}

export type SlideRejection =
  'disabled' | 'bin-too-shallow' | 'bin-too-narrow' | 'tray-too-thin' | 'rail-below-floor';

export interface SlideGeometryInput {
  readonly slide: SlideConfig;
  readonly innerW: number;
  readonly innerD: number;
  readonly outerW: number;
  readonly outerD: number;
  readonly wallThickness: number;
  readonly wallHeight: number;
  readonly collarHeight: number;
  readonly hasLip: boolean;
  readonly gridUnitMmX: number;
}

/** Smallest tray wall-to-wall interior that is worth generating, mm. */
const MIN_TRAY_INTERIOR_MM = 2;

/**
 * How far a `rim` strip is sunk below the nominal lip top so it always welds.
 *
 * The lip's peak is filleted (`TOP_FILLET`), so the surface actually sits ~0.1mm
 * below `wallHeight + LIP_HEIGHT`. A strip placed at the nominal height floats
 * clear of it and fuses as a DISCONNECTED island: still watertight, still the
 * right bounding box, still passes every structural assertion, and the tray
 * would ride on a part that falls off the print. The margin is buried inside
 * the lip, so the track's height above the rim is unchanged.
 */
const RAIL_FUSION_MARGIN_MM = 0.5;

/**
 * Highest an `interior` rail's top may sit.
 *
 * The stacking lip reaches `LIP_TAPER_WIDTH` BELOW its own base plane for the
 * angled support that blends it into the wall, so a rail placed against the
 * rim lands inside that taper: it either fuses into the lip and back-fills it
 * (the foot stops seating in a baseplate) or comes out silently thinner than
 * asked for. Neither is visible to a bounding-box or watertight check.
 */
export function interiorRailCeiling(wallHeight: number, hasLip: boolean): number {
  return hasLip ? wallHeight - LIP_TAPER_WIDTH : wallHeight;
}

/** Z the `rim` track stands on: the wall top, or the lip's top when there is one. */
export function rimTrackBaseZ(wallHeight: number, collarHeight: number, hasLip: boolean): number {
  return wallHeight + collarHeight + (hasLip ? LIP_HEIGHT : 0);
}

export function resolveSlideGeometry(input: SlideGeometryInput): SlideGeometry {
  const { slide, innerW, innerD, outerD, wallThickness, wallHeight } = input;
  const none = (rejection: SlideRejection): SlideGeometry => ({
    rails: [],
    tray: null,
    rejection,
  });

  if (!slide.enabled) return none('disabled');

  const protrusion = slide.railProtrusionMm;
  const thickness = slide.railThicknessMm;
  const clearance = slide.clearanceMm;

  const trayWidth = slide.trayWidthUnits * input.gridUnitMmX - clearance;
  if (trayWidth <= MIN_TRAY_INTERIOR_MM) return none('bin-too-narrow');

  if (slide.railMount === 'interior') {
    const ceiling = interiorRailCeiling(wallHeight, input.hasLip);
    const railTop = Math.min(ceiling, wallHeight - slide.railDropMm);
    const railBottom = railTop - thickness;
    // The rail must stand clear of the floor slab, or it is a solid block
    // filling the cavity rather than a ledge.
    if (railBottom <= wallThickness) return none('rail-below-floor');

    // Tray runs BETWEEN the front and back walls, riding on the ledges.
    const trayDepth = innerD - 2 * clearance;
    if (trayDepth - 2 * slide.trayWallMm <= MIN_TRAY_INTERIOR_MM) return none('bin-too-shallow');
    // Overlap onto each ledge must leave the tray with a floor between them.
    if (protrusion * 2 >= trayDepth) return none('bin-too-shallow');

    const rails: SlideRailBar[] = [
      {
        xMin: -innerW / 2,
        xMax: innerW / 2,
        yMin: -innerD / 2,
        yMax: -innerD / 2 + protrusion,
        zMin: railBottom,
        zMax: railTop,
      },
      {
        xMin: -innerW / 2,
        xMax: innerW / 2,
        yMin: innerD / 2 - protrusion,
        yMax: innerD / 2,
        zMin: railBottom,
        zMax: railTop,
      },
    ];

    return {
      rails,
      tray: {
        widthMm: trayWidth,
        depthMm: trayDepth,
        heightMm: slide.trayDepthMm,
        wallMm: slide.trayWallMm,
        restZ: railTop + clearance,
      },
      rejection: null,
    };
  }

  // `rim`: strips stand on the wall tops at the OUTER edge, so the channel
  // between them is the full opening plus both wall thicknesses. The tray
  // bridges it, resting on the wall tops.
  const baseZ = rimTrackBaseZ(wallHeight, input.collarHeight, input.hasLip);
  // Keep the strips on the straight part of the wall: the footprint's corners
  // are arcs of BOX_CORNER_RADIUS, and a bar run into them would hang off the
  // silhouette. Stopping short also leaves the corner clear for the neighbour's
  // strip to pick up the track.
  const xEnd = input.outerW / 2 - BOX_CORNER_RADIUS;
  if (xEnd <= 0) return none('bin-too-narrow');

  const stripInnerY = outerD / 2 - wallThickness;
  const channel = 2 * stripInnerY;
  const trayDepth = channel - 2 * clearance;
  if (trayDepth - 2 * slide.trayWallMm <= MIN_TRAY_INTERIOR_MM) return none('bin-too-shallow');

  const rails: SlideRailBar[] = [
    {
      xMin: -xEnd,
      xMax: xEnd,
      yMin: -outerD / 2,
      yMax: -stripInnerY,
      zMin: baseZ - RAIL_FUSION_MARGIN_MM,
      zMax: baseZ + thickness,
    },
    {
      xMin: -xEnd,
      xMax: xEnd,
      yMin: stripInnerY,
      yMax: outerD / 2,
      zMin: baseZ - RAIL_FUSION_MARGIN_MM,
      zMax: baseZ + thickness,
    },
  ];

  return {
    rails,
    tray: {
      widthMm: trayWidth,
      depthMm: trayDepth,
      heightMm: slide.trayDepthMm,
      wallMm: slide.trayWallMm,
      restZ: baseZ,
    },
    rejection: null,
  };
}
