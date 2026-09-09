/**
 * Where the vertical label slots go, and how big each is.
 *
 * A slot holds a Cullenect-standard 1u plate standing in the outer wall face:
 * a frame of wall with a window in it, a slot behind the frame the plate drops
 * into from the top, and a boss on the inside that gives the slot its back and
 * its ends where the wall is thinner than the joint. Planned here so the panel
 * (which says what fits), the worker (which fuses and cuts it) and the wall
 * pattern's keep-out read one set of numbers.
 *
 * Every dimension is in the wall's own frame: `offset` runs along the wall
 * from its centre, depths run inward from the OUTER face, and heights are
 * measured from the body bottom, the frame every wall feature shares.
 */

import {
  LABEL_PLATE_HEIGHT_MM,
  LABEL_PLATE_THICKNESS_MM,
  LABEL_SOCKET_CLEARANCE_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { isPartialMask } from '@/shared/utils/cellMask';
import { hasOverhang, resolveOverhang } from '@/shared/utils/overhang';
import type { BinParams, WallLabelSlotsConfig } from '@/shared/types/bin';

export type WallLabelSlotSide = 'front' | 'back' | 'left' | 'right';
export const WALL_LABEL_SLOT_SIDES: readonly WallLabelSlotSide[] = [
  'front',
  'back',
  'left',
  'right',
] as const;

/** Frame left in front of the plate: the wall itself, up to this much. */
export const WALL_LABEL_SLOT_FRAME_MAX_MM = 1.2;
/** A thinner frame is a single perimeter; the panel says so. */
export const WALL_LABEL_SLOT_FRAME_MIN_MM = 0.8;
/** Frame overlapping each edge of the plate, so it cannot fall forward. */
export const WALL_LABEL_SLOT_POST_OVERLAP_MM = 0.8;
/** Frame under the plate's bottom edge. */
export const WALL_LABEL_SLOT_BOTTOM_BAR_MM = 0.8;
/** Material under the plate, inside the slot. */
export const WALL_LABEL_SLOT_FLOOR_MM = 1;
/** Plate top below the wall top, so the rim still reads as a rim. */
export const WALL_LABEL_SLOT_TOP_GAP_MM = 0.3;
/** Material behind the plate. */
export const WALL_LABEL_SLOT_BACK_MM = 1;
/** Boss past each end of the slot. */
export const WALL_LABEL_SLOT_SIDE_MM = 1;
/** Slot thickness beyond the plate at a baseline nozzle. */
export const WALL_LABEL_SLOT_PLAY_MM = 0.2;
/** Pocket the slot must leave under it, so a short wall is refused rather than perforated. */
export const WALL_LABEL_SLOT_MIN_WALL_BELOW_MM = 2;
/** Thinnest block two adjacent walls' cavities may leave between them at a bin corner. */
export const WALL_LABEL_SLOT_MIN_CORNER_WALL_MM = 0.8;
/** Half-size of the channel that joins two cavities meeting at a corner. */
export const WALL_LABEL_SLOT_CORNER_RELIEF_MM = 0.5;

export const DEFAULT_WALL_LABEL_SLOTS: WallLabelSlotsConfig = {
  enabled: false,
  sides: { front: true, back: false, left: false, right: false },
  everyCells: 1,
};

export type WallLabelSlotRefusal = 'polygon' | 'overhang' | 'tooShort' | 'cellTooNarrow';

export interface WallLabelSlot {
  readonly side: WallLabelSlotSide;
  /** Along the wall from its centre (mm), in the bin's own axis for that wall. */
  readonly offset: number;
}

export interface WallLabelSlotPlan {
  readonly slots: readonly WallLabelSlot[];
  /** Plate plus its clearance: the slot's span along the wall. */
  readonly socketWidthMm: number;
  /** Opening in the frame, narrower than the plate by the post overlaps. */
  readonly windowWidthMm: number;
  /** Plate thickness plus play, grown with a coarse nozzle. */
  readonly slotThicknessMm: number;
  /** Wall left in front of the plate. */
  readonly frameMm: number;
  /** Boss inward of the wall's inner face; zero when the wall alone is deep enough. */
  readonly bossDepthMm: number;
  readonly bossWidthMm: number;
  /** Top of the wall the slot opens through. */
  readonly wallTopZ: number;
  readonly plateTopZ: number;
  /** Underside of the plate. */
  readonly floorZ: number;
  readonly bossBottomZ: number;
  readonly refusal: WallLabelSlotRefusal | null;
  /** The wall is thinner than {@link WALL_LABEL_SLOT_FRAME_MIN_MM}. */
  readonly thinWall: boolean;
}

export interface WallLabelSlotDims {
  readonly wallHeightMm: number;
  readonly gridUnitMmX: number;
  readonly gridUnitMmY: number;
}

/** A column to clear where two walls' corner-cell cavities meet, in the interior-centred frame. */
export interface WallLabelSlotCorner {
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
}

export function resolveWallLabelSlots(
  params: Pick<BinParams, 'wallLabelSlots'>
): WallLabelSlotsConfig {
  return params.wallLabelSlots ?? DEFAULT_WALL_LABEL_SLOTS;
}

export function isDefaultWallLabelSlots(config: WallLabelSlotsConfig): boolean {
  return (
    config.enabled === DEFAULT_WALL_LABEL_SLOTS.enabled &&
    config.everyCells === DEFAULT_WALL_LABEL_SLOTS.everyCells &&
    WALL_LABEL_SLOT_SIDES.every((s) => config.sides[s] === DEFAULT_WALL_LABEL_SLOTS.sides[s])
  );
}

/** Depth of the whole joint from the outer face: frame, slot and back. */
export function wallLabelSlotJointDepthMm(frameMm: number, slotThicknessMm: number): number {
  return frameMm + slotThicknessMm + WALL_LABEL_SLOT_BACK_MM;
}

function cellOffsets(cells: number, pitch: number, every: number): number[] {
  const out: number[] = [];
  const step = Math.max(1, Math.floor(every));
  for (let i = 0; i < cells; i += step) out.push((i + 0.5 - cells / 2) * pitch);
  return out;
}

export function planWallLabelSlots(
  params: BinParams,
  dims: WallLabelSlotDims,
  clearanceMm: number
): WallLabelSlotPlan {
  const config = resolveWallLabelSlots(params);
  const plateW = labelPlateWidthMm(1);
  const socketWidthMm = plateW + clearanceMm;
  const windowWidthMm = plateW - 2 * WALL_LABEL_SLOT_POST_OVERLAP_MM;
  // Play over the plate's thickness; a coarse nozzle's extra XY clearance is
  // extra play here too, for the same reason it is on a click-in socket.
  const slotThicknessMm =
    LABEL_PLATE_THICKNESS_MM +
    WALL_LABEL_SLOT_PLAY_MM +
    Math.max(0, clearanceMm - LABEL_SOCKET_CLEARANCE_MM);
  const frameMm = Math.min(params.wallThickness, WALL_LABEL_SLOT_FRAME_MAX_MM);
  const jointDepth = wallLabelSlotJointDepthMm(frameMm, slotThicknessMm);
  const bossDepthMm = Math.max(0, jointDepth - params.wallThickness);
  const bossWidthMm = socketWidthMm + 2 * WALL_LABEL_SLOT_SIDE_MM;
  const wallTopZ = dims.wallHeightMm;
  const plateTopZ = wallTopZ - WALL_LABEL_SLOT_TOP_GAP_MM;
  const floorZ = plateTopZ - LABEL_PLATE_HEIGHT_MM;
  const bossBottomZ = floorZ - WALL_LABEL_SLOT_FLOOR_MM;
  const base = {
    socketWidthMm,
    windowWidthMm,
    slotThicknessMm,
    frameMm,
    bossDepthMm,
    bossWidthMm,
    wallTopZ,
    plateTopZ,
    floorZ,
    bossBottomZ,
    thinWall: params.wallThickness < WALL_LABEL_SLOT_FRAME_MIN_MM,
  };
  const refuse = (refusal: WallLabelSlotRefusal): WallLabelSlotPlan => ({
    ...base,
    slots: [],
    refusal,
  });

  if (!config.enabled) return { ...base, slots: [], refusal: null };
  if (isPartialMask(params.cellMask)) return refuse('polygon');
  if (hasOverhang(resolveOverhang(params.overhang))) return refuse('overhang');
  if (bossBottomZ < WALL_LABEL_SLOT_MIN_WALL_BELOW_MM) return refuse('tooShort');

  const slots: WallLabelSlot[] = [];
  let narrow = false;
  for (const side of WALL_LABEL_SLOT_SIDES) {
    if (!config.sides[side]) continue;
    const alongX = side === 'front' || side === 'back';
    const pitch = alongX ? dims.gridUnitMmX : dims.gridUnitMmY;
    if (bossWidthMm > pitch) {
      narrow = true;
      continue;
    }
    const cells = alongX ? params.width : params.depth;
    for (const offset of cellOffsets(cells, pitch, config.everyCells)) {
      slots.push({ side, offset });
    }
  }
  if (slots.length === 0 && narrow) return refuse('cellTooNarrow');
  return { ...base, slots, refusal: null };
}

/**
 * On a 42 mm grid a corner cell's cavity ends exactly where the neighbouring
 * wall's cavity begins, so two slots on adjacent walls touch along one edge
 * and the export is not a manifold. Where the block between them would be
 * thinner than a printable wall, a small channel joins the cavities instead;
 * the plates keep their end stops either side of it.
 */
export function planWallLabelSlotCorners(
  plan: WallLabelSlotPlan,
  params: Pick<BinParams, 'width' | 'depth' | 'wallThickness'>,
  dims: Pick<WallLabelSlotDims, 'gridUnitMmX' | 'gridUnitMmY'>,
  inner: { readonly innerW: number; readonly innerD: number }
): WallLabelSlotCorner[] {
  const jointBack = plan.frameMm + plan.slotThicknessMm;
  const backX = inner.innerW / 2 + params.wallThickness - jointBack;
  const backY = inner.innerD / 2 + params.wallThickness - jointBack;
  const half = plan.socketWidthMm / 2;
  const has = (side: WallLabelSlotSide, offset: number): boolean =>
    plan.slots.some((s) => s.side === side && Math.abs(s.offset - offset) < 1e-6);
  const r = WALL_LABEL_SLOT_CORNER_RELIEF_MM;
  const span = (sign: number, a: number, b: number): [number, number] => {
    const lo = sign * (Math.min(a, b) - r);
    const hi = sign * (Math.max(a, b) + r);
    return lo < hi ? [lo, hi] : [hi, lo];
  };
  const corners: WallLabelSlotCorner[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const xOff = (sx * ((params.width - 1) * dims.gridUnitMmX)) / 2;
      const yOff = (sy * ((params.depth - 1) * dims.gridUnitMmY)) / 2;
      if (!has(sy > 0 ? 'back' : 'front', xOff) || !has(sx > 0 ? 'right' : 'left', yOff)) continue;
      const endX = Math.abs(xOff) + half;
      const endY = Math.abs(yOff) + half;
      if (Math.min(backX - endX, backY - endY) >= WALL_LABEL_SLOT_MIN_CORNER_WALL_MM) continue;
      corners.push({ x: span(sx, endX, backX), y: span(sy, endY, backY) });
    }
  }
  return corners;
}
