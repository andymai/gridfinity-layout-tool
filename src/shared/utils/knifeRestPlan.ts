/**
 * Pure plan for a knife block's handle rest, shared by the worker (which
 * builds the solid), the preview (which places it beside the block), and the
 * panel (which explains it). Kernel-free for the same reason `labelTabPlan`
 * and `lipGapPlan` are: the main thread cannot import brepjs, and three
 * consumers must agree on one answer.
 *
 * Physical model (see types/knifeBlock.ts): the knife's spine lies flush with
 * the block top; the handle underside therefore sits one handle-diameter
 * below it (plus a deliberate drop), and each knife's saddle groove is carved
 * down to exactly that height. The rest body top snaps UP to a whole
 * Gridfinity height unit so the part stacks like everything else; grooves for
 * smaller handles simply cut deeper than the nominal groove depth.
 */

import type { BinParams, KnifeRestStyle } from '@/shared/types/bin';
import {
  knifeBlockTopZMm,
  knifeRestGrooveWidthMm,
  knifeRestSaddleZMm,
  knifeRestStyle,
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
} from '@/shared/types/bin';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import type { KnifeSlotExit } from './lipGapPlan';
import { knifeSlotWallExits } from './lipGapPlan';
import { labelTabInteriorDims } from './labelTabPlan';

/** Least solid material kept under the deepest groove (mm, above the socket). */
export const KNIFE_REST_MIN_FLOOR_MM = 2;
/** Shortest rest the plan will emit, in height units — 1u leaves a 2mm body. */
export const KNIFE_REST_MIN_HEIGHT_UNITS = 2;

/** One saddle groove across the rest's top. */
export interface KnifeRestGroove {
  /** Cross-axis centre in the block's centred interior frame (mm). */
  readonly centre: number;
  /** Groove width across the handle (mm). */
  readonly widthMm: number;
  /** Cut depth from the rest's top down to this knife's saddle (mm). */
  readonly depthMm: number;
}

export interface KnifeRestPlan {
  readonly style: KnifeRestStyle;
  /** Wall the knives exit through; the rest sits past (companion) or inside (integrated) it. */
  readonly side: KnifeSlotExit['side'];
  /** Companion footprint across the knives, in grid units (matches the block). */
  readonly crossU: number;
  /** Companion footprint along the knife axis, in grid units. */
  readonly alongU: number;
  /** Companion body height in Gridfinity height units (socket included). */
  readonly heightUnits: number;
  /** Part top above the print bottom (mm). Integrated: the shelf surface. */
  readonly bodyTopZMm: number;
  readonly grooves: readonly KnifeRestGroove[];
  /** Free drawer space between block face and companion rest (mm). */
  readonly gapMm: number;
}

function majoritySide(exits: readonly KnifeSlotExit[]): KnifeSlotExit['side'] {
  const counts = new Map<KnifeSlotExit['side'], number>();
  for (const e of exits) counts.set(e.side, (counts.get(e.side) ?? 0) + 1);
  let best = exits[0].side;
  for (const [side, n] of counts) if (n > (counts.get(best) ?? 0)) best = side;
  return best;
}

/**
 * Resolve the rest a design's knife slots imply, or null when no rest can
 * exist: disabled, non-solid host, or no open-ended knife slot to serve.
 */
export function planKnifeRest(params: BinParams): KnifeRestPlan | null {
  const rest = params.knifeRest;
  if (rest === undefined || !rest.enabled) return null;
  const dims = labelTabInteriorDims(params);
  if (!dims) return null;
  const exits = knifeSlotWallExits(params, dims.innerW, dims.innerD);
  if (exits.length === 0) return null;

  const side = majoritySide(exits);
  const onSide = exits.filter((e) => e.side === side);
  const style = knifeRestStyle(rest);
  const blockTop = knifeBlockTopZMm(params);
  const grooveDepth = rest.grooveDepthMm ?? KNIFE_REST_GROOVE_DEPTH_MM;
  const minSaddle = GRIDFINITY_SPEC.SOCKET_HEIGHT + KNIFE_REST_MIN_FLOOR_MM;
  const saddles = onSide.map((e) =>
    Math.max(minSaddle, Math.min(knifeRestSaddleZMm(blockTop, e.knife), blockTop))
  );
  const idealTop = Math.max(...saddles) + grooveDepth;

  // Companion: snap up to whole height units so the part is a citizen of the
  // grid. Integrated: the shelf is carved out of the block, so it lands on the
  // exact derived height instead.
  const heightUnits = Math.max(
    KNIFE_REST_MIN_HEIGHT_UNITS,
    Math.ceil(idealTop / params.heightUnitMm)
  );
  const bodyTopZMm = style === 'companion' ? heightUnits * params.heightUnitMm : idealTop;

  return {
    style,
    side,
    crossU: side === 'left' || side === 'right' ? params.depth : params.width,
    alongU: rest.depthU ?? 1,
    heightUnits,
    bodyTopZMm,
    grooves: onSide.map((e, i) => ({
      centre: e.centre,
      widthMm: knifeRestGrooveWidthMm(e.knife),
      depthMm: bodyTopZMm - saddles[i],
    })),
    gapMm: rest.gapMm ?? KNIFE_REST_DEFAULT_GAP_MM,
  };
}

/** Whether the worker should emit a companion rest solid for this design. */
export function shouldGenerateKnifeRest(params: BinParams): boolean {
  const plan = planKnifeRest(params);
  return plan !== null && plan.style === 'companion';
}

/**
 * Where the companion rest stands relative to the block, in the block's own
 * centred frame (mm). Both parts are built Z=0-bottom, so mating them is a
 * pure XY step: past the exit wall by half of each footprint plus the plan's
 * gap. Shared so the preview's placement and the STEP assembly's translation
 * are one answer rather than two.
 */
export function knifeRestMatedOffset(
  params: BinParams,
  plan: KnifeRestPlan
): { readonly x: number; readonly y: number } {
  const alongX = plan.side === 'left' || plan.side === 'right';
  const unit = alongX ? params.gridUnitMm : (params.gridUnitMmY ?? params.gridUnitMm);
  const blockU = alongX ? params.width : params.depth;
  const blockOuterHalf = (blockU * unit - GRIDFINITY_SPEC.TOLERANCE) / 2;
  const restOuterHalf = (plan.alongU * unit - GRIDFINITY_SPEC.TOLERANCE) / 2;
  const outward = plan.side === 'right' || plan.side === 'back' ? 1 : -1;
  const step = outward * (blockOuterHalf + plan.gapMm + restOuterHalf);
  return alongX ? { x: step, y: 0 } : { x: 0, y: step };
}

/**
 * Circular-segment radius for a groove `widthMm` across cutting `depthMm`
 * deep: the cylinder that passes through both groove shoulders and the saddle
 * point. Shared so the worker's cutter and the preview's ghost agree.
 */
export function knifeRestGrooveRadius(widthMm: number, depthMm: number): number {
  return (widthMm ** 2 / 4 + depthMm ** 2) / (2 * depthMm);
}
