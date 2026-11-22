/**
 * Slot cut geometry builder for slotted bin style.
 *
 * Generates rectangular wall slots for removable divider pieces.
 * Slots are cut into opposing walls: X-axis slots on left/right walls
 * (for Y-direction dividers), Y-axis slots on front/back walls
 * (for X-direction dividers).
 *
 * When a stacking lip is present, wider cutouts are added in the lip zone
 * so dividers can slide in from the top.
 *
 * All slot solids are pre-fused into a single compound for a single
 * boolean cut operation on the bin — critical for performance.
 */

import { box, clone, fuseAll, unwrap, withScope } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateSlotPositions,
  dividerGrooveDepth,
  getDividerLockPlan,
  resolveBinFloorMm,
  getEffectiveSlotDimensions as getEffectiveSlotDimensionsRaw,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';
import { COPLANAR_OVERLAP } from './generatorConstants';
import { SLOT_EXTENSION, createMirroredCutters, filletLineCutters } from './slotCutterShapes';
import type { FilletSlotSizes } from './slotCutterShapes';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import type { DividerFilletSeat } from '@/shared/utils/slottedFillet';

// Re-export shared math for generation-internal consumers
export { calculateSlotPositions };

/**
 * Compute effective slot dimensions from BinParams.
 * Thin wrapper around the shared pure function.
 */
export function getEffectiveSlotDimensions(params: BinParams): {
  slotWidth: number;
  slotDepth: number;
} {
  const { thickness, clearance } = params.dividerPieces;
  return getEffectiveSlotDimensionsRaw(params.wallThickness, thickness, clearance);
}

/**
 * Where the removable dividers rest, in the body frame (box bottom at Z=0).
 */
export interface DividerSeat {
  /** Interior floor top */
  readonly floorZ: number;
  /** Floor channel depth under each divider; 0 when there is none */
  readonly grooveDepth: number;
  /** How the slots meet the interior fillet; absent when the walls carry none. */
  readonly fillet?: DividerFilletSeat | null;
}

/**
 * Lip geometry info for slot cuts that extend through the stacking lip.
 */
export interface LipCutInfo {
  /** Wall height (z where lip starts) */
  readonly wallHeight: number;
  /** Total lip height (4.4mm per spec) */
  readonly lipHeight: number;
  /** Lip taper width — how far the lip extends inward from the outer wall (2.6mm) */
  readonly lipTaperWidth: number;
  /**
   * How far in from the outer wall the lip cutters clear, when that is past the
   * taper: a notched lip's notches reach further, and a divider sliding in on a
   * grid line has to pass through one. Slot POSITIONS stay on `lipTaperWidth`,
   * which the body's wall slots were laid out with.
   */
  readonly inwardReach?: number;
  /**
   * How far below `wallHeight` the lip's angled support reaches, so the
   * cutters start there (`lipSupportDepthMm`). Defaults to `lipTaperWidth`.
   */
  readonly supportDepth?: number;
}

/** Depth the lip cutters clear past the inner wall face. */
function lipCutReach(lipInfo: LipCutInfo, wallThickness: number): number {
  return Math.max(0, (lipInfo.inwardReach ?? lipInfo.lipTaperWidth) - wallThickness);
}

/** Where the lip cutters start and how tall they run, from below the support up past the lip. */
function lipCutSpan(lipInfo: LipCutInfo): { startZ: number; height: number } {
  const depth = lipInfo.supportDepth ?? lipInfo.lipTaperWidth;
  return { startZ: lipInfo.wallHeight - depth, height: depth + lipInfo.lipHeight + 1 };
}

function createMirroredLockingCutters(
  primaryDim: number,
  slotWidth: number,
  dividerThickness: number,
  dividerClearance: number,
  height: number,
  halfSpan: number,
  crossPos: number,
  z: number,
  axis: 'x' | 'y'
): Shape3D[] {
  const lock = getDividerLockPlan(dividerThickness, dividerClearance);
  const lockHeight = lock.headHeight + lock.throatHeight;
  if (height <= lockHeight) {
    return createMirroredCutters(primaryDim, slotWidth, height, halfSpan, crossPos, z, axis);
  }

  const segments: Shape3D[] = [];
  for (const [width, segmentHeight, segmentZ] of [
    [lock.pocketWidth, lock.headHeight, z],
    [lock.throatWidth, lock.throatHeight, z + lock.headHeight],
    [slotWidth, height - lockHeight, z + lockHeight],
  ] as const) {
    segments.push(
      ...createMirroredCutters(primaryDim, width, segmentHeight, halfSpan, crossPos, segmentZ, axis)
    );
  }
  return segments;
}

/** How far a section's slot cutters run past its top, so they share no face with it. */
const SECTION_OVERRUN = 1;

/**
 * The cutters for ONE wall slot and its floor groove, built by the same
 * functions and from the same inputs as the bin's own slots, so the divider
 * fit sample is cut exactly as the bin is.
 *
 * Frame: the wall's inner face is the plane X = 0 with the wall at +X, the slot
 * is centred on Y = 0, and Z is the bin body's (floor top at `seat.floorZ`).
 * `binSlotHeight` is the slot height in the real bin, which decides whether it
 * carries the retention lock; the cutters run `sectionHeight` plus an overrun,
 * so they cut clean through the top of a section that stands `sectionHeight`
 * above the seat. The groove runs in from `grooveFromX`.
 */
export function buildSlotSectionCutters(
  params: BinParams,
  seat: DividerSeat,
  binSlotHeight: number,
  sectionHeight: number,
  grooveFromX: number
): Shape3D[] {
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
  const { thickness, clearance } = params.dividerPieces;
  const slotStartZ = seat.floorZ - seat.grooveDepth;
  const lock = getDividerLockPlan(thickness, clearance);
  const cutterHeight = sectionHeight + SECTION_OVERRUN;
  const mirrored =
    binSlotHeight > lock.headHeight + lock.throatHeight
      ? createMirroredLockingCutters(
          slotDepth,
          slotWidth,
          thickness,
          clearance,
          cutterHeight,
          0,
          0,
          slotStartZ,
          'x'
        )
      : createMirroredCutters(slotDepth, slotWidth, cutterHeight, 0, 0, slotStartZ, 'x');
  // Mirrored pairs come back [negative wall, positive wall]; only +X is built.
  const cutters = mirrored.filter((cutter, i) => {
    if (i % 2 === 1) return true;
    cutter.delete();
    return false;
  });
  if (seat.grooveDepth > 0) {
    cutters.push(
      createGrooveCutter(
        'x',
        grooveFromX,
        slotDepth - SLOT_EXTENSION,
        0,
        slotWidth,
        seat.grooveDepth,
        slotStartZ
      )
    );
  }
  return cutters;
}

/**
 * Channel in the floor under one divider line. `alongStart`/`alongEnd` are
 * relative to the interior center and already carry any reach into the wall
 * slots; the cutter overruns the floor top so the cut shares no face with the
 * cavity floor.
 */
function createGrooveCutter(
  axis: 'x' | 'y',
  alongStart: number,
  alongEnd: number,
  crossPos: number,
  slotWidth: number,
  grooveDepth: number,
  slotStartZ: number
): Shape3D {
  const length = alongEnd - alongStart;
  const alongCenter = (alongStart + alongEnd) / 2;
  const height = grooveDepth + COPLANAR_OVERLAP;
  const zCenter = slotStartZ + height / 2;
  return axis === 'x'
    ? box(length, slotWidth, height, { at: [alongCenter, crossPos, zCenter] })
    : box(slotWidth, length, height, { at: [crossPos, alongCenter, zCenter] });
}

/**
 * Create a mirrored pair of lip overhang cutters along one axis.
 *
 * These carry the divider's channel through the lip zone so a piece can slide
 * in from the top: the lip's inward jut on one side of the wall face, and the
 * wall pocket's own depth on the other.
 */
function createMirroredLipCutters(
  lipOverhang: number,
  slotDepth: number,
  slotWidth: number,
  lipCutHeight: number,
  halfSpan: number,
  crossPos: number,
  lipCutStartZ: number,
  axis: 'x' | 'y'
): [Shape3D, Shape3D] {
  // Reaches `slotDepth` PAST the inner wall face, not merely up to it. The tab
  // that engages the wall slot rides at that depth the whole way down, so a
  // lip cut that stops at the face leaves the pocket roofed over: the wall's
  // own top stub (the slot ends at the interior ceiling, a small taper below
  // the wall top) and then the lip body above it. Both sit outboard of the
  // face, and neither is visible to a check on the slot's own width.
  const reach = lipOverhang + slotDepth;

  const rectW = axis === 'x' ? reach : slotWidth;
  const rectD = axis === 'x' ? slotWidth : reach;

  // Centred so the cutter spans [halfSpan - lipOverhang, halfSpan + slotDepth]:
  // the lip's inward jut on one side, the wall pocket's floor on the other.
  const negCenter = -(halfSpan - lipOverhang / 2 + slotDepth / 2);
  const posCenter = halfSpan - lipOverhang / 2 + slotDepth / 2;

  const zCenter = lipCutStartZ + lipCutHeight / 2;
  const pos = (primary: number): [number, number, number] =>
    axis === 'x' ? [primary, crossPos, zCenter] : [crossPos, primary, zCenter];
  return [
    box(rectW, rectD, lipCutHeight, { at: pos(negCenter) }),
    box(rectW, rectD, lipCutHeight, { at: pos(posCenter) }),
  ];
}

/**
 * Build a compound of all slot cuts for a slotted bin.
 *
 * Returns null if style is not 'slotted' or no slots are configured.
 *
 * Creates two types of cutters per slot position:
 * 1. Wall slots: narrow (slotDepth) cuts from floor to wallHeight for tab engagement
 * 2. Lip cutouts: wider cuts spanning the full lip taper, from wallHeight upward,
 *    so dividers can slide in from the top
 *
 * @param params Bin parameters
 * @param innerW Interior width in mm
 * @param innerD Interior depth in mm
 * @param wallHeight Wall height for the narrow slots (interiorHeight or wallHeight)
 * @param lipInfo If provided, adds wider cutouts through the stacking lip
 * @returns Fused compound of all slot solids, or null
 */
export function buildSlotCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  lipInfo?: LipCutInfo,
  seat: DividerSeat = {
    floorZ: resolveBinFloorMm(params),
    grooveDepth: dividerGrooveDepth(params),
  }
): Shape3D | null {
  if (params.style !== 'slotted') return null;

  // Wall too thin for functional slots — skip to avoid cutting through
  if (params.wallThickness < MIN_WALL_FOR_SLOTS) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildSlotCutsInScope(scope, params, innerW, innerD, wallHeight, lipInfo, seat);
    return fused ? unwrap(clone(fused)) : null;
  });
}

/**
 * Build only the lip-zone slot cutters for a slotted bin.
 *
 * Used by splitBinBuilder where the stacking lip is built and split
 * separately from the body (to work around an OCCT crash at the lip-wall
 * junction). The body already has wall slot cuts applied via the normal
 * pipeline, but the separately-built lip needs its own cutouts so the
 * dividers can slide in from above.
 *
 * @param params Bin parameters (with the user's style/slotConfig intact)
 * @param innerW Interior width in mm
 * @param innerD Interior depth in mm
 * @param lipInfo Lip geometry — physical dimensions of the cutters
 * @param slotPositionsEdgeInset Edge inset (mm) used when computing slot
 *   positions along each axis. MUST match the value the caller's body used
 *   when generating its wall slots — otherwise lip cuts will misalign and
 *   dividers won't slide through. That is `lipOverhang`
 *   (`lipTaperWidth - wallThickness`, floored at 0), the same value
 *   `buildSlotCuts` derives from its own `lipInfo`.
 * @returns Fused compound of lip cutters, or null if not slotted / no cuts needed
 */
export function buildLipSlotCuts(
  params: BinParams,
  innerW: number,
  innerD: number,
  lipInfo: LipCutInfo,
  slotPositionsEdgeInset: number
): Shape3D | null {
  if (params.style !== 'slotted') return null;
  if (params.wallThickness < MIN_WALL_FOR_SLOTS) return null;

  const cutReach = lipCutReach(lipInfo, params.wallThickness);
  if (cutReach <= 0) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const { slotConfig } = params;
    const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
    const { startZ: lipCutStartZ, height: lipCutHeight } = lipCutSpan(lipInfo);

    const cutters: Shape3D[] = [];

    const addAxisLipCuts = (axis: 'x' | 'y', innerCross: number, positions: number[]): void => {
      const halfSpan = innerCross / 2;
      for (const crossPos of positions) {
        const lipCutters = createMirroredLipCutters(
          cutReach,
          slotDepth,
          slotWidth,
          lipCutHeight,
          halfSpan,
          crossPos,
          lipCutStartZ,
          axis
        );
        for (const c of lipCutters) cutters.push(scope.register(c));
      }
    };

    if (slotConfig.x.enabled) {
      const positions = calculateSlotPositions(innerD, slotConfig.x.pitch, slotPositionsEdgeInset);
      addAxisLipCuts('x', innerW, positions);
    }

    if (slotConfig.y.enabled) {
      const positions = calculateSlotPositions(innerW, slotConfig.y.pitch, slotPositionsEdgeInset);
      addAxisLipCuts('y', innerD, positions);
    }

    if (cutters.length === 0) return null;
    const fused =
      cutters.length === 1 ? cutters[0] : scope.register(unwrap(fuseAll(cutters as ValidSolid[])));
    return unwrap(clone(fused));
  });
}

function buildSlotCutsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  lipInfo: LipCutInfo | undefined,
  seat: DividerSeat
): Shape3D | null {
  const { slotConfig } = params;
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);

  // Wall slots start where the divider seats: the floor top, dropped by the
  // groove depth when the floor carries one. That puts the lock's head pocket
  // at groove level with the throat closing over the tab right at the surface;
  // a slot that starts inside the floor buries the pocket where no divider can
  // reach it, and one that starts at Z=0 cuts into the socket below.
  const slotStartZ = seat.floorZ - seat.grooveDepth;
  const slotHeight = wallHeight - slotStartZ;
  if (slotHeight <= 0) return null;
  // The groove runs on into each wall slot's pocket, stopping short of the
  // pocket's outer face so the two cutters overlap instead of sharing it.
  const grooveReach = slotDepth - SLOT_EXTENSION;
  const wallCutters = (halfSpan: number, crossPos: number, axis: 'x' | 'y'): Shape3D[] =>
    createMirroredLockingCutters(
      slotDepth,
      slotWidth,
      params.dividerPieces.thickness,
      params.dividerPieces.clearance,
      slotHeight,
      halfSpan,
      crossPos,
      slotStartZ,
      axis
    );
  // Over an interior fillet each divider line is cut whole, its channels and
  // groove together; the lip cutters below are the same either way.
  const fillet = seat.fillet ?? null;
  const filletSizes: FilletSlotSizes | null = fillet && {
    fillet,
    slotDepth,
    slotWidth,
    thickness: params.dividerPieces.thickness,
    clearance: params.dividerPieces.clearance,
    slotHeight,
    seatZ: slotStartZ,
    floorTop: seat.floorZ,
  };

  // Lip overhang: the lip taper extends inward past the inner wall surface.
  // Only cut the interior overhang — leave the outer rim intact.
  // overhang = lipTaperWidth - wallThickness (e.g. 2.6 - 0.95 = 1.65mm)
  const lipOverhang = lipInfo ? Math.max(0, lipInfo.lipTaperWidth - params.wallThickness) : 0;
  const cutReach = lipInfo ? lipCutReach(lipInfo, params.wallThickness) : 0;

  // The lip's angled support hangs below wallHeight and protrudes past the inner
  // wall, down to `supportDepth` on a thin wall. The cutters start at its foot,
  // or a strip of it stays across the slot and blocks the divider.
  const { startZ: lipCutStartZ, height: lipCutHeight } = lipInfo
    ? lipCutSpan(lipInfo)
    : { startZ: 0, height: 0 };

  const slots: Shape3D[] = [];

  const addAxisSlots = (axis: 'x' | 'y', innerCross: number, positions: number[]): void => {
    const halfSpan = innerCross / 2;

    for (const crossPos of positions) {
      if (filletSizes) {
        const line = {
          axis,
          halfSpan,
          crossPos,
          from: -halfSpan,
          to: halfSpan,
          lowWall: true,
          highWall: true,
        };
        for (const c of filletLineCutters(scope, filletSizes, line, seat.grooveDepth)) {
          slots.push(scope.register(c));
        }
      } else {
        // Wall slots (narrow, for tab engagement), from the floor surface up
        for (const c of wallCutters(halfSpan, crossPos, axis)) slots.push(scope.register(c));
      }

      if (!filletSizes && seat.grooveDepth > 0) {
        const reach = halfSpan + grooveReach;
        slots.push(
          scope.register(
            createGrooveCutter(
              axis,
              -reach,
              reach,
              crossPos,
              slotWidth,
              seat.grooveDepth,
              slotStartZ
            )
          )
        );
      }

      // Lip cutouts: remove the interior overhang above AND below wallHeight.
      // The lip profile extends below wallHeight (wall-replacement extension),
      // so the cutout must reach down to wallHeight - lipTaperWidth.
      if (lipInfo && cutReach > 0) {
        const lipCutters = createMirroredLipCutters(
          cutReach,
          slotDepth,
          slotWidth,
          lipCutHeight,
          halfSpan,
          crossPos,
          lipCutStartZ,
          axis
        );
        for (const c of lipCutters) slots.push(scope.register(c));
      }
    }
  };

  if (slotConfig.layout === 'custom' && slotConfig.customGrid) {
    // Authored layout: cut only the wall(s) each segment actually touches
    // (a custom divider may reach one wall, both, or neither).
    const EPS = 1e-6;
    const keepSide = (touched: boolean, cutter: Shape3D): void => {
      if (touched) slots.push(scope.register(cutter));
      else cutter.delete();
    };
    for (const seg of deriveWallSegments(slotConfig.customGrid, innerW, innerD)) {
      const vertical = seg.orientation === 'vertical';
      // Vertical dividers seat in the front/back walls (axis 'y') at x; the
      // low/high ends touch the front (y=0) / back (y=innerD) walls.
      const axis = vertical ? 'y' : 'x';
      const halfSpan = vertical ? innerD / 2 : innerW / 2;
      const crossPos = vertical ? seg.x - innerW / 2 : seg.y - innerD / 2;
      const runMax = vertical ? innerD : innerW;
      const low = vertical ? seg.y : seg.x;
      const lowTouch = low <= EPS;
      const highTouch = low + seg.length >= runMax - EPS;

      if (filletSizes) {
        const line = {
          axis,
          halfSpan,
          crossPos,
          from: low - halfSpan,
          to: low + seg.length - halfSpan,
          lowWall: lowTouch,
          highWall: highTouch,
        } as const;
        if (lowTouch || highTouch) {
          for (const c of filletLineCutters(scope, filletSizes, line, seat.grooveDepth)) {
            slots.push(scope.register(c));
          }
        } else if (seat.grooveDepth > 0) {
          slots.push(
            scope.register(
              createGrooveCutter(
                axis,
                line.from,
                line.to,
                crossPos,
                slotWidth,
                seat.grooveDepth,
                slotStartZ
              )
            )
          );
        }
      } else {
        const sides = wallCutters(halfSpan, crossPos, axis);
        for (let i = 0; i < sides.length; i += 2) {
          keepSide(lowTouch, sides[i]);
          keepSide(highTouch, sides[i + 1]);
        }
      }

      if (!filletSizes && seat.grooveDepth > 0) {
        // A wall-anchored end reaches into its slot pocket; an abutting end
        // stops at the crossing divider, whose own groove runs through the
        // junction.
        slots.push(
          scope.register(
            createGrooveCutter(
              axis,
              low - halfSpan - (lowTouch ? grooveReach : 0),
              low + seg.length - halfSpan + (highTouch ? grooveReach : 0),
              crossPos,
              slotWidth,
              seat.grooveDepth,
              slotStartZ
            )
          )
        );
      }

      if (lipInfo && cutReach > 0) {
        const [negLip, posLip] = createMirroredLipCutters(
          cutReach,
          slotDepth,
          slotWidth,
          lipCutHeight,
          halfSpan,
          crossPos,
          lipCutStartZ,
          axis
        );
        keepSide(lowTouch, negLip);
        keepSide(highTouch, posLip);
      }
    }
  } else {
    // X-axis slots: cut into left and right walls (for Y-direction dividers)
    if (slotConfig.x.enabled) {
      const positions = calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang);
      addAxisSlots('x', innerW, positions);
    }

    // Y-axis slots: cut into front and back walls (for X-direction dividers)
    if (slotConfig.y.enabled) {
      const positions = calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang);
      addAxisSlots('y', innerD, positions);
    }
  }

  if (slots.length === 0) return null;
  if (slots.length === 1) return slots[0];

  // Batch-fuse all slots into a single compound for one boolean cut
  return scope.register(unwrap(fuseAll(slots as ValidSolid[])));
}

// --- FeatureBuilder protocol ---

import type { FeatureBuilder } from './pipeline/featureBuilder';
import { FeatureTag } from './featureTags';
import { buildCacheKey, quantize, stableSerialize, compactKey } from './cacheKeyUtils';
import { LIP_HEIGHT, LIP_TAPER_WIDTH } from './generatorConstants';
import { LIP_NOTCH_REACH_MM } from '@/shared/utils/lipNotchPlan';
import { resolveDividerFilletSeat } from '@/shared/utils/slottedFillet';
import type { PipelineContext } from './pipeline/types';
import { interiorFilletApplies, slottedCavity } from './interiorFilletBuilder';

/** How the slots meet the interior fillet, or null when the walls carry none. */
function filletSeatFor(ctx: PipelineContext): DividerFilletSeat | null {
  const { params, dimensions: dim } = ctx;
  if (!interiorFilletApplies(params, dim)) return null;
  return resolveDividerFilletSeat(params, slottedCavity(dim));
}

export const slotCutsFeature: FeatureBuilder = {
  name: 'slotCuts',
  tag: FeatureTag.SLOT,
  target: 'cut',
  shouldBuild: (ctx) => ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    const lipInfo = dim.hasLip
      ? {
          wallHeight: dim.wallHeight,
          lipHeight: LIP_HEIGHT,
          lipTaperWidth: LIP_TAPER_WIDTH,
          supportDepth: dim.lipSupportDepth,
          ...(dim.lipNotches && { inwardReach: LIP_NOTCH_REACH_MM }),
        }
      : undefined;
    // The slot is sized to accept the divider piece, so `dividerPieces` is a
    // geometry input — and it reaches no other segment: `slotConfig` describes
    // the layout and `shellKey` the body. Keyed on the RESOLVED values rather
    // than the raw params so anything the formula grows is carried too, and
    // `dividerPieces.height` (a property of the piece, not the slot) does not
    // fragment the cache. `throatWidth` is keyed alongside `slotWidth` because
    // it is a function of thickness ALONE — two piece configs with the same
    // `slotWidth` (thickness + 2·clearance) but different thickness resolve to
    // different throats, so `slotWidth` cannot stand in for it.
    const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);
    const { throatWidth } = getDividerLockPlan(
      params.dividerPieces.thickness,
      params.dividerPieces.clearance
    );
    const fillet = filletSeatFor(ctx);
    return compactKey(
      buildCacheKey(
        'v5',
        dim.shellKey,
        stableSerialize(params.slotConfig),
        quantize(slotWidth),
        quantize(slotDepth),
        quantize(throatWidth),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        quantize(dim.floorThickness),
        quantize(dim.dividerGrooveDepth),
        lipInfo
          ? buildCacheKey(
              'lip',
              quantize(lipInfo.wallHeight),
              quantize(lipInfo.lipHeight),
              quantize(lipInfo.lipTaperWidth),
              quantize(lipInfo.supportDepth),
              ...(lipInfo.inwardReach !== undefined ? [quantize(lipInfo.inwardReach)] : [])
            )
          : 'none',
        ...(fillet
          ? [buildCacheKey('fillet', quantize(fillet.channelRadius), quantize(fillet.lockLift))]
          : [])
      )
    );
  },
  build: (ctx) => {
    const { dimensions: dim, params } = ctx;
    const lipInfo = dim.hasLip
      ? {
          wallHeight: dim.wallHeight,
          lipHeight: LIP_HEIGHT,
          lipTaperWidth: LIP_TAPER_WIDTH,
          supportDepth: dim.lipSupportDepth,
          ...(dim.lipNotches && { inwardReach: LIP_NOTCH_REACH_MM }),
        }
      : undefined;
    const result = buildSlotCuts(params, dim.innerW, dim.innerD, dim.interiorHeight, lipInfo, {
      floorZ: dim.floorThickness,
      grooveDepth: dim.dividerGrooveDepth,
      fillet: filletSeatFor(ctx),
    });
    return result ? [result] : null;
  },
};
