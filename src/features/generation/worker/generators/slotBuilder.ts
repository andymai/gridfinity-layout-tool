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

import { drawRectangle } from 'replicad';
import type { Shape3D, Sketch } from 'replicad';
import type { BinParams } from '@/shared/types/bin';
import {
  calculateSlotPositions,
  getEffectiveSlotDimensions as getEffectiveSlotDimensionsRaw,
} from '@/shared/utils/slotMath';

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

  const { slotConfig } = params;
  const { slotWidth, slotDepth } = getEffectiveSlotDimensions(params);

  const slots: Shape3D[] = [];

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

  // X-axis slots: cut into left and right walls (for Y-direction dividers)
  if (slotConfig.x.enabled) {
    const positions = calculateSlotPositions(innerD, slotConfig.x.pitch, lipOverhang);
    for (const yPos of positions) {
      // Wall slots (narrow, for tab engagement) — start at floor surface
      const leftSlot = (
        drawRectangle(slotDepth, slotWidth).sketchOnPlane('XY') as unknown as Sketch
      ).extrude(slotHeight) as Shape3D;
      slots.push(leftSlot.translate([-innerW / 2 - slotDepth / 2, yPos, floorZ]));

      const rightSlot = (
        drawRectangle(slotDepth, slotWidth).sketchOnPlane('XY') as unknown as Sketch
      ).extrude(slotHeight) as Shape3D;
      slots.push(rightSlot.translate([innerW / 2 + slotDepth / 2, yPos, floorZ]));

      // Lip cutouts: remove the interior overhang above AND below wallHeight.
      // The lip profile extends below wallHeight (wall-replacement extension),
      // so the cutout must reach down to wallHeight - lipTaperWidth.
      if (lipInfo && lipOverhang > 0) {
        const leftLip = (
          drawRectangle(lipOverhang, slotWidth).sketchOnPlane('XY') as unknown as Sketch
        ).extrude(lipCutHeight) as Shape3D;
        slots.push(leftLip.translate([-(innerW / 2 - lipOverhang / 2), yPos, lipCutStartZ]));

        const rightLip = (
          drawRectangle(lipOverhang, slotWidth).sketchOnPlane('XY') as unknown as Sketch
        ).extrude(lipCutHeight) as Shape3D;
        slots.push(rightLip.translate([innerW / 2 - lipOverhang / 2, yPos, lipCutStartZ]));
      }
    }
  }

  // Y-axis slots: cut into front and back walls (for X-direction dividers)
  if (slotConfig.y.enabled) {
    const positions = calculateSlotPositions(innerW, slotConfig.y.pitch, lipOverhang);
    for (const xPos of positions) {
      // Wall slots (narrow) — start at floor surface
      const frontSlot = (
        drawRectangle(slotWidth, slotDepth).sketchOnPlane('XY') as unknown as Sketch
      ).extrude(slotHeight) as Shape3D;
      slots.push(frontSlot.translate([xPos, -innerD / 2 - slotDepth / 2, floorZ]));

      const backSlot = (
        drawRectangle(slotWidth, slotDepth).sketchOnPlane('XY') as unknown as Sketch
      ).extrude(slotHeight) as Shape3D;
      slots.push(backSlot.translate([xPos, innerD / 2 + slotDepth / 2, floorZ]));

      // Lip cutouts: remove the interior overhang (same Z range as X-axis)
      if (lipInfo && lipOverhang > 0) {
        const frontLip = (
          drawRectangle(slotWidth, lipOverhang).sketchOnPlane('XY') as unknown as Sketch
        ).extrude(lipCutHeight) as Shape3D;
        slots.push(frontLip.translate([xPos, -(innerD / 2 - lipOverhang / 2), lipCutStartZ]));

        const backLip = (
          drawRectangle(slotWidth, lipOverhang).sketchOnPlane('XY') as unknown as Sketch
        ).extrude(lipCutHeight) as Shape3D;
        slots.push(backLip.translate([xPos, innerD / 2 - lipOverhang / 2, lipCutStartZ]));
      }
    }
  }

  if (slots.length === 0) return null;

  // Pre-fuse all slots into a single compound for one boolean cut
  let compound = slots[0];
  for (let i = 1; i < slots.length; i++) {
    compound = compound.fuse(slots[i]);
  }

  return compound;
}
