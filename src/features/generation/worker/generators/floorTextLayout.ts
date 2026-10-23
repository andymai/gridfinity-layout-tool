/**
 * Placement of the floor caption (`surfaceText.floorText`).
 *
 * The caption takes the clear stretch of floor that holds it at the largest
 * size, then the anchor places it inside that stretch. Everything that stands
 * on or sinks into the floor is an obstacle: dividers, scoops and the interior
 * fillet (the same footprints the floor pattern keeps clear of), inserts, and
 * raised compartment floors. A cut caption also keeps off detachable-feet pin
 * recesses, because only a thin membrane covers each one.
 *
 * Frame: cavity-centred mm, X right and Y back, the frame every feature builder
 * uses before the runner applies the overhang offset. `topZ` is the floor top.
 */

import type { BinParams, TextMode, TextQuarterTurn } from '@/shared/types/bin';
import { isNestingBase, resolveFloorTextStyle } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { maximalClearRects, type WallRect } from '@/shared/utils/maximalClearRects';
import { planTypeBlock, type TypeBlockPlan } from '@/shared/utils/typePlan';
import type { ResolvedTextStyle } from '@/shared/utils/wallTextPlan';
import type { WorldKeepOut } from './dividerPatterns';
import { pinKeepOuts, standingFeatureKeepOuts } from './floorPatterns';
import { resolveFloorRaises } from './floorRaisePlan';
import { BOX_CORNER_RADIUS } from './generatorConstants';
import type { BinDimensions } from './pipeline/types';
import { getTypeMeasurer, textOpForMode } from './textBuilder';

/** Solid floor kept under an engraved floor glyph (mm). */
export const FLOOR_TEXT_ENGRAVE_FLOOR = 0.4;

const MIN_ENGRAVE_DEPTH = 0.05;

export interface FloorTextLayout {
  readonly text: string;
  readonly mode: TextMode;
  /** Engrave depth or emboss height after the floor clamp. */
  readonly depth: number;
  readonly style: ResolvedTextStyle;
  readonly rotation: TextQuarterTurn;
  /** Placement relative to the host centre, in the turned reading frame. */
  readonly plan: TypeBlockPlan;
  /** Host size in the reading frame, so swapped for a quarter turn. */
  readonly availW: number;
  readonly availD: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly topZ: number;
  readonly hostThickness: number;
  /** Ink box of the placed glyphs, unturned, in the cavity frame. */
  readonly ink: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
  };
}

/** Whether the bin has a closed, flat floor of its own for the caption to sit on. */
export function floorTextApplies(params: BinParams, dim: BinDimensions): boolean {
  if ((params.surfaceText?.floorText?.trim() ?? '') === '') return false;
  if (params.style !== 'standard' || dim.solid || dim.isSlotted || dim.isTile) return false;
  if (dim.liteFloorOpen || isNestingBase(params.base) || isPartialMask(params.cellMask)) {
    return false;
  }
  return dim.innerW > 0 && dim.innerD > 0;
}

function toRect(k: WorldKeepOut, dim: BinDimensions): WallRect {
  return {
    minU: k.xMin - dim.innerOffsetX,
    maxU: k.xMax - dim.innerOffsetX,
    minZ: k.yMin - dim.innerOffsetY,
    maxZ: k.yMax - dim.innerOffsetY,
  };
}

/** Square around each insert pocket, wide enough for either orientation. */
function insertRects(params: BinParams): WallRect[] {
  return params.inserts
    .filter((insert) => insert.cutDepth > 0 && insert.width > 0 && insert.depth > 0)
    .map((insert) => {
      const half = Math.max(insert.width, insert.depth) / 2;
      return {
        minU: insert.x - half,
        maxU: insert.x + half,
        minZ: insert.y - half,
        maxZ: insert.y + half,
      };
    });
}

function raisedFloorRects(params: BinParams, dim: BinDimensions): WallRect[] {
  const raises = resolveFloorRaises(params, dim.floorThickness, dim.interiorHeight);
  if (raises.size === 0) return [];
  const { cols, rows, cells } = params.compartments;
  const cellW = dim.innerW / cols;
  const cellD = dim.innerD / rows;
  const out: WallRect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!raises.has(cells[row * cols + col])) continue;
      out.push({
        minU: -dim.innerW / 2 + col * cellW,
        maxU: -dim.innerW / 2 + (col + 1) * cellW,
        minZ: -dim.innerD / 2 + row * cellD,
        maxZ: -dim.innerD / 2 + (row + 1) * cellD,
      });
    }
  }
  return out;
}

/** Engrave/emboss depth after the floor clamp, or null when nothing would print. */
function clampDepth(style: ResolvedTextStyle, floorThickness: number): number | null {
  if (style.mode !== 'engrave') return style.depth;
  const depth = Math.min(style.depth, floorThickness - FLOOR_TEXT_ENGRAVE_FLOOR);
  return depth < MIN_ENGRAVE_DEPTH ? null : depth;
}

/** The plan's ink box turned clockwise (seen from above) by a quarter turn. */
function turnInk(
  plan: TypeBlockPlan,
  rotation: TextQuarterTurn
): { minX: number; maxX: number; minY: number; maxY: number } {
  const { minX, maxX, minY, maxY } = plan;
  switch (rotation) {
    case 0:
      return { minX, maxX, minY, maxY };
    case 90:
      return { minX: minY, maxX: maxY, minY: -maxX, maxY: -minX };
    case 180:
      return { minX: -maxX, maxX: -minX, minY: -maxY, maxY: -minY };
    case 270:
      return { minX: -maxY, maxX: -minY, minY: minX, maxY: maxX };
  }
}

/**
 * The floor caption's placement, or null when the bin cannot carry one or no
 * clear stretch of floor holds it at `minFontSize`.
 */
export function computeFloorTextLayout(
  params: BinParams,
  dim: BinDimensions
): FloorTextLayout | null {
  if (!floorTextApplies(params, dim)) return null;
  const text = params.surfaceText?.floorText?.trim() ?? '';
  const style = resolveFloorTextStyle(params.textDefaults, params.surfaceText);
  const depth = clampDepth(style, dim.floorThickness);
  if (depth === null) return null;

  // A uniform inset of r(1 - 1/√2) keeps the corner of the box inside the
  // rounded cavity corner of radius r.
  const cornerR = Math.max(BOX_CORNER_RADIUS - params.wallThickness, 0);
  const inset = cornerR * (1 - Math.SQRT1_2);
  const bounds: WallRect = {
    minU: -dim.innerW / 2 + inset,
    maxU: dim.innerW / 2 - inset,
    minZ: -dim.innerD / 2 + inset,
    maxZ: dim.innerD / 2 - inset,
  };
  const keepOuts = [
    ...standingFeatureKeepOuts(params, dim),
    ...(textOpForMode(style.mode) === 'cut' ? pinKeepOuts(params, dim) : []),
  ];
  const obstacles = [
    ...keepOuts.map((k) => toRect(k, dim)),
    ...insertRects(params),
    ...raisedFloorRects(params, dim),
  ];

  const rotation = params.surfaceText?.floorTextRotation ?? 0;
  const sideways = rotation === 90 || rotation === 270;
  const measurer = getTypeMeasurer();
  let best: { rect: WallRect; plan: TypeBlockPlan; area: number } | null = null;
  for (const rect of maximalClearRects(bounds, obstacles)) {
    const w = rect.maxU - rect.minU;
    const d = rect.maxZ - rect.minZ;
    const plan = planTypeBlock(
      { text, style, host: sideways ? { width: d, depth: w } : { width: w, depth: d } },
      measurer
    );
    if (!plan) continue;
    const area = w * d;
    if (
      best === null ||
      plan.fontSize > best.plan.fontSize + 1e-6 ||
      (Math.abs(plan.fontSize - best.plan.fontSize) <= 1e-6 && area > best.area)
    ) {
      best = { rect, plan, area };
    }
  }
  if (!best) return null;

  const { rect, plan } = best;
  const w = rect.maxU - rect.minU;
  const d = rect.maxZ - rect.minZ;
  const centerX = (rect.minU + rect.maxU) / 2;
  const centerY = (rect.minZ + rect.maxZ) / 2;
  const turned = turnInk(plan, rotation);
  return {
    text,
    mode: style.mode,
    depth,
    style,
    rotation,
    plan,
    availW: sideways ? d : w,
    availD: sideways ? w : d,
    centerX,
    centerY,
    topZ: dim.floorThickness,
    hostThickness: dim.floorThickness,
    ink: {
      minX: centerX + turned.minX,
      maxX: centerX + turned.maxX,
      minY: centerY + turned.minY,
      maxY: centerY + turned.maxY,
    },
  };
}
