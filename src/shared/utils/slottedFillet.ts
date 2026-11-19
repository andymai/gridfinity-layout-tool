/**
 * The interior fillet in a bin with removable dividers.
 *
 * The fillet rounds the outer walls only. Where a wall slot meets it, the slot
 * channel follows the curve down to the seat, and each piece end that seats in
 * a wall slot carries a rounded bottom corner to match. The worker's slot
 * cutter, the piece builder and the preview's reference piece all read these
 * numbers, so the corner a piece is printed with is the one its slot was cut
 * for.
 */

import { GRIDFINITY } from '@/shared/constants/bin';
import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import type { DetachableFeetParams } from '@/shared/utils/detachableFeetPlan';
import { deriveWallSegments } from '@/shared/utils/compartmentGeometry';
import { INTERIOR_FILLET_HEADROOM_MM, interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';
import { isSlottedBody } from '@/shared/utils/slotFreeWalls';
import {
  calculateDividerHeight,
  calculateDividerPieceHeight,
  calculateSlotPositions,
  dividerGrooveDepth,
  getEffectiveSlotDimensions,
  isLiteFloorOpen,
  resolveBinFloorMm,
} from '@/shared/utils/slotMath';

const LIP_TAPER_WIDTH = GRIDFINITY.LIP_SMALL_TAPER + GRIDFINITY.LIP_BIG_TAPER;

/** Flat kept between a piece's rounded corner and whatever it must clear. */
const PIECE_CORNER_RESERVE_MM = 0.2;

// The interior fillet plan's own clamps (`interiorFilletPlan.finishPlan`),
// which a slotted bin's one rectangular cavity reduces to.
const CORNER_OVER_FLOOR_MM = 0.1;
const FACE_RESERVE_MM = 0.2;
const MIN_BUILT_FILLET_MM = 0.3;

/** The design fields the slotted fillet reads. */
export type SlottedFilletParams = Pick<
  BinParams,
  | 'interiorFilletMm'
  | 'style'
  | 'base'
  | 'cellMask'
  | 'wallThickness'
  | 'dividerPieces'
  | 'slotConfig'
> &
  DetachableFeetParams;

/** The cavity a slotted bin's fillet and pieces are stated against. */
export interface SlottedCavity {
  readonly innerW: number;
  readonly innerD: number;
  /** Wall height above the box bottom, before the lip. */
  readonly wallHeight: number;
  readonly hasLip: boolean;
}

/** Whether a slotted bin builds the interior fillet at all. */
export function slottedFilletApplies(params: SlottedFilletParams): boolean {
  return (
    interiorFilletRadiusMm(params) > 0 &&
    isSlottedBody(params) &&
    !isPartialMask(params.cellMask) &&
    !isLiteFloorOpen(params)
  );
}

/** How much a piece's corner radius exceeds the fillet it seats over. */
function cornerAllowance(params: SlottedFilletParams): number {
  const { thickness, clearance } = params.dividerPieces;
  const { slotDepth } = getEffectiveSlotDimensions(params.wallThickness, thickness, clearance);
  return (slotDepth + dividerGrooveDepth(params)) / 2 + clearance;
}

interface DividerLines {
  /** Distance from each divider line to the nearer outer wall parallel to it. */
  readonly wallGaps: readonly number[];
  /** Interior span of every piece that runs from wall to wall. */
  readonly wallToWall: readonly number[];
}

/** Where the wall slot cutter puts the divider lines (`slotBuilder`). */
function dividerLines(params: SlottedFilletParams, cavity: SlottedCavity): DividerLines {
  const { slotConfig } = params;
  const { innerW, innerD } = cavity;
  const wallGaps: number[] = [];
  const wallToWall: number[] = [];
  if (slotConfig.layout === 'custom' && slotConfig.customGrid) {
    const EPS = 1e-6;
    for (const seg of deriveWallSegments(slotConfig.customGrid, innerW, innerD)) {
      const vertical = seg.orientation === 'vertical';
      const across = vertical ? seg.x : seg.y;
      const run = vertical ? innerD : innerW;
      const low = vertical ? seg.y : seg.x;
      wallGaps.push(Math.min(across, (vertical ? innerW : innerD) - across));
      if (low <= EPS && low + seg.length >= run - EPS) wallToWall.push(run);
    }
    return { wallGaps, wallToWall };
  }
  const inset = cavity.hasLip ? Math.max(0, LIP_TAPER_WIDTH - params.wallThickness) : 0;
  // X-axis pieces run along the width at depth positions, Y-axis the reverse.
  if (slotConfig.x.enabled) {
    const positions = calculateSlotPositions(innerD, slotConfig.x.pitch, inset);
    for (const p of positions) wallGaps.push(innerD / 2 - Math.abs(p));
    if (positions.length > 0) wallToWall.push(innerW);
  }
  if (slotConfig.y.enabled) {
    const positions = calculateSlotPositions(innerW, slotConfig.y.pitch, inset);
    for (const p of positions) wallGaps.push(innerW / 2 - Math.abs(p));
    if (positions.length > 0) wallToWall.push(innerD);
  }
  return { wallGaps, wallToWall };
}

/** Installed height of the removable pieces. */
function pieceHeight(params: SlottedFilletParams, cavity: SlottedCavity): number {
  const seatZ = resolveBinFloorMm(params) - dividerGrooveDepth(params);
  return calculateDividerPieceHeight(params.dividerPieces, cavity.wallHeight, cavity.hasLip, seatZ);
}

/**
 * The largest fillet the removable pieces leave room for. A piece's rounded
 * corner is the fillet plus `cornerAllowance`, and it has to fit three ways:
 * short of the nearest divider parallel to the wall it seats in, so the fillet
 * never runs under a piece; twice over along a piece that spans wall to wall;
 * and below the piece's own top edge.
 */
export function slottedFilletLimitMm(params: SlottedFilletParams, cavity: SlottedCavity): number {
  const lines = dividerLines(params, cavity);
  if (lines.wallGaps.length === 0) return Infinity;
  const allowance = cornerAllowance(params);
  const halfThickness = params.dividerPieces.thickness / 2;
  let corner = pieceHeight(params, cavity) - PIECE_CORNER_RESERVE_MM;
  for (const gap of lines.wallGaps) {
    corner = Math.min(corner, gap - halfThickness - PIECE_CORNER_RESERVE_MM);
  }
  for (const span of lines.wallToWall) {
    corner = Math.min(corner, (span - PIECE_CORNER_RESERVE_MM) / 2);
  }
  return corner - allowance;
}

/**
 * The radius the fillet plan is asked for in a slotted bin: the design's own,
 * held to what the pieces leave room for. Zero when the fillet is not built.
 */
export function slottedFilletRequestMm(params: SlottedFilletParams, cavity: SlottedCavity): number {
  if (!slottedFilletApplies(params)) return 0;
  return Math.min(interiorFilletRadiusMm(params), slottedFilletLimitMm(params, cavity));
}

/**
 * The floor radius the fillet plan builds for a slotted bin's one rectangular
 * cavity, or 0 when it builds none. Mirrors `finishPlan` clamp for clamp; a
 * parity test pins the two together.
 */
export function slottedFilletRadiusMm(params: SlottedFilletParams, cavity: SlottedCavity): number {
  const requested = slottedFilletRequestMm(params, cavity);
  if (!(requested > 0)) return 0;
  const interiorHeight = Math.max(
    0,
    calculateDividerHeight({ height: 'auto' }, cavity.wallHeight, cavity.hasLip)
  );
  const side = Math.min(cavity.innerW, cavity.innerD);
  const cavityR = Math.max(GRIDFINITY.BOX_CORNER_RADIUS - params.wallThickness, 0);
  const cornerRadius = Math.min(Math.max(requested, cavityR), (side - FACE_RESERVE_MM) / 2);
  const radius = Math.min(
    requested,
    cornerRadius - CORNER_OVER_FLOOR_MM,
    side / 2 - FACE_RESERVE_MM / 2,
    interiorHeight - resolveBinFloorMm(params) - INTERIOR_FILLET_HEADROOM_MM
  );
  return radius >= MIN_BUILT_FILLET_MM ? radius : 0;
}

/** How a wall slot and the pieces that seat in it meet the fillet. */
export interface DividerFilletSeat {
  /** The floor fillet the slot cuts through. */
  readonly filletRadius: number;
  /**
   * Radius of the slot channel's curve, tangent to the slot's floor and to the
   * seat. Half the slot depth and half the groove depth wider than the fillet,
   * so the channel runs that far behind the rounding all the way down.
   */
  readonly channelRadius: number;
  /**
   * Radius of a piece's rounded bottom corner: the channel's, grown by the fit
   * clearance, so the corner stands clear of the channel everywhere above the
   * seat it rests on.
   */
  readonly cornerRadius: number;
  /**
   * Height above the seat where the slot's lock starts. The throat has to close
   * over a straight, fully engaged tab, which a piece only has above its
   * rounded corner.
   */
  readonly lockLift: number;
}

export function dividerFilletSeat(
  filletRadius: number,
  slotDepth: number,
  grooveDepth: number,
  clearance: number
): DividerFilletSeat | null {
  if (!(filletRadius > 0)) return null;
  const channelRadius = filletRadius + (slotDepth + grooveDepth) / 2;
  const cornerRadius = channelRadius + clearance;
  return { filletRadius, channelRadius, cornerRadius, lockLift: cornerRadius };
}

/** The seat for a slotted bin's pieces, or null when its walls carry no fillet. */
export function resolveDividerFilletSeat(
  params: SlottedFilletParams,
  cavity: SlottedCavity
): DividerFilletSeat | null {
  const { thickness, clearance } = params.dividerPieces;
  const { slotDepth } = getEffectiveSlotDimensions(params.wallThickness, thickness, clearance);
  return dividerFilletSeat(
    slottedFilletRadiusMm(params, cavity),
    slotDepth,
    dividerGrooveDepth(params),
    clearance
  );
}

/** Which bottom corners of one flat piece are rounded, and how far. */
export interface PieceCorners {
  readonly radius: number;
  /** The end at the piece's negative X in its flat frame. */
  readonly low: boolean;
  readonly high: boolean;
}

/** Corners for a piece from its seat, or null when neither end is rounded. */
export function pieceCorners(
  seat: DividerFilletSeat | null,
  low: boolean,
  high: boolean
): PieceCorners | null {
  if (!seat || (!low && !high)) return null;
  return { radius: seat.cornerRadius, low, high };
}

/** How high a rounded corner stands above the piece's bottom edge, `d` in from its end. */
export function cornerRiseMm(radius: number, d: number): number {
  if (d >= radius) return 0;
  const k = radius - Math.max(0, d);
  return radius - Math.sqrt(radius * radius - k * k);
}
