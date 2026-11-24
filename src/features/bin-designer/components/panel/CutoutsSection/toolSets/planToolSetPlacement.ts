import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import type { GeneratedToolSet } from '@/shared/toolSets/generateToolSet';
import { shiftCutout } from '@/shared/toolSets/generateToolSet';
import { getRotatedBounds } from '../geometryCore';
import { computeGrowToFit } from '../growBinToFit';
import { getOffBoardCutoutIds } from '../offBoardCutouts';
import { binBoard } from '../packIntoBin';

/** Room between a set and the bin wall or the bin's other pockets. */
const SET_MARGIN_MM = 3;
/** Plastic kept under the deepest pocket, above the bin's own floor. */
const MIN_FLOOR_UNDER_MM = 1;

export interface ToolSetPlacement {
  /** Where the set's origin goes on the board. */
  readonly dx: number;
  readonly dy: number;
  /** The bin size to grow to first, when the set needs more room. */
  readonly size: { readonly width: number; readonly depth: number } | null;
  /** The height to raise the bin to, when the deepest pocket needs it. */
  readonly height: number | null;
}

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** A plain box standing in for the room a set needs, for sizing the bin. */
function envelope(width: number, depth: number): Cutout {
  return {
    id: 'tool-set-envelope',
    shape: 'rectangle',
    x: 0,
    y: 0,
    width,
    depth,
    cutDepth: 1,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  };
}

/** Every copy a cutout cuts, as boxes grown by its clearance. */
export function cutBoxes(cutouts: readonly Cutout[]): Box[] {
  return cutouts.flatMap((c) =>
    expandCutoutArray(c).map((copy) => {
      const b = getRotatedBounds(copy);
      const pad = c.clearance ?? 0;
      return { minX: b.minX - pad, minY: b.minY - pad, maxX: b.maxX + pad, maxY: b.maxY + pad };
    })
  );
}

export function boxesOverlap(a: Box, b: Box, gap: number): boolean {
  return (
    a.minX < b.maxX + gap && b.minX < a.maxX + gap && a.minY < b.maxY + gap && b.minY < a.maxY + gap
  );
}

function fillDepth(params: BinParams): number {
  return binDimensions(params).wallHeight - params.cutoutConfig.topOffset;
}

/**
 * The lowest height, in height units, whose fill holds a pocket `cutMm` deep
 * with the fill's top recess kept as it is; null when the fill already does,
 * and undefined when no height up to the maximum does.
 */
export function heightFor(params: BinParams, cutMm: number): number | null | undefined {
  const needed = cutMm + MIN_FLOOR_UNDER_MM;
  if (fillDepth(params) >= needed) return null;
  for (let h = Math.ceil(params.height); h <= DESIGNER_CONSTRAINTS.MAX_HEIGHT; h++) {
    if (fillDepth({ ...params, height: h }) >= needed) return h;
  }
  return undefined;
}

/** Whether every cut of the set, moved to (dx, dy), lands on the bin's real floor. */
export function landsOnFloor(
  params: BinParams,
  set: GeneratedToolSet,
  dx: number,
  dy: number
): boolean {
  const placed = set.cutouts.map((c) => shiftCutout(c, dx, dy));
  return getOffBoardCutoutIds(placed, binBoard(params)).size === 0;
}

/**
 * Where a new set goes and how the bin grows for it, or null when no size the
 * bin can take holds it. An empty bin is sized to the set and the set is
 * centred. With pockets already there, the set goes to their right, or below
 * them when the bin cannot grow that wide.
 */
export function planToolSetPlacement(
  params: BinParams,
  set: GeneratedToolSet,
  halfGridMode: boolean
): ToolSetPlacement | null {
  const height = heightFor(params, set.deepestCutMm);
  if (height === undefined) return null;
  const existing = params.cutouts.filter((c) => c.hidden !== true);

  if (existing.length === 0) {
    const room = envelope(set.width + 2 * SET_MARGIN_MM, set.depth + 2 * SET_MARGIN_MM);
    const size = computeGrowToFit(params, [room], halfGridMode);
    const grown = size ? { ...params, ...size } : params;
    const board = cutoutInterior(grown);
    const dx = Math.max(0, (board.innerW - set.width) / 2);
    const dy = Math.max(0, (board.innerD - set.depth) / 2);
    return landsOnFloor(grown, set, dx, dy) ? { dx, dy, size, height } : null;
  }

  const taken = cutBoxes(existing);
  const maxX = Math.max(...taken.map((b) => b.maxX));
  const minY = Math.min(...taken.map((b) => b.minY));
  const maxY = Math.max(...taken.map((b) => b.maxY));
  const spots = [
    { dx: maxX + SET_MARGIN_MM, dy: Math.max(SET_MARGIN_MM, minY) },
    { dx: SET_MARGIN_MM, dy: maxY + SET_MARGIN_MM },
  ];
  for (const spot of spots) {
    const room = envelope(spot.dx + set.width + SET_MARGIN_MM, spot.dy + set.depth + SET_MARGIN_MM);
    const size = computeGrowToFit(params, [...existing, room], halfGridMode);
    const grown = size ? { ...params, ...size } : params;
    if (landsOnFloor(grown, set, spot.dx, spot.dy)) return { ...spot, size, height };
  }
  return null;
}
