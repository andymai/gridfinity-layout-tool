/**
 * Insert cavity builder for Gridfinity bins.
 *
 * Generates insert cuts (circular, rounded-rect, slot, rectangle)
 * that are boolean-subtracted from the bin interior.
 */

import {
  drawRoundedRectangle,
  drawRectangle,
  drawCircle,
  unwrap,
  fuseAll,
  translate,
} from 'brepjs';
import type { Shape3D, Drawing } from 'brepjs';
import type { BinParams } from '@/shared/types/bin';
import { sketch } from './meshUtils';
/**
 * Build the 2D insert profile (Drawing) for a given insert shape.
 * All profiles are centered at the origin.
 */
function makeInsertProfile(
  shape: string,
  width: number,
  depth: number,
  cornerRadius: number
): Drawing {
  switch (shape) {
    case 'circle':
    case 'hexagon':
      // Hexagon approximated with circle (polygon support TBD)
      return drawCircle(width / 2);
    case 'rounded-rect': {
      const maxR = Math.min(width, depth) / 2 - 0.01;
      return drawRoundedRectangle(width, depth, Math.min(cornerRadius, maxR));
    }
    case 'slot':
      return drawRoundedRectangle(width, depth, Math.min(width, depth) / 2);
    case 'rectangle':
    default:
      return drawRectangle(width, depth);
  }
}
/**
 * Build insert cavity cuts.
 */
export function buildInsertCuts(params: BinParams): Shape3D | null {
  if (params.inserts.length === 0) return null;

  const insertShapes: Shape3D[] = [];

  for (const insert of params.inserts) {
    // Guard: skip inserts with degenerate dimensions that would crash WASM
    if (insert.cutDepth <= 0 || insert.width <= 0 || insert.depth <= 0) continue;

    const profile = makeInsertProfile(
      insert.shape,
      insert.width,
      insert.depth,
      insert.cornerRadius
    );
    const solid = sketch(profile, 'XY').extrude(insert.cutDepth);
    insertShapes.push(translate(solid, [insert.x, insert.y, 0]));
  }

  if (insertShapes.length === 0) return null;
  if (insertShapes.length === 1) return insertShapes[0];
  return unwrap(fuseAll(insertShapes));
}
