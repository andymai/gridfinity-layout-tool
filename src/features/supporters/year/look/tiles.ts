import { BEAT, clamp01, easeOut, hash, onGrid, springX } from './motion';

/** The fill between cards is 1×1 bins this many card px across. */
export const TILE = 120;

export interface TileSpan {
  readonly c0: number;
  readonly c1: number;
  readonly r0: number;
  readonly r1: number;
}

/**
 * Tiles on the card's own grid, enough to cover the whole frame: rows count
 * up from the card's bottom edge, and run past the card on a tall screen.
 */
export function tileSpan(
  frame: {
    readonly width: number;
    readonly height: number;
    readonly left: number;
    readonly top: number;
    readonly scale: number;
  },
  cardHeight: number
): TileSpan {
  const scale = frame.scale > 0 ? frame.scale : 1;
  const xMin = -frame.left / scale;
  const xMax = (frame.width - frame.left) / scale;
  const yMin = -frame.top / scale;
  const yMax = (frame.height - frame.top) / scale;
  return {
    // `+ 0` turns a -0 into 0.
    c0: Math.floor(xMin / TILE) + 0,
    c1: Math.ceil(xMax / TILE) - 1,
    r0: Math.floor((cardHeight - yMax) / TILE) + 0,
    r1: Math.ceil((cardHeight - yMin) / TILE) - 1,
  };
}

/**
 * When a tile lands in a fill of `length` seconds: the front row first,
 * sweeping across, with a little jitter, every landing on a 64th-note tick.
 */
export function tileStart(
  row: number,
  rows: number,
  col: number,
  cols: number,
  length: number
): number {
  const across = cols > 1 ? col / (cols - 1) : 0;
  const up = rows > 1 ? row / (rows - 1) : 0;
  return onGrid(length * (0.66 * up + 0.1 * across + 0.04 * hash(row + 11, col + 5)), BEAT / 16);
}

export interface TilePose {
  readonly opacity: number;
  readonly y: number;
  readonly scale: number;
}

/** A tile pops down into place; reduced motion fades rows in on three steps. */
export function tilePose(
  t: number,
  row: number,
  rows: number,
  col: number,
  cols: number,
  length: number,
  reduced: boolean
): TilePose {
  if (reduced) {
    const group = Math.floor((3 * row) / Math.max(1, rows));
    const at = length * (0.15 + 0.3 * group);
    return { opacity: easeOut(clamp01((t - at) / (0.2 * length))), y: 0, scale: 1 };
  }
  const elapsed = t - tileStart(row, rows, col, cols, length);
  const xs = springX(elapsed, 0.34, 0.18);
  return { opacity: clamp01(elapsed / 0.04), y: -12 * xs, scale: 1 + 0.12 * xs };
}
