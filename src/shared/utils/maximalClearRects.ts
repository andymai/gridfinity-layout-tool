/** Clear regions of a rectangle with axis-aligned obstacles in it. */

/** A region of one wall face, in the clip frame. */
export interface WallRect {
  readonly minU: number;
  readonly maxU: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Every maximal empty rectangle of `bounds` clear of `obstacles` (already
 * border-expanded). Sweeps the strips between obstacle edges: a run of strips
 * contributes each z interval free in all of them, kept only when neither
 * neighbouring strip is also free there, so nothing returned sits inside
 * another.
 */
export function maximalClearRects(bounds: WallRect, obstacles: readonly WallRect[]): WallRect[] {
  const inside = obstacles.filter(
    (o) =>
      o.maxU > bounds.minU && o.minU < bounds.maxU && o.maxZ > bounds.minZ && o.minZ < bounds.maxZ
  );
  const edges = [
    bounds.minU,
    bounds.maxU,
    ...inside.flatMap((o) => [o.minU, o.maxU]).filter((u) => u > bounds.minU && u < bounds.maxU),
  ];
  const us = [...new Set(edges)].sort((a, b) => a - b);

  type Interval = readonly [number, number];
  const freeIn = (lo: number, hi: number): Interval[] => {
    const blocked = inside
      .filter((o) => o.minU < hi && o.maxU > lo)
      .map((o): Interval => [Math.max(o.minZ, bounds.minZ), Math.min(o.maxZ, bounds.maxZ)])
      .sort((a, b) => a[0] - b[0]);
    const free: Interval[] = [];
    let z = bounds.minZ;
    for (const [a, b] of blocked) {
      if (a > z) free.push([z, a]);
      z = Math.max(z, b);
    }
    if (bounds.maxZ > z) free.push([z, bounds.maxZ]);
    return free;
  };
  const strips = us.slice(0, -1).map((lo, i) => freeIn(lo, us[i + 1]));
  const covers = (set: readonly Interval[], [a, b]: Interval): boolean =>
    set.some(([c, d]) => c <= a && d >= b);
  const intersect = (x: readonly Interval[], y: readonly Interval[]): Interval[] =>
    x.flatMap(([a, b]) =>
      y.map(([c, d]): Interval => [Math.max(a, c), Math.min(b, d)]).filter(([lo, hi]) => hi > lo)
    );

  const out: WallRect[] = [];
  for (let i = 0; i < strips.length; i++) {
    let common: Interval[] = strips[i];
    for (let j = i; j < strips.length && common.length > 0; j++) {
      if (j > i) common = intersect(common, strips[j]);
      for (const interval of common) {
        if (i > 0 && covers(strips[i - 1], interval)) continue;
        if (j < strips.length - 1 && covers(strips[j + 1], interval)) continue;
        out.push({ minU: us[i], maxU: us[j + 1], minZ: interval[0], maxZ: interval[1] });
      }
    }
  }
  return out;
}
