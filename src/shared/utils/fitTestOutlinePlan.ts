/**
 * Outline fit test planning: pure, kernel-free, shared by the worker that
 * traces the rings and the export dialog that sizes, prices and warns about
 * them before anything is generated.
 *
 * The outline is a thin ring around each opening, its inner edge the real
 * pocket wall. A maker leaves it on the build plate and sets the part on it
 * from above, so it answers the 2D question (shape and XY clearance) for a few
 * layers of filament instead of a whole card.
 */

import type { BinParams, Cutout } from '@/shared/types/bin';
import {
  fitTestCutoutBoxes,
  openingPerimeterMm,
  planFitTestSplit,
  sumOverCutouts,
} from '@/shared/utils/fitTestPlan';
import type { BedSize, CutoutBox2D, FitTestSplitPlan } from '@/shared/utils/fitTestPlan';

/**
 * What the fit test prints: the full card (a slice of the bin top with every
 * opening through it), or only a ring traced around each opening.
 */
export type FitTestMode = 'card' | 'outline';

/** A stepper's legal band, with the value it opens on. */
export interface FitTestRange {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step: number;
}

/** Ring height (mm). The floor is one layer; the default is three, enough for
 *  the rings to peel off the plate in one piece. */
export const FIT_TEST_OUTLINE_HEIGHT_MM: FitTestRange = {
  min: 0.2,
  max: 2,
  default: 0.6,
  step: 0.2,
};

/** Ring width (mm), grown outward from the pocket wall. The default is three
 *  0.4mm extrusions; past the cap the outline is turning back into a card. */
export const FIT_TEST_OUTLINE_WALL_MM: FitTestRange = {
  min: 0.8,
  max: 2.4,
  default: 1.2,
  step: 0.4,
};

/** The ring dimensions a caller asks for. */
export interface FitTestOutlineSize {
  readonly heightMm: number;
  readonly wallMm: number;
}

function clampToRange(range: FitTestRange, value: number): number {
  if (!Number.isFinite(value)) return range.default;
  return Math.min(range.max, Math.max(range.min, value));
}

export function clampFitTestOutlineHeightMm(heightMm: number): number {
  return clampToRange(FIT_TEST_OUTLINE_HEIGHT_MM, heightMm);
}

export function clampFitTestOutlineWallMm(wallMm: number): number {
  return clampToRange(FIT_TEST_OUTLINE_WALL_MM, wallMm);
}

/** Both ring dimensions clamped, a missing one taking its default. */
export function resolveFitTestOutlineSize(size?: Partial<FitTestOutlineSize>): FitTestOutlineSize {
  return {
    heightMm: clampFitTestOutlineHeightMm(size?.heightMm ?? NaN),
    wallMm: clampFitTestOutlineWallMm(size?.wallMm ?? NaN),
  };
}

/**
 * The design an outline is traced from: the same pockets with everything that
 * is not the pocket wall taken off. An entry chamfer flares the rim past the
 * wall a part has to clear, and an engraved label, a label socket or a text
 * element each cut an outline of their own into the surface being traced.
 */
export function fitTestOutlineSource(params: BinParams): BinParams {
  return {
    ...params,
    cutouts: params.cutouts.filter((c) => c.shape !== 'text').map(outlineSourceCutout),
  };
}

function outlineSourceCutout(cutout: Cutout): Cutout {
  const { chamferWidth: _chamfer, labelMode: _labelMode, array, ...rest } = cutout;
  const stripped: Cutout = { ...rest, label: '', engraveLabel: false };
  if (!array) return stripped;
  const { labels: _labels, ...placement } = array;
  return { ...stripped, array: placement };
}

function grow(box: CutoutBox2D, by: number): CutoutBox2D {
  return { minX: box.minX - by, maxX: box.maxX + by, minY: box.minY - by, maxY: box.maxY + by };
}

/**
 * Where the outline gets cut for a given bed.
 *
 * The rings span only the openings, so an outline often fits a bed its card
 * would overflow; it is checked on that extent first. When it does overflow,
 * it takes the card's own seams, widened by the ring so a nudged seam misses
 * the ring as well as the hole. A window holding no ring yields no piece.
 */
export function planFitTestOutlineSplit(
  params: BinParams,
  bed: BedSize | undefined,
  splitPlanes: (sizeUnits: number, maxUnits: number, pitchMm: number) => number[],
  wallMm: number
): FitTestSplitPlan {
  const whole: FitTestSplitPlan = { planesX: [], planesY: [], pieceCount: 1, blockedSeams: 0 };
  const source = fitTestOutlineSource(params);
  const boxes = fitTestCutoutBoxes(source).map((b) => grow(b, wallMm));
  if (!bed || boxes.length === 0) return whole;

  const width = Math.max(...boxes.map((b) => b.maxX)) - Math.min(...boxes.map((b) => b.minX));
  const depth = Math.max(...boxes.map((b) => b.maxY)) - Math.min(...boxes.map((b) => b.minY));
  if (width <= bed.width && depth <= bed.depth) return whole;

  const card = planFitTestSplit(source, bed, splitPlanes, wallMm);
  const xEdges = [-Infinity, ...card.planesX, Infinity];
  const yEdges = [-Infinity, ...card.planesY, Infinity];
  let pieces = 0;
  for (let row = 0; row + 1 < yEdges.length; row++) {
    for (let col = 0; col + 1 < xEdges.length; col++) {
      const occupied = boxes.some(
        (b) =>
          b.maxX > xEdges[col] &&
          b.minX < xEdges[col + 1] &&
          b.maxY > yEdges[row] &&
          b.minY < yEdges[row + 1]
      );
      if (occupied) pieces += 1;
    }
  }
  return { ...card, pieceCount: Math.max(1, pieces) };
}

/**
 * Material (mm³) in the outline, for the dialog's cost line.
 *
 * Each ring is priced as an outward offset of its opening: perimeter times
 * width, plus the round each convex corner adds. Rings that run into each
 * other or off the board edge are counted whole, so this reads high.
 */
export function estimateFitTestOutlineVolumeMm3(
  params: BinParams,
  size: FitTestOutlineSize
): number {
  const { wallMm, heightMm } = size;
  const ringArea = (cutout: Cutout): number => {
    const perimeter = openingPerimeterMm(cutout);
    return perimeter > 0 ? perimeter * wallMm + Math.PI * wallMm * wallMm : 0;
  };
  return sumOverCutouts(fitTestOutlineSource(params), ringArea) * heightMm;
}
