/**
 * Print estimate calculations for the bin designer.
 *
 * Analytically computes material volume from bin parameters,
 * then derives filament usage and print time estimates.
 *
 * Volume is computed as:
 *   shell + base socket + stacking lip + dividers + label tabs + scoop ramps
 *
 * This avoids expensive mesh-based volume integration.
 */

import type { BinParams } from '@/features/bin-designer/types';
import {
  binFloorMm,
  isSocketlessBase,
  isUndersideRelief,
} from '@/features/bin-designer/types/base';
import { baseWallHeight } from './binDimensions';
import { maxCompartmentFloorRaiseMm } from './compartmentFloorRaise';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import { getCompartmentBounds } from '@/features/bin-designer/utils/compartments';
import { isFeatureActive } from '@/shared/constraints';
import {
  PLA_DENSITY,
  FILAMENT_AREA_MM2,
  OVERHEAD_MINUTES,
  MINUTES_PER_METER,
  DEFAULT_PRINT_SETTINGS,
  scalePrintTime,
  standardBinSolidComponents,
  lightweightBaseSaving,
  integralFeetVolume,
  detachableFeetVolume,
  type PrintSettings,
} from '@/shared/printSettings';
import {
  compartmentHasTiltedEdge,
  hasDetachableFeet,
  isRectangularCompartment,
} from '@/shared/types/bin';
import { footKind, resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import {
  resolveScoopProfile,
  resolveScoopPlacement,
  resolveScoopSides,
  computeLipOffset,
  computeInteriorHeight,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import { countFilled, isPartialMask } from '@/shared/utils/cellMask';
import { cutoutDisplacementMm3 } from '@/shared/utils/fitTestPlan';
import { computeLabelTabVolume, rampAreaWithin, lipSupportArea } from './printLabelTabVolume';
import {
  computeWallPatternReduction,
  computeFloorPatternReduction,
  effectiveDividerHeight,
  totalDividerLength,
} from './printPatternSavings';
export { computeLabelTabVolume, rampAreaWithin, lipSupportArea } from './printLabelTabVolume';
export interface PrintEstimate {
  /** Estimated material volume in mm³ */
  readonly volumeMm3: number;
  /** Estimated filament mass in grams */
  readonly gramsFilament: number;
  /** Estimated filament length in meters */
  readonly metersFilament: number;
  /** Estimated print time in minutes */
  readonly printTimeMinutes: number;
  /** Estimated cost in USD */
  readonly costUSD: number;
}
/**
 * Computes print estimates from bin parameters.
 *
 * @param params - Complete bin parameter set
 * @param printSettings - User print settings (cost, layer height, infill)
 * @returns Print estimates including volume, mass, filament length, time, and cost
 */
export function estimatePrint(
  params: BinParams,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): PrintEstimate {
  return estimateFromVolume(computeBinVolume(params), printSettings);
}

/**
 * Filament, time and cost for a known material volume.
 *
 * Split out of {@link estimatePrint} for callers that measure a volume some
 * other way — the fit-test card is a slice of a bin, which `computeBinVolume`
 * has no way to describe. Scaling a bin's finished estimate by a mass ratio is
 * NOT equivalent: {@link OVERHEAD_MINUTES} is a flat 16 minutes of bed heat and
 * homing that does not shrink with the part, so a card at a fifth of a bin's
 * mass came out about 20% under its real time.
 */
export function estimateFromVolume(
  volumeMm3: number,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): PrintEstimate {
  const volumeCm3 = volumeMm3 / 1000; // mm³ → cm³
  const gramsFilament = volumeCm3 * PLA_DENSITY;
  const metersFilament = volumeMm3 / FILAMENT_AREA_MM2 / 1000; // mm³ → mm length → m

  // Scale only the extrusion portion; overhead (bed heat, etc.) is constant
  const baseExtrusionMinutes = metersFilament * MINUTES_PER_METER;
  const printTimeMinutes = OVERHEAD_MINUTES + scalePrintTime(baseExtrusionMinutes, printSettings);

  const costUSD = (gramsFilament / 1000) * printSettings.filamentCostPerKg; // g → kg × $/kg

  return {
    volumeMm3: Math.round(volumeMm3),
    gramsFilament: Math.round(gramsFilament * 10) / 10,
    metersFilament: Math.round(metersFilament * 100) / 100,
    printTimeMinutes: Math.round(printTimeMinutes),
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

/**
 * Formats print time as human-readable string.
 */
export function formatPrintTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Formats filament length for display.
 */
export function formatFilament(meters: number): string {
  if (meters < 1) return `${Math.round(meters * 100)}cm`;
  return `${meters.toFixed(1)}m`;
}
/**
 * Computes total material volume analytically from bin parameters.
 *
 * The standard bin shell (perimeter walls + floor + base socket feet +
 * stacking lip) reuses the shared, OCCT-calibrated estimator
 * (`standardBinSolidComponents`) so the designer and print-export agree on the
 * base geometry. Feature deltas are layered on top:
 *   + Divider walls
 *   + Label tabs
 *   + Scoop ramps (fill the wall-floor corner of each compartment)
 *   − Honeycomb wall reduction
 *
 * (The previous local hollow-box model treated the bottom 7mm as a solid slab,
 * over-reporting standard bins by ~3–6×.)
 */
function computeBinVolume(params: BinParams): number {
  const wallThickness = STYLE_WALL_THICKNESS[params.style] ?? GRIDFINITY.WALL_THICKNESS;
  // Y axis uses gridUnitMmY when set (non-square grid); otherwise it equals the
  // X pitch, so square bins are unchanged.
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  // Outer dimensions in mm
  const outerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * gridUnitMmY - GRIDFINITY.TOLERANCE;
  // Height units INCLUDE the base (first unit = base, no cavity)
  const totalH = params.height * params.heightUnitMm;

  // Base height (7mm dead space: profile + bridge + floor, no cavity here)
  const bottomH = GRIDFINITY.BASE_HEIGHT;

  // Standard bin shell: walls + floor + base feet (+ lip when enabled),
  // from the shared OCCT-calibrated model.
  const shell = standardBinSolidComponents(
    params.width,
    params.depth,
    params.height,
    params.gridUnitMm,
    params.heightUnitMm,
    gridUnitMmY
  );
  let volume = shell.walls + shell.base + (params.base.stackingLip ? shell.lip : 0);

  // The geometry follows the PLAN, not the flag: with detachable feet
  // requested but no pocket-aligned whole cell to anchor one (a half-lattice
  // 1-wide bin), the plan places nothing, the pipeline keeps the integral
  // socket, and every estimate branch below has to agree — or a bin whose
  // socket is fully present loses its whole foot volume from the readout.
  const detachablePlacements = hasDetachableFeet(params.base)
    ? resolveDetachableFeet(params).placements
    : [];
  const feetDetach = detachablePlacements.length > 0;

  // A lightweight base shells the feet, which is a per-cell saving on the
  // `base` component and nothing else. Applied before the base-only return
  // below, because that mode is almost entirely base — it is where the relief
  // pays off most. A spacer is deliberately not modelled here: it removes the
  // floor as well as shelling the feet, so it is a different figure that no
  // measurement in this file covers.
  // NOT `|| feetDetach`: the two are mutually exclusive in the geometry
  // (`deriveDimensions` makes lightweight inert when the feet detach) but both
  // flags can be STORED at once, because the panel locks lightweight rather
  // than clearing it. Subtracting both took the base term negative and reported
  // a 91% saving on a bin that saves 46%.
  if (
    params.base.lightweight &&
    !params.base.spacer &&
    !isSocketlessBase(params.base.style) &&
    !feetDetach
  ) {
    volume -= lightweightBaseSaving(
      params.width,
      params.depth,
      isUndersideRelief(params.base),
      params.base.halfSockets,
      params.gridUnitMm,
      gridUnitMmY
    );
  }

  // Detachable feet: the socket's feet leave the bin and come back as separate
  // parts, so the base term loses its foot component and they are added back by
  // what each one actually is. A bar clipped against a cell edge and one centred
  // mid-run are both bars and are different volumes, which is why the count
  // alone would not do.
  if (feetDetach) {
    volume -= integralFeetVolume(params.width, params.depth, params.gridUnitMm, gridUnitMmY);
    volume += detachableFeetVolume(
      detachablePlacements.map(footKind),
      params.gridUnitMm,
      gridUnitMmY
    );
  }

  // A base-only bin IS feet + floor slab + an optional lip, which is exactly
  // what the `base` component is calibrated to. Every other term is fabricated
  // here: `walls` prices a `height`-tall wall the tray never builds, out of a
  // `height` that is inert on a tray, and the constraint engine rules out each
  // feature delta below. Returning early keeps the estimate honest without
  // teaching the whole function about a mode with no interior.
  if (params.base.tile === true && !isSocketlessBase(params.base.style)) {
    return volume - shell.walls;
  }

  // A solid bin fills the cavity the shell model leaves empty. Without this
  // term every solid bin was priced as the hollow one it is not — measured at
  // 3.1x to 5.3x low across sizes, and completely unmoved by cutouts, so a
  // shadow board reported the same figure however much was carved out of it.
  volume += solidFillVolume(params, outerW, outerD, wallThickness);

  // Divider volumes (standard style only — slotted/solid don't use interior dividers)
  if (params.style === 'standard') {
    volume += computeDividerVolume(params, outerW, outerD, wallThickness);
    volume += raisedFloorVolume(params, outerW, outerD, wallThickness);
  }

  // Label tabs (shelf + support structure)
  if (isFeatureActive(params, 'label')) {
    volume += computeLabelTabVolume(params, outerW, outerD, wallThickness);
  }

  // Scoop ramps are fused into the wall-floor corner of each compartment.
  if (isFeatureActive(params, 'scoop')) {
    volume += computeScoopVolume(params, outerW, outerD);
  }

  // Wall pattern: perforation reduces wall material (all pattern types).
  if (params.wallPattern.enabled) {
    volume -= computeWallPatternReduction(params, outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Floor pattern: drainage holes remove floor slab AND foot material.
  volume -= computeFloorPatternReduction(params, wallThickness, shell.base, feetDetach);

  // Exterior-wall collar: a walled ring raised above the nominal
  // body — perimeter wall material only, no floor/interior. Ring cross-section
  // (outer area − inner area) × collar height.
  const collarMm = Math.max(0, params.extraWallHeightMm ?? 0);
  if (collarMm > 0) {
    const innerW = Math.max(0, outerW - 2 * wallThickness);
    const innerD = Math.max(0, outerD - 2 * wallThickness);
    volume += (outerW * outerD - innerW * innerD) * collarMm;
  }

  return Math.max(0, volume);
}
/**
 * Fraction of the nominal cavity prism a solid fill actually occupies.
 *
 * The prism overstates: the interior corners are rounded and the stacking lip's
 * taper eats the top of the fill. Fitted against generated geometry, never
 * derived from the profile (gotcha #21) — `printEstimates.solidFill.scenario`
 * regenerates 2x2x3u, 2x2x6u and 3x2x4u solid bins, with and without cutouts,
 * and takes `meshVolume`. At this value the worst residual is 0.6%; the raw
 * prism runs 2.4% high. Re-run that test before changing it.
 */
const SOLID_FILL_EFFICIENCY = 0.988;

/**
 * Material filling a solid bin's cavity, less whatever its cutouts carve back.
 *
 * The shell model this file is built on prices walls, base and lip — every bin
 * is a hollow box to it. A solid bin is that box with the cavity filled, and
 * nothing else here adds it, so before this term a solid bin was reported at
 * 19-35% of its real volume and a shadow board's estimate never moved however
 * many pockets were cut into it.
 *
 * The fill runs from the top of the floor slab to the fill surface, which
 * `cutoutConfig.topOffset` lowers. Cutout displacement comes from the fit-test
 * plan so the card and the bin it is compared against price a pocket the same
 * way.
 */
function solidFillVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  // `style` is kept in lockstep with `base.solid` by the constraint engine, but
  // a crafted payload can carry one without the other; the generator fills on
  // `base.solid`, so either flag is enough to price it as filled.
  if (!params.base.solid && params.style !== 'solid') return 0;

  const wallHeight = baseWallHeight(params.base, params.height * params.heightUnitMm);
  // From the FLOOR's top, not the wall's: the `base` component already prices
  // material up to `binFloorMm`, so a fill starting at `wallThickness` counts
  // the difference twice. Resolved from `params.wallThickness` rather than the
  // style constant above, because that is what the pipeline resolves it from —
  // they part company once a wall exceeds the spec floor.
  const floorThickness = binFloorMm(params.wallThickness);
  const fillHeight = wallHeight - floorThickness - Math.max(0, params.cutoutConfig.topOffset);
  if (fillHeight <= 0) return 0;

  const innerW = Math.max(0, outerW - 2 * wallThickness);
  const innerD = Math.max(0, outerD - 2 * wallThickness);
  let fill = innerW * innerD * fillHeight * SOLID_FILL_EFFICIENCY;

  // A partial mask carves whole cells out of the footprint, so the fill shrinks
  // with the cell count rather than with the bounding box.
  if (isPartialMask(params.cellMask)) {
    const cells = params.width * params.depth;
    if (cells > 0) fill *= countFilled(params.cellMask) / cells;
  }

  return Math.max(0, fill - cutoutDisplacementMm3(params, fillHeight));
}

/**
 * Volume of the slabs under raised compartments. Cell footprints rather than
 * cavity footprints: the divider insets are a couple of percent of a slab.
 */
function raisedFloorVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const raises = params.compartments.floorRaises;
  if (!raises) return 0;
  const ceiling = maxCompartmentFloorRaiseMm(params);
  const { cols, rows, cells } = params.compartments;
  const cellArea = ((outerW - 2 * wallThickness) / cols) * ((outerD - 2 * wallThickness) / rows);
  let volume = 0;
  for (const id of cells) {
    const raise = raises[id];
    if (typeof raise === 'number' && raise > 0) volume += cellArea * Math.min(raise, ceiling);
  }
  return volume;
}

/**
 * Volume of all divider walls inside the cavity.
 */
function computeDividerVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const { cols, rows, thickness } = params.compartments;

  if (cols <= 1 && rows <= 1) return 0;

  // Volume = total wall length × thickness × height
  return totalDividerLength(params, innerW, innerD) * thickness * effectiveDividerHeight(params);
}

/**
 * Material the scoop ramps add: the wedge under each arc, spanning the merged
 * extent of every compartment the builder actually ramps. Mirrors
 * `buildScoopRamps` compartment by compartment: standard style only, one ramp
 * per rectangular, untilted compartment on the chosen side, placed on the
 * design's own wall thickness (the style constant above is what the shell model
 * was calibrated on; the pipeline builds `params.wallThickness`). A curved arc
 * leaves (1 − π/4)·run·height under it, a straight bevel half the rectangle;
 * against a lipped outer wall the profile also climbs to the wall top across
 * `lipOffset`, less the lip support it lands inside. A ramp on an interior
 * side starts on the divider's centreline and its span ends on the side
 * dividers' centrelines, so the half-thickness it shares with each divider is
 * already priced there and comes off here.
 */
function computeScoopVolume(params: BinParams, outerW: number, outerD: number): number {
  if (params.style !== 'standard') return 0;
  const { rows, cols, cells, thickness } = params.compartments;
  const wall = params.wallThickness;

  const innerW = outerW - 2 * wall;
  const innerD = outerD - 2 * wall;

  const hasLip = params.base.stackingLip;
  const totalH = params.height * params.heightUnitMm;
  const boxWallHeight = baseWallHeight(params.base, totalH);
  const frame = scoopFrameHeights(
    boxWallHeight,
    computeInteriorHeight(boxWallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER),
    binFloorMm(wall)
  );
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;
  const sides = resolveScoopSides(params.scoop);
  const grid = { cols, rows, innerW, innerD };

  let volume = 0;
  const seen = new Set<number>();
  for (const compId of cells) {
    if (seen.has(compId)) continue;
    seen.add(compId);
    if (compartmentHasTiltedEdge(params.compartments, compId)) continue;
    if (!isRectangularCompartment(params.compartments, compId)) continue;
    const bounds = getCompartmentBounds(params.compartments, compId);
    if (!bounds) continue;

    // Summed per wall. Ramps on adjacent walls share the corner between them,
    // which this counts twice — under 1% of a bin's volume at the worst case
    // (all four walls), and well inside what an estimate built from wedge areas
    // and a void fraction already claims.
    for (const side of sides) {
      const { span, depth, isOuter } = resolveScoopPlacement(side, bounds, grid);
      const lipOffset = computeLipOffset(hasLip, isOuter, lipTaperWidth, wall);
      const profile = resolveScoopProfile(
        params.scoop,
        span,
        depth,
        isOuter,
        hasLip,
        frame.wallHeight,
        frame.interiorHeight,
        lipOffset
      );
      if (!profile) continue;

      const wedge =
        profile.style === 'curved'
          ? (1 - Math.PI / 4) * profile.run * profile.height
          : 0.5 * profile.run * profile.height;
      const buriedBack = isOuter ? 0 : rampAreaWithin(profile, thickness / 2);
      const lipStrip = lipOffset > 0 ? lipOffset * frame.wallHeight - lipSupportArea(wall) : 0;
      const dividerEnds =
        side === 'front' || side === 'back'
          ? (bounds.minCol > 0 ? 1 : 0) + (bounds.maxCol < cols - 1 ? 1 : 0)
          : (bounds.minRow > 0 ? 1 : 0) + (bounds.maxRow < rows - 1 ? 1 : 0);
      const exposedSpan = Math.max(0, span - (thickness / 2) * dividerEnds);
      volume += (wedge - buriedBack + lipStrip) * exposedSpan;
    }
  }
  return volume;
}

export interface WallPatternSavings {
  readonly savingsPercent: number;
  readonly patternEstimate: PrintEstimate;
  readonly standardEstimate: PrintEstimate;
}

/**
 * Compare wall-pattern-enabled vs standard bin to calculate material savings.
 */
export function calculateWallPatternSavings(
  params: BinParams,
  printSettings: PrintSettings = DEFAULT_PRINT_SETTINGS
): WallPatternSavings {
  const patternEstimate = estimatePrint(params, printSettings);

  // Compute standard estimate with wall pattern disabled
  const standardParams: BinParams = {
    ...params,
    wallPattern: { enabled: false, pattern: 'honeycomb' },
  };
  const standardEstimate = estimatePrint(standardParams, printSettings);

  const savingsPercent =
    standardEstimate.volumeMm3 > 0
      ? Math.round(
          ((standardEstimate.volumeMm3 - patternEstimate.volumeMm3) / standardEstimate.volumeMm3) *
            100
        )
      : 0;

  return { savingsPercent, patternEstimate, standardEstimate };
}
