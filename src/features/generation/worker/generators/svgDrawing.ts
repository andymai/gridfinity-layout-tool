/**
 * Bridge from SVG path data to a brepjs `Drawing`.
 *
 * brepjs offers no direct route: `Drawing` is exported as a TYPE only (calling
 * `new Drawing(bp)` throws "is not a constructor"), and the `Blueprint` that
 * `importSVGPathD` returns has no `serialize()` of its own. Its individual
 * curves do, and `deserializeDrawing` accepts `{"type":"Blueprint","curves":[…]}`,
 * so this round-trip is the only supported conversion.
 *
 * Arcs survive it as exact analytic circles — a full-circle `A` path extrudes
 * to π·r²·h to double precision — so curved silhouettes are never faceted.
 */

import { deserializeDrawing, importSVGPathD, isOk } from 'brepjs';
import type { Drawing } from 'brepjs';

export function drawingFromSvgPath(pathD: string): Drawing | null {
  const imported = importSVGPathD(pathD);
  if (!isOk(imported)) return null;
  const { curves } = imported.value;
  if (curves.length === 0) return null;
  return deserializeDrawing(
    JSON.stringify({ type: 'Blueprint', curves: curves.map((curve) => curve.serialize()) })
  );
}
