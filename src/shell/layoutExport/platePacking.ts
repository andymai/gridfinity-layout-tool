/**
 * Packs export parts onto build plates.
 *
 * Shelf-based first-fit-decreasing: parts are sorted deepest-first and laid
 * into rows across the bed, opening a new plate when the current one runs out
 * of depth. Good enough for gridfinity footprints, which are near-uniform
 * multiples of 42mm, and it keeps the result stable and inspectable rather
 * than chasing optimal packing.
 *
 * Pure and self-contained so the placement can be asserted without a kernel or
 * a slicer: the world transform written into `3dmodel.model` and the plate
 * assignment written into `model_settings.config` are both derived from this
 * output, and they must agree or parts float off their plate.
 */

/** A part to place, measured by its footprint bounding box. */
export interface PlatePackingItem {
  readonly widthMm: number;
  readonly depthMm: number;
}

/** Where a part ended up: plate index plus its centre on that plate. */
export interface PlatePlacement {
  /** Zero-based plate index. */
  readonly plate: number;
  /** Centre offset from the plate's front-left usable corner, in mm. */
  readonly x: number;
  readonly y: number;
}

export interface PlatePackingOptions {
  readonly bedWidthMm: number;
  readonly bedDepthMm: number;
  /** Gap between neighbouring parts, in mm. */
  readonly spacingMm: number;
  /** Keep-out inset from each bed edge, in mm. */
  readonly marginMm: number;
}

export interface PlatePackingResult {
  /** One placement per input item, in input order. */
  readonly placements: readonly PlatePlacement[];
  readonly plateCount: number;
  /**
   * Indices of items too large for the usable bed area at any rotation. They
   * are still placed (on their own plate, centred) rather than dropped, so an
   * oversize part reaches the slicer visibly instead of vanishing from the
   * export.
   */
  readonly oversizeIndices: readonly number[];
}

export const DEFAULT_PART_SPACING_MM = 4;
export const DEFAULT_PLATE_MARGIN_MM = 5;

/**
 * Plate grid geometry, mirroring OrcaSlicer/BambuStudio `PartPlateList`.
 *
 * Plates are not a list but a square-ish grid in world space, and every plate
 * origin is a multiple of the bed size plus a fixed 1/5 gap
 * (`LOGICAL_PART_PLATE_GAP` in `PartPlate.hpp`). Y advances NEGATIVE per row.
 */
export const LOGICAL_PLATE_GAP = 1 / 5;

/** Columns the slicer lays plates out in for a given plate count. */
export function plateColumnCount(plateCount: number): number {
  if (plateCount <= 1) return 1;
  const value = Math.sqrt(plateCount);
  const rounded = Math.round(value);
  return value > rounded ? rounded + 1 : rounded;
}

/** World-space origin of plate `index` within a `plateCount` grid. */
export function plateOrigin(
  index: number,
  plateCount: number,
  bedWidthMm: number,
  bedDepthMm: number
): { x: number; y: number } {
  const cols = plateColumnCount(plateCount);
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: col * bedWidthMm * (1 + LOGICAL_PLATE_GAP),
    // Row 0 is written explicitly rather than as `-0 * depth`: negative zero
    // survives into the transform matrix and serialises as "-0".
    y: row === 0 ? 0 : -row * bedDepthMm * (1 + LOGICAL_PLATE_GAP),
  };
}

interface Shelf {
  /** Front edge of the shelf, measured from the usable area's front edge. */
  readonly y: number;
  /** Depth of the tallest part on the shelf. */
  depth: number;
  /** Next free X on the shelf. */
  cursorX: number;
}

export function packOntoPlates(
  items: readonly PlatePackingItem[],
  options: PlatePackingOptions
): PlatePackingResult {
  const { bedWidthMm, bedDepthMm, spacingMm, marginMm } = options;
  const usableW = Math.max(0, bedWidthMm - 2 * marginMm);
  const usableD = Math.max(0, bedDepthMm - 2 * marginMm);

  const placements: PlatePlacement[] = new Array<PlatePlacement>(items.length);
  const oversizeIndices: number[] = [];

  // Deepest-first, tie-broken by width, so shelves start with their tallest
  // member and later parts fill the gap beside it. Index carried through so the
  // result can be returned in input order.
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.depthMm - a.item.depthMm || b.item.widthMm - a.item.widthMm);

  let plate = 0;
  let shelves: Shelf[] = [];
  let plateUsedDepth = 0;
  // Highest plate index actually occupied. Tracked separately from `plate`
  // because opening a plate for the NEXT part must not count as a used one:
  // an oversize part at the end would otherwise report a trailing empty plate.
  let maxPlateUsed = -1;

  const openPlate = (): void => {
    plate += 1;
    shelves = [];
    plateUsedDepth = 0;
  };

  for (const { item, index } of order) {
    if (item.widthMm > usableW || item.depthMm > usableD) {
      // Oversize: give it an exclusive plate so it cannot collide with a part
      // that does fit, and report it rather than silently dropping it.
      if (shelves.length > 0) openPlate();
      oversizeIndices.push(index);
      placements[index] = { plate, x: marginMm + usableW / 2, y: marginMm + usableD / 2 };
      maxPlateUsed = Math.max(maxPlateUsed, plate);
      openPlate();
      continue;
    }

    let shelf = shelves.find((s) => s.cursorX + item.widthMm <= usableW && item.depthMm <= s.depth);

    if (!shelf) {
      const shelfY = plateUsedDepth === 0 ? 0 : plateUsedDepth + spacingMm;
      if (shelfY + item.depthMm > usableD) {
        openPlate();
        shelf = { y: 0, depth: item.depthMm, cursorX: 0 };
        shelves.push(shelf);
        plateUsedDepth = item.depthMm;
      } else {
        shelf = { y: shelfY, depth: item.depthMm, cursorX: 0 };
        shelves.push(shelf);
        plateUsedDepth = shelfY + item.depthMm;
      }
    }

    placements[index] = {
      plate,
      x: marginMm + shelf.cursorX + item.widthMm / 2,
      y: marginMm + shelf.y + item.depthMm / 2,
    };
    shelf.cursorX += item.widthMm + spacingMm;
    maxPlateUsed = Math.max(maxPlateUsed, plate);
  }

  return {
    placements,
    plateCount: maxPlateUsed + 1,
    oversizeIndices: oversizeIndices.sort((a, b) => a - b),
  };
}
