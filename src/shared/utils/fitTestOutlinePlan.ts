/**
 * Outline fit test planning, shared by the worker that traces the rings and
 * the dialog that sizes, prices and warns about them before anything is
 * generated.
 */

import type { BinParams, Cutout } from '@/shared/types/bin';
import {
  fitTestCutoutBoxes,
  fitTestFootprintBox,
  openingPerimeterMm,
  planFitTestSplit,
  sumOverCutouts,
} from '@/shared/utils/fitTestPlan';
import type { BedSize, CutoutBox2D, FitTestSplitPlan } from '@/shared/utils/fitTestPlan';
import { openSideChannelOutline, openSideChannels } from '@/shared/utils/cutoutOpenSides';
import { knifeSlotWallExits } from '@/shared/utils/lipGapPlan';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';

export type FitTestMode = 'card' | 'outline';

export interface FitTestRange {
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly step: number;
}

/** The floor is one layer; three peel off the plate in one piece. */
export const FIT_TEST_OUTLINE_HEIGHT_MM: FitTestRange = {
  min: 0.2,
  max: 2,
  default: 0.6,
  step: 0.2,
};

/** Three 0.4mm extrusions by default; past the cap the outline is turning back into a card. */
export const FIT_TEST_OUTLINE_WALL_MM: FitTestRange = {
  min: 0.8,
  max: 2.4,
  default: 1.2,
  step: 0.4,
};

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

export function resolveFitTestOutlineSize(size?: Partial<FitTestOutlineSize>): FitTestOutlineSize {
  return {
    heightMm: clampFitTestOutlineHeightMm(size?.heightMm ?? NaN),
    wallMm: clampFitTestOutlineWallMm(size?.wallMm ?? NaN),
  };
}

/**
 * The design an outline is traced from. An entry chamfer flares the rim past
 * the wall a part has to clear, and an engraved label, a label socket or a text
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

function bounds(points: readonly (readonly [number, number])[]): CutoutBox2D {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

interface Breach {
  readonly box: CutoutBox2D;
  readonly side: 'left' | 'right' | 'front' | 'back';
  /** Where the pocket ends and the channel's rails begin, on the exit axis. */
  readonly mouth: number;
}

/**
 * Open-side channels and knife exits breach the wall, so the traced ring runs
 * from the pocket out to the board edge, well past the pocket's own box.
 */
function breaches(source: BinParams): Breach[] {
  const { innerW, innerD, offsetX, offsetY } = cutoutInterior(source);
  const toModel = (alongX: boolean, v: number): number =>
    alongX ? v - innerW / 2 + offsetX : v - innerD / 2 + offsetY;
  const out: Breach[] = openSideChannels(source).map((ch) => ({
    box: bounds(
      openSideChannelOutline(ch, { innerW, innerD, wallThickness: source.wallThickness }).map(
        ([x, y]): [number, number] => [toModel(true, x), toModel(false, y)]
      )
    ),
    side: ch.side,
    mouth: toModel(ch.side === 'left' || ch.side === 'right', ch.edge),
  }));
  for (const exit of knifeSlotWallExits(source, innerW, innerD)) {
    const alongX = exit.side === 'left' || exit.side === 'right';
    const outward = exit.side === 'right' || exit.side === 'back';
    const start = exit.start + (alongX ? offsetX : offsetY);
    const across = exit.centre + (alongX ? offsetY : offsetX);
    const [lo, hi] = outward ? [start, Infinity] : [-Infinity, start];
    const [acrossLo, acrossHi] = [across - exit.width / 2, across + exit.width / 2];
    out.push({
      box: alongX
        ? { minX: lo, maxX: hi, minY: acrossLo, maxY: acrossHi }
        : { minX: acrossLo, maxX: acrossHi, minY: lo, maxY: hi },
      side: exit.side,
      mouth: exit.edge + (alongX ? offsetX : offsetY),
    });
  }
  return out;
}

/**
 * Where each ring can reach: its opening or breach grown by the ring width,
 * cut back to the board, since the rings are traced from the board's material.
 */
export function fitTestOutlineBoxes(params: BinParams, wallMm: number): CutoutBox2D[] {
  const source = fitTestOutlineSource(params);
  const board = fitTestFootprintBox(params);
  return [...fitTestCutoutBoxes(source), ...breaches(source).map((b) => b.box)]
    .map((b) => ({
      minX: Math.max(board.minX, b.minX - wallMm),
      maxX: Math.min(board.maxX, b.maxX + wallMm),
      minY: Math.max(board.minY, b.minY - wallMm),
      maxY: Math.min(board.maxY, b.maxY + wallMm),
    }))
    .filter((b) => b.maxX > b.minX && b.maxY > b.minY);
}

/**
 * Where the outline gets cut for a given bed. The rings span only the
 * openings, so an outline can fit a bed its card overflows; when it does not,
 * it takes the card's seams, held clear of every ring, breach rails included,
 * or counted as blocked. A window holding no ring yields no piece.
 */
export function planFitTestOutlineSplit(
  params: BinParams,
  bed: BedSize | undefined,
  splitPlanes: (sizeUnits: number, maxUnits: number, pitchMm: number) => number[],
  wallMm: number
): FitTestSplitPlan {
  const whole: FitTestSplitPlan = { planesX: [], planesY: [], pieceCount: 1, blockedSeams: 0 };
  const boxes = fitTestOutlineBoxes(params, wallMm);
  if (!bed || boxes.length === 0) return whole;

  const width = Math.max(...boxes.map((b) => b.maxX)) - Math.min(...boxes.map((b) => b.minX));
  const depth = Math.max(...boxes.map((b) => b.maxY)) - Math.min(...boxes.map((b) => b.minY));
  if (width <= bed.width && depth <= bed.depth) return whole;

  const card = planFitTestSplit(fitTestOutlineSource(params), bed, splitPlanes, {
    x: boxes.map((b) => ({ min: b.minX, max: b.maxX })),
    y: boxes.map((b) => ({ min: b.minY, max: b.maxY })),
  });
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
 * Material (mm³) in the outline: each ring priced as its opening offset
 * outward, and each breach as its two rails from the pocket to the board edge.
 * Rings that merge or run off the board edge, and the ring across a breach's
 * mouth, are counted whole, so this reads high.
 */
export function estimateFitTestOutlineVolumeMm3(
  params: BinParams,
  size: FitTestOutlineSize
): number {
  const { wallMm, heightMm } = size;
  const source = fitTestOutlineSource(params);
  const ringArea = (cutout: Cutout): number => {
    const perimeter = openingPerimeterMm(cutout);
    return perimeter > 0 ? perimeter * wallMm + Math.PI * wallMm * wallMm : 0;
  };
  const board = fitTestFootprintBox(params);
  const face = { left: board.minX, right: board.maxX, front: board.minY, back: board.maxY };
  const railArea = breaches(source).reduce((sum, b) => {
    const outward = b.side === 'right' || b.side === 'back';
    const length = Math.max(0, outward ? face[b.side] - b.mouth : b.mouth - face[b.side]);
    return sum + 2 * length * wallMm;
  }, 0);
  return (sumOverCutouts(source, ringArea) + railArea) * heightMm;
}
