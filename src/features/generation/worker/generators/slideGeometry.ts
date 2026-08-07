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
 *  - `rim` — the same L, lifted to sit on top of the stacking lip: a shelf
 *    reaches inward over the opening and a guide stands outboard of it. The
 *    tray rides above every wall, so it crosses to an adjacent railed bin.
 *
 * Both mounts are therefore the same L-section rail (shelf to carry, guide to
 * locate) at two heights, and both hold the SAME bearing overlap,
 * `railProtrusionMm - clearanceMm`. An earlier `rim` sat the strips on the wall
 * band with the tray between them, which left the tray narrower than the
 * opening: it rested on nothing, dropped onto the lip's taper and was never
 * touched by the strips at all.
 *
 * Fewer mating faces means fewer places for a fit to go wrong, and nothing
 * here needs support material.
 */

import { LIP_HEIGHT, LIP_TAPER_WIDTH, BOX_CORNER_RADIUS } from './generatorConstants';
import type { SlideConfig } from '@/shared/types/bin';

/**
 * One rail, as a cross-section in the YZ plane swept along X.
 *
 * A section rather than a box because a shelf's underside is chamfered 45deg
 * back to the wall it grows from. A square shelf is a 90deg cantilever running
 * the full length of the bin, which slicers can only produce with support or a
 * drooping first layer, and it measured ~490mm2 of support-needing area on a
 * 3-wide bin. The chamfer removes all of it.
 */
export interface SlideRailSection {
  readonly xMin: number;
  readonly xMax: number;
  /** Closed polygon of [y, z] points in bin-centred mm. */
  readonly section: readonly (readonly [number, number])[];
}

/** YZ extent of a rail section, for callers that only need its envelope. */
export function sectionBounds(bar: SlideRailSection): {
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
} {
  const ys = bar.section.map(([y]) => y);
  const zs = bar.section.map(([, z]) => z);
  return {
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
    zMin: Math.min(...zs),
    zMax: Math.max(...zs),
  };
}

/** Axis-aligned box helper, for the parts that genuinely are boxes. */
export function boxSection(
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number
): SlideRailSection {
  return {
    xMin,
    xMax,
    section: [
      [yMin, zMin],
      [yMax, zMin],
      [yMax, zMax],
      [yMin, zMax],
    ],
  };
}

/**
 * A shelf growing inward from a wall, with its underside chamfered 45deg back
 * to that wall so nothing overhangs.
 *
 * @param wallY   the wall face the shelf grows from
 * @param inward  +1 when the shelf reaches toward +Y, -1 toward -Y
 * @param reach   how far it protrudes from the wall
 * @param top     Z of the bearing face
 * @param tip     thickness at the free tip
 * @param sink    extra depth at the wall, to bury the root in what it welds to
 */
export function shelfSection(
  xMin: number,
  xMax: number,
  wallY: number,
  inward: -1 | 1,
  reach: number,
  top: number,
  tip: number,
  sink = 0
): SlideRailSection {
  const tipY = wallY + inward * reach;
  return {
    xMin,
    xMax,
    section: [
      [wallY, top],
      [tipY, top],
      [tipY, top - tip],
      // 45deg run back to the wall: drop equals reach.
      [wallY, top - tip - reach - sink],
    ],
  };
}

export interface SlideGeometry {
  /** Rail sections swept along X. Empty when the config produces no rail. */
  readonly rails: readonly SlideRailSection[];
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
  | 'disabled'
  | 'bin-too-shallow'
  | 'bin-too-narrow'
  | 'tray-too-thin'
  | 'rail-below-floor'
  | 'no-bearing'
  /** Slotted bins carry divider slots on the very walls the rail runs along. */
  | 'slot-conflict'
  /** Custom-shape (cellMask) bins: the rail has no polygon-edge mapping yet. */
  | 'unsupported-shape'
  /** A solid bin has no cavity, so a tray has nowhere to sit. */
  | 'no-cavity';

export interface SlideGeometryInput {
  readonly slide: SlideConfig;
  /** Style/shape gates. Resolved here so the panel and the worker agree. */
  readonly isSlotted?: boolean;
  readonly isSolid?: boolean;
  readonly isPolygon?: boolean;
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

/**
 * Resolver input from bin params plus resolved dimensions.
 *
 * Shared by the rail builder and the wall-pattern keep-out so the band the
 * pattern clears is derived from the SAME rail the pipeline fuses. Deriving it
 * twice is how a keep-out drifts off the thing it is protecting.
 */
export function slideInputFromDims(
  params: {
    slide: SlideConfig;
    wallThickness: number;
    cellMask?: unknown;
  },
  dim: {
    innerW: number;
    innerD: number;
    outerW: number;
    outerD: number;
    wallHeight: number;
    collarHeight: number;
    hasLip: boolean;
    gridUnitMmX: number;
    isSlotted: boolean;
    solid: boolean;
  },
  isPolygon: boolean
): SlideGeometryInput {
  return {
    slide: params.slide,
    isSlotted: dim.isSlotted,
    isSolid: dim.solid,
    isPolygon,
    innerW: dim.innerW,
    innerD: dim.innerD,
    outerW: dim.outerW,
    outerD: dim.outerD,
    wallThickness: params.wallThickness,
    wallHeight: dim.wallHeight,
    collarHeight: dim.collarHeight,
    hasLip: dim.hasLip,
    gridUnitMmX: dim.gridUnitMmX,
  };
}

export function resolveSlideGeometry(input: SlideGeometryInput): SlideGeometry {
  const { slide, innerW, innerD, outerD, wallThickness, wallHeight } = input;
  const none = (rejection: SlideRejection): SlideGeometry => ({
    rails: [],
    tray: null,
    rejection,
  });

  if (!slide.enabled) return none('disabled');

  // Style gates, resolved before any geometry so the panel can explain a bin
  // that produces nothing rather than leaving the user to guess.
  //
  // Slotted is the subtle one: `slotBuilder` cuts divider slots into the FRONT
  // and BACK walls, which is exactly where the rail runs, and the pipeline cuts
  // after it fuses — so the slots would notch the rail's bearing face.
  if (input.isSolid === true) return none('no-cavity');
  if (input.isSlotted === true) return none('slot-conflict');
  if (input.isPolygon === true) return none('unsupported-shape');

  const protrusion = slide.railProtrusionMm;
  const thickness = slide.railThicknessMm;
  const clearance = slide.clearanceMm;

  // The tray is held back from each guide by the clearance, so a shelf that
  // reaches in less than that carries nothing: the tray passes straight by it.
  // Same relationship for both mounts, which is why it is checked once here.
  if (protrusion <= clearance) return none('no-bearing');

  const trayWidth = slide.trayWidthUnits * input.gridUnitMmX - clearance;
  if (trayWidth <= MIN_TRAY_INTERIOR_MM) return none('bin-too-narrow');
  // Walls are checked against BOTH axes. Only checking depth let a thick wall
  // on a narrow tray collapse the cavity in X, and the builder then returned
  // the un-hollowed outer solid: a printable block that the resolver still
  // reported as a tray.
  if (trayWidth - 2 * slide.trayWallMm <= MIN_TRAY_INTERIOR_MM) return none('tray-too-thin');

  if (slide.railMount === 'interior') {
    const ceiling = interiorRailCeiling(wallHeight, input.hasLip);
    const railTop = Math.min(ceiling, wallHeight - slide.railDropMm);
    // The gusset's 45deg underside runs `protrusion` back to the wall, so the
    // rail reaches this far down where it meets the wall.
    const railBottom = railTop - thickness - protrusion;
    // The rail must stand clear of the floor slab, or it is a solid block
    // filling the cavity rather than a ledge.
    if (railBottom <= wallThickness) return none('rail-below-floor');

    // Tray runs BETWEEN the front and back walls, riding on the ledges.
    const trayDepth = innerD - 2 * clearance;
    if (trayDepth - 2 * slide.trayWallMm <= MIN_TRAY_INTERIOR_MM) return none('bin-too-shallow');
    // Overlap onto each ledge must leave the tray with a floor between them.
    if (protrusion * 2 >= trayDepth) return none('bin-too-shallow');

    const rails: SlideRailSection[] = [
      shelfSection(-innerW / 2, innerW / 2, -innerD / 2, 1, protrusion, railTop, thickness),
      shelfSection(-innerW / 2, innerW / 2, innerD / 2, -1, protrusion, railTop, thickness),
    ];

    return {
      rails,
      tray: {
        widthMm: trayWidth,
        depthMm: trayDepth,
        heightMm: slide.trayDepthMm,
        wallMm: slide.trayWallMm,
        // Resting ON the shelf, not floating a clearance above it: clearance
        // is a SIDE gap, and gravity settles the tray onto its shelf. Both
        // mounts report the shelf top so the bearing check reads the same.
        restZ: railTop,
      },
      rejection: null,
    };
  }

  // `rim`: the interior L lifted onto the lip. The shelf reaches inward over
  // the opening to carry the tray; the guide stands on the wall band outboard
  // of it to locate the tray in Y. Sitting above every wall is what lets the
  // tray cross to a neighbouring railed bin.
  const baseZ = rimTrackBaseZ(wallHeight, input.collarHeight, input.hasLip);
  // Keep the bars on the straight part of the wall: the footprint's corners are
  // arcs of BOX_CORNER_RADIUS, and a bar run into them would hang off the
  // silhouette. The gap is also what lets a neighbour's rail pick the track up.
  const xEnd = input.outerW / 2 - BOX_CORNER_RADIUS;
  if (xEnd <= 0) return none('bin-too-narrow');

  const innerHalf = innerD / 2;
  const shelfInnerY = innerHalf - protrusion;
  if (shelfInnerY <= 0) return none('bin-too-shallow');

  const shelfTop = baseZ + thickness;
  const trayDepth = innerD - 2 * clearance;
  if (trayDepth - 2 * slide.trayWallMm <= MIN_TRAY_INTERIOR_MM) return none('bin-too-shallow');

  const rails: SlideRailSection[] = [
    // Shelves reach inward over the opening, chamfered back to the wall, and
    // sink into the lip so they weld (see RAIL_FUSION_MARGIN_MM).
    shelfSection(
      -xEnd,
      xEnd,
      -innerHalf,
      1,
      protrusion,
      shelfTop,
      thickness,
      RAIL_FUSION_MARGIN_MM
    ),
    shelfSection(
      -xEnd,
      xEnd,
      innerHalf,
      -1,
      protrusion,
      shelfTop,
      thickness,
      RAIL_FUSION_MARGIN_MM
    ),
    // Guides stand on the wall band only, so they never overhang the opening
    // and the tray's edge runs against their inner faces.
    boxSection(-xEnd, xEnd, -outerD / 2, -innerHalf, shelfTop, shelfTop + thickness),
    boxSection(-xEnd, xEnd, innerHalf, outerD / 2, shelfTop, shelfTop + thickness),
  ];

  return {
    rails,
    tray: {
      widthMm: trayWidth,
      depthMm: trayDepth,
      heightMm: slide.trayDepthMm,
      wallMm: slide.trayWallMm,
      restZ: shelfTop,
    },
    rejection: null,
  };
}

/**
 * The band a wall pattern must keep clear so the rail survives.
 *
 * The pipeline fuses before it pattern-cuts, so a hex pattern carves straight
 * through an already-fused rail and the feature silently ceases to exist. This
 * is the gotcha-5 rule (any feature living on a wall needs a matching keep-out)
 * applied to the rail; `buildHandleClipBoxes` adds CUTOUT_BORDER_WIDTH around
 * whatever it is given, so the rail also gets solid material to bond to.
 *
 * Returns null when this wall carries no rail. Only the front and back walls
 * ever do — the rail runs along X.
 */
export function slidePatternKeepOut(
  geometry: SlideGeometry,
  side: string
): { readonly centerZ: number; readonly height: number; readonly width: number } | null {
  if (side !== 'front' && side !== 'back') return null;
  if (geometry.rails.length === 0) return null;
  const bounds = geometry.rails.map(sectionBounds);
  const zMin = Math.min(...bounds.map((b) => b.zMin));
  const zMax = Math.max(...bounds.map((b) => b.zMax));
  const width = Math.max(...geometry.rails.map((r) => r.xMax - r.xMin));
  return { centerZ: (zMin + zMax) / 2, height: zMax - zMin, width };
}
