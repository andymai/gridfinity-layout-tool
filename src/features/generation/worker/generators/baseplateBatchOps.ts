/**
 * Batched BREP boolean ops for baseplate generation.
 *
 * Larger grids (16x16 = 1024 magnet holes) would hold all tool shapes
 * simultaneously without batching, causing WASM OOM. Each batch cuts up to
 * BOOLEAN_BATCH_SIZE shapes, then disposes them before building the next.
 */

import { unwrap, cutAll } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';

/**
 * Maximum number of BREP tool shapes to cut in a single boolean pass.
 * Keeps WASM heap bounded.
 */
export const BOOLEAN_BATCH_SIZE = 64;

/**
 * Cut an array of tool shapes from a solid in batches.
 *
 * Consumes `solid` on both success and failure — callers must not reference
 * it after this call. On error, disposes `result` and all remaining
 * unprocessed tools before rethrowing.
 */
export function cutInBatches(solid: Shape3D, tools: Shape3D[]): Shape3D {
  if (tools.length === 0) return solid;

  let result = solid;
  let processed = 0;

  try {
    for (let i = 0; i < tools.length; i += BOOLEAN_BATCH_SIZE) {
      const end = Math.min(i + BOOLEAN_BATCH_SIZE, tools.length);
      const batch = tools.slice(i, end);
      const prev = result;
      result = unwrap(cutAll(result as ValidSolid, batch as ValidSolid[]));
      prev.delete();
      for (const t of batch) t.delete();
      processed = end;
    }
  } catch (e) {
    for (let j = processed; j < tools.length; j++) tools[j].delete();
    result.delete();
    throw e;
  }

  return result;
}
