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

import { box, unwrap, fuseAll, withScope, clone } from 'brepjs';
import type { DisposalScope } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateSlotPositions,
  getEffectiveSlotDimensions as getEffectiveSlotDimensionsRaw,
  MIN_WALL_FOR_SLOTS,
} from '@/shared/utils/slotMath';
import { COPLANAR_OVERLAP } from './generatorConstants';

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
 * Lip geometry info for slot cuts that extend through the stacking lip.
 */
export interface LipCutInfo {
  /** Wall height (z where lip starts) */
  readonly wallHeight: number;
  /** Total lip height (4.4mm per spec) */
  readonly lipHeight: number;
  /** Lip taper width — how far the lip extends inward from the outer wall (2.6mm) */
  readonly lipTaperWidth: number;
}

/**
 * Slight extension past the inner wall surface into the (hollow) bin interior.
 * Uses the shared COPLANAR_OVERLAP — avoids coplanar faces between the cutter
 * and the bin's inner wall, which cause OCCT to produce non-manifold topology
 * (slicers then drop one side on repair). The extension cuts into empty space
 * so geometry is unchanged.
 */
const SLOT_EXTENSION = COPLANAR_OVERLAP;

/**
 * Create a mirrored pair of extruded rectangular cutters along one axis.
 *
 * Produces two boxes at +/- offset along the primary axis, both centered
 * on `crossPos` along the cross axis. The primary-axis dimension is extended
 * by SLOT_EXTENSION; the offset is adjusted so the extension reaches into
 * the bin interior (avoiding coplanar faces).
 *
 * @param primaryDim  Cutter size along the primary axis (before extension)
 * @param crossDim    Cutter size along the cross axis
 * @param height      Extrusion height (Z)
 * @param halfSpan    Half of the interior dimension along the primary axis
 * @param crossPos    Position along the cross axis
 * @param z           Z origin of the extrusion
 * @param axis        'x' places cutters along X (left/right), 'y' along Y (front/back)
 */
function createMirroredCutters(
  primaryDim: number,
  crossDim: number,
  height: number,
  halfSpan: number,
  crossPos: number,
  z: number,
  axis: 'x' | 'y'
): [Shape3D, Shape3D] {
  const extDim = primaryDim + SLOT_EXTENSION;
  const centerOffset = halfSpan + primaryDim / 2;

  // Rectangle dimensions: axis='x' → (extDim, crossDim), axis='y' → (crossDim, extDim)
  const rectW = axis === 'x' ? extDim : crossDim;
  const rectD = axis === 'x' ? crossDim : extDim;

  // Negative side: outer edge at -halfSpan - primaryDim, extended inward by SLOT_EXTENSION
  const negCenter = -(centerOffset - SLOT_EXTENSION / 2);
  // Positive side: outer edge at +halfSpan + primaryDim, extended inward by SLOT_EXTENSION
  const posCenter = centerOffset - SLOT_EXTENSION / 2;

  const zCenter = z + height / 2;
  const pos = (primary: number): [number, number, number] =>
    axis === 'x' ? [primary, crossPos, zCenter] : [crossPos, primary, zCenter];
  return [
    box(rectW, rectD, height, { at: pos(negCenter) }),
    box(rectW, rectD, height, { at: pos(posCenter) }),
  ];
}

/**
 * Create a mirrored pair of lip overhang cutters along one axis.
 *
 * These remove the interior lip overhang so dividers can slide in from the
 * top. Extended by SLOT_EXTENSION into the wall for volumetric fuse overlap
 * with the wall slot cutter.
 */
function createMirroredLipCutters(
  lipOverhang: number,
  slotWidth: number,
  lipCutHeight: number,
  halfSpan: number,
  crossPos: number,
  lipCutStartZ: number,
  axis: 'x' | 'y'
): [Shape3D, Shape3D] {
  const extOverhang = lipOverhang + SLOT_EXTENSION;

  const rectW = axis === 'x' ? extOverhang : slotWidth;
  const rectD = axis === 'x' ? slotWidth : extOverhang;

  // Lip cutter sits inside the interior: centered at halfSpan - lipOverhang/2,
  // shifted outward by SLOT_EXTENSION/2 so the outer face extends past the
  // inner wall surface (halfSpan) for overlap with the wall slot cutter.
  const negCenter = -(halfSpan - lipOverhang / 2 + SLOT_EXTENSION / 2);
  const posCenter = halfSpan - lipOverhang / 2 + SLOT_EXTENSION / 2;

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
  lipInfo?: LipCutInfo
): Shape3D | null {
  if (params.style !== 'slotted') return null;

  // Wall too thin for functional slots — skip to avoid cutting through
  if (params.wallThickness < MIN_WALL_FOR_SLOTS) return null;

  return withScope((scope: DisposalScope): Shape3D | null => {
    const fused = buildSlotCutsInScope(scope, params, innerW, innerD, wallHeight, lipInfo);
    return fused ? unwrap(clone(fused)) : null;
  });
}

function buildSlotCutsInScope(
  scope: DisposalScope,
  params: BinParams,
  innerW: number,
  innerD: number,
  wallHeight: number,
  lipInfo?: LipCutInfo
): Shape3D | null {
  const { slotConfig } = params;
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);

  // The bin floor plate extends from Z=0 to Z=wallThickness (shell thickness).
  // Wall slots must start at the floor surface, not Z=0, to avoid cutting
  // through the floor into the socket below.
  const floorZ = params.wallThickness;
  const slotHeight = wallHeight - floorZ;
  if (slotHeight <= 0) return null;

  // Lip overhang: the lip taper extends inward past the inner wall surface.
  // Only cut the interior overhang — leave the outer rim intact.
  // overhang = lipTaperWidth - wallThickness (e.g. 2.6 - 0.95 = 1.65mm)
  const lipOverhang = lipInfo ? Math.max(0, lipInfo.lipTaperWidth - params.wallThickness) : 0;

  // The lip swept profile also extends BELOW wallHeight (the wall-replacement
  // extension in buildTopShape). After the wall portion cut, a triangular region
  // from X=-1.2 to X=-2.6 (profile space) remains below wallHeight, protruding
  // past the inner wall. The deepest point is lipTaperWidth (2.6mm) below wallHeight.
  // We start the cutout that far below wallHeight to catch all overhang layers.
  const lipCutStartZ = lipInfo ? lipInfo.wallHeight - lipInfo.lipTaperWidth : 0;
  const lipCutHeight = lipInfo ? lipInfo.lipTaperWidth + lipInfo.lipHeight + 1 : 0;

  const slots: Shape3D[] = [];

  const addAxisSlots = (axis: 'x' | 'y', innerCross: number, positions: number[]): void => {
    const halfSpan = innerCross / 2;

    for (const crossPos of positions) {
      // Wall slots (narrow, for tab engagement) — start at floor surface
      const wallCutters = createMirroredCutters(
        slotDepth,
        slotWidth,
        slotHeight,
        halfSpan,
        crossPos,
        floorZ,
        axis
      );
      for (const c of wallCutters) slots.push(scope.register(c));

      // Lip cutouts: remove the interior overhang above AND below wallHeight.
      // The lip profile extends below wallHeight (wall-replacement extension),
      // so the cutout must reach down to wallHeight - lipTaperWidth.
      if (lipInfo && lipOverhang > 0) {
        const lipCutters = createMirroredLipCutters(
          lipOverhang,
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

export const slotCutsFeature: FeatureBuilder = {
  name: 'slotCuts',
  tag: FeatureTag.SLOT,
  target: 'cut',
  shouldBuild: (ctx) => ctx.dimensions.isSlotted,
  cacheKey: (ctx) => {
    const { dimensions: dim, params } = ctx;
    const lipInfo = dim.hasLip
      ? { wallHeight: dim.wallHeight, lipHeight: LIP_HEIGHT, lipTaperWidth: LIP_TAPER_WIDTH }
      : undefined;
    return compactKey(
      buildCacheKey(
        'v1',
        dim.shellKey,
        stableSerialize(params.slotConfig),
        quantize(dim.innerW),
        quantize(dim.innerD),
        quantize(dim.interiorHeight),
        lipInfo
          ? buildCacheKey(
              'lip',
              quantize(lipInfo.wallHeight),
              quantize(lipInfo.lipHeight),
              quantize(lipInfo.lipTaperWidth)
            )
          : 'none'
      )
    );
  },
  build: (ctx) => {
    const { dimensions: dim, params } = ctx;
    const lipInfo = dim.hasLip
      ? { wallHeight: dim.wallHeight, lipHeight: LIP_HEIGHT, lipTaperWidth: LIP_TAPER_WIDTH }
      : undefined;
    const result = buildSlotCuts(params, dim.innerW, dim.innerD, dim.interiorHeight, lipInfo);
    return result ? [result] : null;
  },
};
