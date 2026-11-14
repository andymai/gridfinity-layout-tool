/**
 * Whether a part fits the bed at some turn about the vertical axis, not only
 * square-on or at 90°. A long, narrow part can lie across the diagonal: 63 x
 * 294mm overruns a 256mm bed both ways round, yet fits at 45°.
 *
 * Closed form from Wetzel, "Rectangles in Rectangles" (Mathematics Magazine
 * 73, 2000): with p >= q and a >= b, a p x q rectangle fits an a x b one iff
 * it fits square-on, or p > a, q <= b and
 * ((a + b) / (p + q))^2 + ((a - b) / (p - q))^2 >= 2.
 *
 * Measured on the bounding rectangle, so a rounded corner only adds margin.
 */
export function fitsBedAtAnyAngle(
  widthMm: number,
  depthMm: number,
  bedWidthMm: number,
  bedDepthMm: number
): boolean {
  const p = Math.max(widthMm, depthMm);
  const q = Math.min(widthMm, depthMm);
  const a = Math.max(bedWidthMm, bedDepthMm);
  const b = Math.min(bedWidthMm, bedDepthMm);
  if (p <= a && q <= b) return true;
  // Also what keeps p - q non-zero below: a square part that got past the line
  // above has q > b.
  if (q > b) return false;
  return ((a + b) / (p + q)) ** 2 + ((a - b) / (p - q)) ** 2 >= 2 - 1e-9;
}
