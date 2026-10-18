import type { Bin } from '@/core/types';

/**
 * A group move's bins with those furthest along the move first. Each move is
 * checked against the layout as it stands, so a follower must not be checked
 * against the spot its leader has yet to leave.
 */
export function leadingFirst(bins: readonly Bin[], deltaX: number, deltaY: number): Bin[] {
  const along = (bin: Bin): number => bin.x * deltaX + bin.y * deltaY;
  return [...bins].sort((a, b) => along(b) - along(a));
}
