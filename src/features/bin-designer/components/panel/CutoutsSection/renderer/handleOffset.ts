import { CORNER_HANDLE_SIZE } from './constants';

/**
 * How far the resize handles of a cutout under three handles across move out
 * from its edges, in screen pixels, so they stay clear of each other.
 */
export function smallCutoutHandleOffsetPx(width: number, depth: number, zoom: number): number {
  return Math.min(width, depth) * zoom < CORNER_HANDLE_SIZE * 3 ? CORNER_HANDLE_SIZE : 0;
}
