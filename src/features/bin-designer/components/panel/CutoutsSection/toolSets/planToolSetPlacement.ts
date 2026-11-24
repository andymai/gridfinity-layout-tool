import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { getRotatedBounds } from '../geometryCore';
import { computeGrowToFit } from '../growBinToFit';
import type { GeneratedToolSet } from '@/shared/toolSets/generateToolSet';

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

function boundsOf(cutouts: readonly Cutout[]): { maxX: number; minY: number; maxY: number } {
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const c of cutouts) {
    const b = getRotatedBounds(c);
    maxX = Math.max(maxX, b.maxX);
    minY = Math.min(minY, b.minY);
    maxY = Math.max(maxY, b.maxY);
  }
  return { maxX, minY, maxY };
}

function fitsAsIs(params: BinParams, room: Cutout): boolean {
  const board = cutoutInterior(params);
  return room.width <= board.innerW + 1e-6 && room.depth <= board.innerD + 1e-6;
}

function fillDepth(params: BinParams): number {
  return binDimensions(params).wallHeight - params.cutoutConfig.topOffset;
}

/** The lowest height, in height units, whose fill holds a pocket `cutMm` deep. */
function heightFor(params: BinParams, cutMm: number): number | null {
  const needed = cutMm + MIN_FLOOR_UNDER_MM;
  if (fillDepth(params) >= needed) return null;
  for (let h = Math.ceil(params.height); h <= DESIGNER_CONSTRAINTS.MAX_HEIGHT; h++) {
    if (fillDepth({ ...params, height: h }) >= needed) return h;
  }
  return DESIGNER_CONSTRAINTS.MAX_HEIGHT;
}

/**
 * Where a new set goes and how the bin grows for it. An empty bin is sized to
 * the set and the set is centred. With pockets already there, the set goes to
 * their right, or below them when the bin cannot grow that wide.
 */
export function planToolSetPlacement(
  params: BinParams,
  set: GeneratedToolSet,
  halfGridMode: boolean
): ToolSetPlacement {
  const height = heightFor(params, set.deepestCutMm);
  const existing = params.cutouts.filter((c) => c.hidden !== true);

  if (existing.length === 0) {
    const room = envelope(set.width + 2 * SET_MARGIN_MM, set.depth + 2 * SET_MARGIN_MM);
    const grown = computeGrowToFit(params, [room], halfGridMode);
    const board = cutoutInterior(grown ? { ...params, ...grown } : params);
    return {
      dx: Math.max(0, (board.innerW - set.width) / 2),
      dy: Math.max(0, (board.innerD - set.depth) / 2),
      size: grown,
      height,
    };
  }

  const b = boundsOf(existing);
  const beside = { dx: b.maxX + SET_MARGIN_MM, dy: Math.max(SET_MARGIN_MM, b.minY) };
  const below = { dx: SET_MARGIN_MM, dy: b.maxY + SET_MARGIN_MM };
  for (const spot of [beside, below]) {
    const room = envelope(spot.dx + set.width + SET_MARGIN_MM, spot.dy + set.depth + SET_MARGIN_MM);
    const grown = computeGrowToFit(params, [...existing, room], halfGridMode);
    if (grown || fitsAsIs(params, room)) return { ...spot, size: grown, height };
  }
  return { ...beside, size: null, height };
}
