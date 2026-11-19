import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import { computeAuthoredDividers } from './authoredDividerMath';
import { deriveWallSegments } from './compartmentGeometry';
import {
  MIN_WALL_FOR_SLOTS,
  calculateSlotPositions,
  dividerInterior,
  getEffectiveSlotDimensions,
} from './slotMath';

const LIP_TAPER_WIDTH = GRIDFINITY_SPEC.LIP_SMALL_TAPER + GRIDFINITY_SPEC.LIP_BIG_TAPER;

/**
 * Whether the bin cuts at least one divider slot into a wall. An enabled axis
 * is not enough: a 1×1 bin at 40 mm spacing places no divider. A custom grid
 * needs a piece with an end at a wall. A custom layout without its grid falls
 * back to even spacing, as the slot builder does.
 */
export function binHasWallSlots(params: BinParams): boolean {
  if (params.style !== 'slotted' || params.wallThickness < MIN_WALL_FOR_SLOTS) return false;
  const { slotConfig, dividerPieces } = params;
  const { innerW, innerD } = dividerInterior(params);
  if (slotConfig.layout === 'custom' && slotConfig.customGrid) {
    const { slotDepth } = getEffectiveSlotDimensions(
      params.wallThickness,
      dividerPieces.thickness,
      dividerPieces.clearance
    );
    const pieces = computeAuthoredDividers(
      deriveWallSegments(slotConfig.customGrid, innerW, innerD),
      innerW,
      innerD,
      dividerPieces.thickness,
      slotDepth,
      dividerPieces.clearance
    );
    return pieces.some((piece) => piece.retention === 'wall');
  }
  // The slot builder holds slots clear of the lip's taper the same way.
  const inset = params.base.stackingLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
  const along = (axis: 'x' | 'y', innerDim: number): boolean =>
    slotConfig[axis].enabled &&
    calculateSlotPositions(innerDim, slotConfig[axis].pitch, inset).length > 0;
  return along('x', innerD) || along('y', innerW);
}
