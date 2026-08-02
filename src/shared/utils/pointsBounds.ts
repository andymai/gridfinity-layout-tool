/**
 * Axis-aligned bounding box of a 2D point list.
 *
 * An empty input yields the inverted-infinite box
 * (`minX`/`minY` = +Infinity, `maxX`/`maxY` = -Infinity) — the min/max
 * identity every caller's hand-rolled loop already produced. Callers that need
 * a concrete box guard the empty case themselves or test `Number.isFinite` on
 * the result.
 */
export function pointsBounds(points: readonly { x: number; y: number }[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
