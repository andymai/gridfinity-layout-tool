/**
 * Slab profile + parameter sanitation + boolean op tagging for baseplate gen.
 */

import { drawRectangle, drawRoundedRectangle, draw } from 'brepjs';
import type { Drawing } from 'brepjs';
import type { ResolvedBaseplateParams } from '@/shared/types/bin';
import { CONSTRAINTS } from '@/core/constants';
import { exteriorCorners } from '@/shared/generation/baseplateCorners';

/**
 * Build the 2D slab outline, rounding only exterior corners.
 *
 * A corner is "exterior" when both adjacent edges are exterior (not join edges).
 * For an unsplit baseplate (no edges info), all corners are rounded.
 *
 * Rectangle corners (centered at origin):
 *   front-left  (-w/2, -d/2) ← left  + front
 *   front-right (+w/2, -d/2) ← right + front
 *   back-right  (+w/2, +d/2) ← right + back
 *   back-left   (-w/2, +d/2) ← left  + back
 */
export function buildSlabProfile(
  totalW: number,
  totalD: number,
  cornerRadii: { tl: number; tr: number; bl: number; br: number },
  edges?: ResolvedBaseplateParams['edges']
): Drawing {
  const hw = totalW / 2;
  const hd = totalD / 2;
  const { tl, tr, bl, br } = cornerRadii;

  const ext = exteriorCorners(edges);

  const rBL = ext.bl && bl > 0 ? bl : 0;
  const rBR = ext.br && br > 0 ? br : 0;
  const rTR = ext.tr && tr > 0 ? tr : 0;
  const rTL = ext.tl && tl > 0 ? tl : 0;

  if (rBL === 0 && rBR === 0 && rTR === 0 && rTL === 0) {
    return drawRectangle(totalW, totalD);
  }

  if (rBL === rBR && rBR === rTR && rTR === rTL) {
    return drawRoundedRectangle(totalW, totalD, rBL);
  }

  // Draw CCW starting from mid-bottom-edge so close() creates a real
  // edge through BL, allowing customCorner(rBL) to apply correctly.
  // Starting at a corner would make close() degenerate (zero-length).
  let pen = draw([0, -hd]);
  pen = pen.lineTo([hw, -hd]);
  if (rBR > 0) pen = pen.customCorner(rBR);
  pen = pen.lineTo([hw, hd]);
  if (rTR > 0) pen = pen.customCorner(rTR);
  pen = pen.lineTo([-hw, hd]);
  if (rTL > 0) pen = pen.customCorner(rTL);
  pen = pen.lineTo([-hw, -hd]);
  if (rBL > 0) pen = pen.customCorner(rBL);
  return pen.close();
}

/**
 * Wrap a BREP boolean expression and retag any thrown error with a named
 * operation prefix. Errors reach the worker's top-level handler as
 * `baseplate.<op>: <inner>`, which gives support reports a handle for which
 * boolean in the pipeline failed — OCCT/brepjs failures otherwise come back
 * as generic `Called unwrap on an Err: ...` strings.
 */
export function tagOp<T>(op: string, fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    const inner = e instanceof Error ? e.message : String(e);
    throw new Error(`baseplate.${op}: ${inner}`, { cause: e });
  }
}

/**
 * Validate and clamp baseplate params to safe ranges.
 * Throws on clearly invalid dimensions (NaN, zero, negative) to surface
 * upstream bugs. Clamps other fields to safe ranges to prevent OOM.
 */
export function sanitizeParams(params: ResolvedBaseplateParams): ResolvedBaseplateParams {
  if (
    !Number.isFinite(params.width) ||
    params.width <= 0 ||
    !Number.isFinite(params.depth) ||
    params.depth <= 0
  ) {
    throw new Error(`Invalid baseplate dimensions: ${params.width}x${params.depth}`);
  }
  if (params.width > CONSTRAINTS.GRID_MAX || params.depth > CONSTRAINTS.GRID_MAX) {
    throw new Error(
      `Baseplate dimensions ${params.width}x${params.depth} exceed maximum ${CONSTRAINTS.GRID_MAX}`
    );
  }

  const clamp = (v: number, min: number, max: number): number =>
    Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;

  return {
    ...params,
    gridUnitMm: clamp(params.gridUnitMm, 1, 200),
    magnetDiameter: clamp(params.magnetDiameter, 0.5, 20),
    magnetDepth: clamp(params.magnetDepth, 0.5, 10),
    paddingLeft: clamp(params.paddingLeft, 0, 100),
    paddingRight: clamp(params.paddingRight, 0, 100),
    paddingFront: clamp(params.paddingFront, 0, 100),
    paddingBack: clamp(params.paddingBack, 0, 100),
  };
}
