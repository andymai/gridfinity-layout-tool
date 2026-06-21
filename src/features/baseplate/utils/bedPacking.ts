/**
 * Estimate how many build-plate loads (print jobs) a set of pieces needs.
 *
 * Pieces are packed onto bed-sized bins with a deterministic shelf
 * First-Fit-Decreasing heuristic: sort by longest side, lay each piece on the
 * first horizontal shelf (across any open bin) where it fits in either
 * orientation, else start a new shelf, else open a new bed. Each piece may be
 * rotated 90° (slicers allow it). The split planner only needs relative
 * accuracy to compare candidate tilings, so an exact 2D bin-packer is overkill;
 * grid pieces are uniform enough that shelf packing tracks the real count well.
 */

/** A piece footprint on the bed, in mm (orientation-agnostic). */
export interface Footprint {
  readonly w: number;
  readonly d: number;
}

const EPS = 1e-6;

interface Shelf {
  /** Shelf height (mm) — the depth budget this shelf consumes in its bin. */
  height: number;
  /** Width already consumed along the bed (mm). */
  usedW: number;
}

interface Bin {
  shelves: Shelf[];
  /** Total shelf height stacked so far (mm). */
  usedD: number;
}

/** Try to seat one piece in a bin; returns true if placed. Mutates `bin`. */
function placeInBin(
  bin: Bin,
  longSide: number,
  shortSide: number,
  bedW: number,
  bedD: number
): boolean {
  // Existing shelves: fit if some orientation's height ≤ shelf height and
  // width ≤ remaining bed width.
  for (const shelf of bin.shelves) {
    for (const [w, h] of [
      [longSide, shortSide],
      [shortSide, longSide],
    ] as const) {
      if (h <= shelf.height + EPS && w <= bedW - shelf.usedW + EPS) {
        shelf.usedW += w;
        return true;
      }
    }
  }

  // New shelf: pick the orientation with the smaller height (saves vertical
  // budget) among those whose width fits the bed; the shelf must fit the
  // remaining bed depth.
  let best: { w: number; h: number } | null = null;
  for (const [w, h] of [
    [longSide, shortSide],
    [shortSide, longSide],
  ] as const) {
    if (w <= bedW + EPS && (best === null || h < best.h)) best = { w, h };
  }
  if (best && bin.usedD + best.h <= bedD + EPS) {
    bin.shelves.push({ height: best.h, usedW: best.w });
    bin.usedD += best.h;
    return true;
  }
  return false;
}

/**
 * Number of bed loads needed to print `pieces`, packing as many as fit per bed.
 * A piece that fits no orientation of an empty bed still gets its own bed (the
 * planner's fit check prevents that upstream, but we stay total here).
 */
export function estimateBedLoads(pieces: readonly Footprint[], bedW: number, bedD: number): number {
  const items = pieces
    .filter((p) => p.w > EPS && p.d > EPS)
    .map((p) => ({ long: Math.max(p.w, p.d), short: Math.min(p.w, p.d) }))
    .sort((a, b) => b.long - a.long || b.short - a.short);
  if (items.length === 0) return 0;

  const bins: Bin[] = [];
  for (const it of items) {
    let placed = false;
    for (const bin of bins) {
      if (placeInBin(bin, it.long, it.short, bedW, bedD)) {
        placed = true;
        break;
      }
    }
    if (!placed) {
      const bin: Bin = { shelves: [], usedD: 0 };
      placeInBin(bin, it.long, it.short, bedW, bedD);
      bins.push(bin);
    }
  }
  return bins.length;
}
