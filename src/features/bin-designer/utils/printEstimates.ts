/**
 * Print estimate calculations for the bin designer.
 *
 * Analytically computes material volume from bin parameters,
 * then derives filament usage and print time estimates.
 *
 * Volume is computed as:
 *   shell + base socket + stacking lip + dividers + label tabs − scoops
 *
 * This avoids expensive mesh-based volume integration.
 */

import type { BinParams, LabelTabSupport, WallPatternType } from '@/features/bin-designer/types';
import {
  binFloorMm,
  isSocketlessBase,
  isUndersideRelief,
} from '@/features/bin-designer/types/base';
import { baseWallHeight } from './binDimensions';
import { DEFAULT_PATTERN_SCALE } from '@/features/bin-designer/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import {
  compartmentHasTiltedBackWall,
  compartmentHasTiltedFrontWall,
  getCompartmentBounds,
} from '@/features/bin-designer/utils/compartments';
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
import { hasDetachableFeet } from '@/shared/types/bin';
import { footKind, resolveDetachableFeet } from '@/shared/utils/detachableFeetPlan';
import {
  resolveScoopProfile,
  resolveScoopSide,
  computeLipOffset,
  computeInteriorHeight,
  scoopFrameHeights,
} from '@/shared/utils/scoopCalculations';
import { resolveCompartmentDividerHeight } from '@/shared/utils/slotMath';
import { countFilled, isPartialMask } from '@/shared/utils/cellMask';
import { resolveWallPatternSides } from '@/shared/utils/wallPatternSides';
import { cutoutDisplacementMm3 } from '@/shared/utils/fitTestPlan';
import { FLOOR_PATTERN_BORDER, floorWindowSpan } from '@/shared/generation/floorPatternMetrics';
import { stampPatternOpenArea } from '@/shared/generation/wallPatternMetrics';
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
 *   − Scoops (removes material)
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
  }

  // Label tabs (shelf + support structure)
  if (isFeatureActive(params, 'label')) {
    volume += computeLabelTabVolume(params, outerW, outerD, wallThickness);
  }

  // Scoops (remove material from compartment front walls)
  if (isFeatureActive(params, 'scoop')) {
    volume -= computeScoopVolume(params, outerW, outerD, wallThickness);
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

  // Volume cannot be negative (scoops on tiny bins)
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
 * Height an interior divider actually reaches, in mm.
 *
 * Mirrors the generator: dividers rise from the cavity floor to the interior
 * ceiling (the stacking lip's bottom taper eats into it), capped by the
 * user's `dividerHeight`. Shared by the volume and the pattern-reduction terms
 * so shortening the dividers moves both together.
 */
function effectiveDividerHeight(params: BinParams): number {
  const totalH = params.height * params.heightUnitMm;
  const wallHeight = baseWallHeight(params.base, totalH);
  const interiorHeight = computeInteriorHeight(
    wallHeight,
    params.base.stackingLip,
    GRIDFINITY.LIP_SMALL_TAPER
  );
  return resolveCompartmentDividerHeight(params.compartments.dividerHeight, interiorHeight);
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

/** Summed length of every interior divider wall segment (mm). */
function totalDividerLength(params: BinParams, innerW: number, innerD: number): number {
  const { cols, rows, cells } = params.compartments;
  if (cols <= 1 && rows <= 1) return 0;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  let totalLength = 0;

  for (let colBoundary = 1; colBoundary < cols; colBoundary++) {
    for (let row = 0; row < rows; row++) {
      const leftId = cells[row * cols + (colBoundary - 1)];
      const rightId = cells[row * cols + colBoundary];
      if (leftId !== rightId) {
        totalLength += cellD;
      }
    }
  }

  for (let rowBoundary = 1; rowBoundary < rows; rowBoundary++) {
    for (let col = 0; col < cols; col++) {
      const topId = cells[(rowBoundary - 1) * cols + col];
      const bottomId = cells[rowBoundary * cols + col];
      if (topId !== bottomId) {
        totalLength += cellW;
      }
    }
  }

  return totalLength;
}
/** Builder constant: max unsupported shelf span between bracket gussets. */
const BRACKET_GUSSET_SPACING_MM = 10;

interface LabelTabGeom {
  readonly tabDepth: number;
  readonly gussetLeg: number;
  readonly wallThickness: number;
  readonly dividerThickness: number;
  readonly widthPercent: number;
  readonly inset: number;
  readonly support: LabelTabSupport;
}

/**
 * Volume of label tabs, mirroring `labelTabBuilder.buildTabsAtRow`'s
 * grouping and skip conditions (tilted anchor wall, depth+inset overrun,
 * `edges='both'` collisions) so the estimate tracks what the builder
 * actually generates.
 */
function computeLabelTabVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const { cols, rows, thickness } = params.compartments;
  const { depth: tabDepth, width: widthPercent, support } = params.label;
  const inset = params.label.inset ?? 0;
  const edges = params.label.edges ?? 'back';

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const cellW = innerW / cols;
  const cellD = innerD / rows;

  // Mirrors the bridge guard in `buildLabelTabsInScope`.
  if (tabDepth >= innerD) return 0;

  // `gussetLeg` clamps at 0 so a tabDepth ≤ wallThickness yields shelf-only
  // volume (no support), matching the builder's guard on degenerate geometry.
  const geom: LabelTabGeom = {
    tabDepth,
    gussetLeg: Math.max(0, tabDepth - wallThickness),
    wallThickness,
    dividerThickness: thickness,
    widthPercent,
    inset,
    support,
  };

  const includeBack = edges === 'back' || edges === 'both';
  const includeFront = edges === 'front' || edges === 'both';
  const collidingFrontIds =
    edges === 'both' ? findCollidingFrontIds(params, cellD, tabDepth, inset) : null;

  let volume = 0;
  for (let row = 0; row < rows; row++) {
    if (includeBack) {
      volume += sumTabVolumesAtRow(params, row, 'back', cellW, cellD, geom, null);
    }
    if (includeFront) {
      volume += sumTabVolumesAtRow(params, row, 'front', cellW, cellD, geom, collidingFrontIds);
    }
  }
  return volume;
}

/**
 * Per-tab volume as a function of shelf width. Support depends on style:
 *   - `solid` / `fillet`: triangular prism extruded the full shelf width.
 *     Fillet has a concave profile but the over-estimate is small.
 *   - `bracket`: ~`ceil(tabWidth / BRACKET_GUSSET_SPACING_MM)` gussets,
 *     each extruded by the divider thickness (within ±1 of the builder).
 */
function tabContribution(geom: LabelTabGeom, tabWidth: number): number {
  if (tabWidth <= 0) return 0;
  const shelf = geom.tabDepth * tabWidth * geom.wallThickness;
  if (geom.gussetLeg <= 0) return shelf;
  const triangleArea = 0.5 * geom.tabDepth * geom.gussetLeg;
  const support =
    geom.support === 'bracket'
      ? Math.max(1, Math.ceil(tabWidth / BRACKET_GUSSET_SPACING_MM)) *
        triangleArea *
        geom.dividerThickness
      : triangleArea * tabWidth;
  return shelf + support;
}

/**
 * Sum tab volumes for one row + anchor edge. Mirrors the grouping and
 * skip logic of `labelTabBuilder.buildTabsAtRow`, including the
 * `thickness/2` boundary deduction at real divider walls.
 */
function sumTabVolumesAtRow(
  params: BinParams,
  row: number,
  anchor: 'back' | 'front',
  cellW: number,
  cellD: number,
  geom: LabelTabGeom,
  collidingFrontIds: Set<number> | null
): number {
  const { cols, rows, cells, thickness } = params.compartments;
  const isOuterEdgeRow = anchor === 'back' ? row === rows - 1 : row === 0;
  const neighborRowOffset = anchor === 'back' ? 1 : -1;
  const hasTiltedAnchorWall =
    anchor === 'back' ? compartmentHasTiltedBackWall : compartmentHasTiltedFrontWall;

  const cellAt = (c: number): number => cells[row * cols + c];
  const anchorsTab = (c: number): boolean =>
    isOuterEdgeRow || cellAt(c) !== cells[(row + neighborRowOffset) * cols + c];

  let volume = 0;
  let col = 0;

  while (col < cols) {
    const cellId = cellAt(col);
    if (!anchorsTab(col)) {
      col++;
      continue;
    }
    if (hasTiltedAnchorWall(params.compartments, cellId)) {
      col++;
      continue;
    }
    if (anchor === 'front' && collidingFrontIds?.has(cellId)) {
      col++;
      continue;
    }

    const bounds = getCompartmentBounds(params.compartments, cellId);
    if (bounds) {
      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
      if (geom.tabDepth + geom.inset > compartmentDepth) {
        col++;
        continue;
      }
    }

    let groupEnd = col + 1;
    while (groupEnd < cols && cellAt(groupEnd) === cellId && anchorsTab(groupEnd)) {
      groupEnd++;
    }

    const groupCols = groupEnd - col;
    const groupMinCol = col;
    const groupMaxCol = groupEnd - 1;

    // Deduct half the divider thickness on either side that borders an
    // actual divider wall (a different compartment). Outer bin walls don't
    // deduct — the cellW already starts inside the bin wall.
    const leftDeduction = groupMinCol > 0 && cellAt(groupMinCol - 1) !== cellId ? thickness / 2 : 0;
    const rightDeduction =
      groupMaxCol < cols - 1 && cellAt(groupMaxCol + 1) !== cellId ? thickness / 2 : 0;
    const availableWidth = groupCols * cellW - leftDeduction - rightDeduction;
    const tabWidth = (availableWidth * geom.widthPercent) / 100;

    volume += tabContribution(geom, tabWidth);
    col = groupEnd;
  }

  return volume;
}

/**
 * For `edges='both'`, identify compartments whose back+front tab pair would
 * collide so the front tab is dropped from the estimate. Mirror of
 * `labelTabBuilder.findCollidingFrontCompartments`.
 */
function findCollidingFrontIds(
  params: BinParams,
  cellD: number,
  tabDepth: number,
  inset: number
): Set<number> {
  const { cols, rows, cells } = params.compartments;
  const colliding = new Set<number>();
  const visited = new Set<number>();

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cellId = cells[row * cols + col];
      if (visited.has(cellId)) continue;
      visited.add(cellId);

      const bounds = getCompartmentBounds(params.compartments, cellId);
      if (!bounds) continue;

      const hasFrontAnchor =
        bounds.minRow === 0 || cells[(bounds.minRow - 1) * cols + bounds.minCol] !== cellId;
      const hasBackAnchor =
        bounds.maxRow === rows - 1 || cells[(bounds.maxRow + 1) * cols + bounds.minCol] !== cellId;
      if (!hasBackAnchor || !hasFrontAnchor) continue;

      const compartmentDepth = (bounds.maxRow - bounds.minRow + 1) * cellD;
      if (2 * tabDepth + 2 * inset > compartmentDepth) {
        colliding.add(cellId);
      }
    }
  }

  return colliding;
}

/**
 * Volume removed by scoop ramp (negative contribution).
 *
 * Each scoop's cross-section is a concave quarter-ellipse (curved) or a right
 * triangle (straight), extruded across the compartment width.
 */
function computeScoopVolume(
  params: BinParams,
  outerW: number,
  outerD: number,
  wallThickness: number
): number {
  const { rows, cols } = params.compartments;

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const colWidth = innerW / cols;
  const rowDepth = innerD / rows;

  const hasLip = params.base.stackingLip;
  const totalH = params.height * params.heightUnitMm;
  const boxWallHeight = baseWallHeight(params.base, totalH);
  const { wallHeight, interiorHeight } = scoopFrameHeights(
    boxWallHeight,
    computeInteriorHeight(boxWallHeight, hasLip, GRIDFINITY.LIP_SMALL_TAPER),
    binFloorMm(wallThickness)
  );
  const lipTaperWidth = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

  // Front/back scoops run along the row axis, left/right along the column axis.
  const side = resolveScoopSide(params.scoop);
  const runsAlongY = side === 'front' || side === 'back';
  const span = runsAlongY ? colWidth : rowDepth;
  const depth = runsAlongY ? rowDepth : colWidth;

  // Use a representative compartment: it only touches the outer wall on the
  // scoop's axis when the bin is a single track along that axis.
  const isRepresentativeOuter = runsAlongY ? rows === 1 : cols === 1;
  const lipOffset = computeLipOffset(hasLip, isRepresentativeOuter, lipTaperWidth, wallThickness);
  const profile = resolveScoopProfile(
    params.scoop,
    span,
    depth,
    isRepresentativeOuter,
    hasLip,
    wallHeight,
    interiorHeight,
    lipOffset
  );
  if (!profile) return 0;

  const numScoops = cols * rows;

  // Cross-section area × span. Curved: quarter-ellipse (π/4 × run × height);
  // straight: right triangle (½ × run × height).
  const area =
    profile.style === 'curved'
      ? (Math.PI / 4) * profile.run * profile.height
      : 0.5 * profile.run * profile.height;
  const volumePerScoop = area * span;

  return numScoops * volumePerScoop;
}
/**
 * Approximate open-area fraction of each pattern at neutral scale — the share
 * of the wall face removed by the perforation. Honeycomb keeps its historical
 * 0.907 so existing estimates are unchanged; the sparser patterns remove less.
 *
 * Mirrors the geometry in patterns/* (cross-feature import not allowed). These
 * are estimates; the true fraction shifts slightly with web and keep-outs.
 */
const PATTERN_VOID_FRACTION: Record<WallPatternType, number> = {
  honeycomb: 0.907,
  round: 0.62,
  diamond: 0.72,
  triangle: 0.42,
  slots: 0.48,
  mitsukude: 0.58,
  goma: 0.45,
  asanoha: 0.3,
  sakura: 0.4,
  rindo: 0.45,
  mikado: 0.42,
  'tsumiishi-kikko': 0.45,
};

/**
 * Volume removed by wall-pattern cutouts, for any pattern type.
 *
 * Approximation: pattern-specific open-area fraction of the wall face area,
 * modulated by the scale slider (bolder = more open, web fixed), cut through
 * the full wall thickness.
 */
function computeWallPatternReduction(
  params: BinParams,
  outerW: number,
  outerD: number,
  totalH: number,
  wallThickness: number,
  bottomH: number
): number {
  // Must match wallPatterns.ts constants (cross-feature import not allowed)
  const HEX_RADIUS = 1.8;
  const WEB_THICKNESS = 0.8;
  const TOP_KEEP_OUT = 1.5;
  const BOTTOM_SOLID_SKIRT = 1.5;

  const wallHeight = totalH - bottomH;
  // wallThickness clears the floor slab; the skirt is the solid band above it
  // that anchors the lowest element row. Mirrors wallPatterns.ts.
  const bottomKeepOut = wallThickness + BOTTOM_SOLID_SKIRT;
  const patternHeight = wallHeight - TOP_KEEP_OUT - bottomKeepOut;
  const minPatternH = Math.sqrt(3) * HEX_RADIUS + WEB_THICKNESS;
  if (patternHeight < minPatternH) return 0;

  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;

  // Patterned wall length: slot-free walls (front/back seat y-axis dividers,
  // left/right seat x-axis) intersected with the per-side selection.
  const sides = resolveWallPatternSides(params.wallPattern);
  const yFree = params.style !== 'slotted' || !params.slotConfig.y.enabled;
  const xFree = params.style !== 'slotted' || !params.slotConfig.x.enabled;
  let patternedWallLength = 0;
  if (yFree) {
    if (sides.front) patternedWallLength += innerW;
    if (sides.back) patternedWallLength += innerW;
  }
  if (xFree) {
    if (sides.left) patternedWallLength += innerD;
    if (sides.right) patternedWallLength += innerD;
  }

  const wallFaceArea = patternedWallLength * patternHeight;

  // Pattern open-area fraction, modulated by scale (0.5 = neutral, factor 1.0).
  const scale = params.wallPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const base = PATTERN_VOID_FRACTION[params.wallPattern.pattern];
  const coverageFraction = Math.min(0.95, Math.max(0, base * (0.85 + 0.3 * scale)));
  const coverage = wallFaceArea * coverageFraction;

  // Material removed per unit area = wall thickness (prisms cut through wall)
  const cutDepth = wallThickness;

  return coverage * cutDepth + dividerPatternReduction(params, innerW, innerD, coverageFraction);
}

/**
 * Extra material removed when the pattern is carried through the compartment
 * dividers.
 *
 * Same open-area model as the outer walls, applied to the divider face area
 * and cut through the divider's own thickness. The band is re-fitted to the
 * divider height, matching `planDividerPatterns` — a shortened divider offers
 * proportionally less to perforate.
 */
function dividerPatternReduction(
  params: BinParams,
  innerW: number,
  innerD: number,
  coverageFraction: number
): number {
  // Mirrors the worker's `dividerPatternsApply` gate — subtracting for a bin
  // the generator never patterns would make the estimate disagree with the
  // geometry it is describing.
  if (params.wallPattern.dividers !== true) return 0;
  if (params.style !== 'standard') return 0;
  if (params.base.solid) return 0;
  if (isPartialMask(params.cellMask)) return 0;
  if (params.compartments.thickness <= 0) return 0;

  const dividerHeight = effectiveDividerHeight(params);

  // Mirrors wallPatterns.ts (cross-feature import not allowed).
  const TOP_KEEP_OUT = 1.5;
  const BOTTOM_SOLID_SKIRT = 1.5;
  const bandHeight = dividerHeight - TOP_KEEP_OUT - (params.wallThickness + BOTTOM_SOLID_SKIRT);
  if (bandHeight <= 0) return 0;

  const length = totalDividerLength(params, innerW, innerD);
  if (length <= 0) return 0;

  return length * bandHeight * coverageFraction * params.compartments.thickness;
}
/**
 * Volume removed by the floor pattern.
 *
 * Two cut depths, priced two ways. A SOCKETED integral base is cut straight
 * through feet and slab, so the removal is the open share of the base
 * component (`standardBinSolidComponents.base`, solid-calibrated per #3528 —
 * a foot is not a prism, so a share of the measured term beats an area×depth
 * model). Every SLAB-ONLY base — flat, the underside relief (whose cavity is
 * already open below the slab) and detachable feet (whose body floor sits at
 * Z=0) — only loses `wallThickness` of material under each hole, so the
 * removal is the open area times the slab, priced directly. Booking the
 * full-socket share for those cut a 3x3 estimate roughly in half for a
 * pattern that removes ~4mm³ per cm² of window.
 *
 * Open area is measured from the real element placement rather than a
 * fraction-of-area model: a per-foot window is only ~33mm across, and over a box
 * that small the margin the calculator leaves at every edge is most of the box.
 *
 * Mirrors the worker's `floorPatternApplies` gate so the estimate can't claim a
 * saving the generator never makes.
 */
function computeFloorPatternReduction(
  params: BinParams,
  wallThickness: number,
  baseVolume: number,
  feetDetach: boolean
): number {
  const floorPattern = params.floorPattern;
  if (floorPattern?.enabled !== true) return 0;
  // `style === 'solid'` alongside `base.solid`: the two are kept in lockstep by
  // a runtime IMPLICATION_RULE, not by `migrateParams`, so a crafted design can
  // carry one without the other.
  if (params.base.solid || params.style === 'solid') return 0;
  // Mirrors `floorPatternApplies`: an interior lite floor has no slab left to
  // perforate, but the underside relief keeps one and still cuts the holes.
  if (params.base.lightweight && !isUndersideRelief(params.base)) return 0;
  if (params.base.spacer) return 0;
  // The generator forces a base-only bin down the solid path, so no floor
  // pattern is ever cut. `base.solid` above does not catch it: IMPLICATION_RULES
  // hold that flag false while the tray keeps style 'standard'.
  if (params.base.tile === true) return 0;
  if (params.width <= 0 || params.depth <= 0) return 0;

  const isFlat = isSocketlessBase(params.base.style);
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const scale = floorPattern.scale ?? DEFAULT_PATTERN_SCALE;
  const openArea = (w: number, h: number): number =>
    stampPatternOpenArea(floorPattern.pattern, params.height, scale, w, h);

  const outerW = params.width * params.gridUnitMm - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * gridUnitMmY - GRIDFINITY.TOLERANCE;
  // A flat base has no feet to thread the holes through, so the whole cavity
  // floor is one window; a socket bin gets one window per foot — and
  // `halfSockets` quarters every foot, so each cell carries four much smaller
  // windows rather than one big one. Assuming full-cell windows there would
  // over-report the open area several times over, since a window that small
  // fits disproportionately fewer elements.
  const cellUnits = params.base.halfSockets ? 0.5 : 1;
  const windowsPerCell = params.base.halfSockets ? 4 : 1;
  // A custom footprint only grows feet on its filled cells, so only those carry
  // windows. Scaling by the filled fraction tracks that without re-deriving the
  // socket builder's per-cell decomposition here — and it cancels the fact that
  // `baseVolume` counts the full bounding rectangle, leaving the reduction
  // proportional to the cells that actually exist.
  const filledFraction = isPartialMask(params.cellMask)
    ? countFilled(params.cellMask) / (params.cellMask.cols * params.cellMask.rows)
    : 1;
  const totalOpenArea = isFlat
    ? openArea(
        outerW - 2 * wallThickness - 2 * FLOOR_PATTERN_BORDER,
        outerD - 2 * wallThickness - 2 * FLOOR_PATTERN_BORDER
      )
    : params.width *
      params.depth *
      filledFraction *
      windowsPerCell *
      openArea(
        floorWindowSpan(cellUnits, params.gridUnitMm, params.wallThickness),
        floorWindowSpan(cellUnits, gridUnitMmY, params.wallThickness)
      );
  if (totalOpenArea <= 0) return 0;

  const planArea = params.width * params.depth * params.gridUnitMm * gridUnitMmY;
  // See the docstring: slab-only cuts are priced as the direct prism, the
  // socketed full-depth cut as a share of the measured base term.
  const slabOnly = isFlat || isUndersideRelief(params.base) || feetDetach;
  if (slabOnly) {
    return Math.min(totalOpenArea, planArea) * wallThickness;
  }
  return baseVolume * Math.min(1, totalOpenArea / planArea);
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
