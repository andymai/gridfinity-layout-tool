import type { Cutout } from '@/shared/types/bin';

/**
 * Patch that resizes a cutout about its own center, leaving the center where it
 * was and growing equally in every direction.
 *
 * Deliberately unclamped: the W/H fields hold a MEASURED dimension, so
 * truncating the size to the board, or sliding the origin back onto it, would
 * cut a pocket that is not the size that was asked for. A result hanging off the
 * board is left to the off-board warning, which offers to grow the bin, center
 * the stray, or pull it back in.
 *
 * Rotation needs no special case: `x`/`y` are the unrotated box origin and
 * rotation is about the box center, so holding that center holds the rotated
 * shape too. Array instances are offsets from the master center, so they follow
 * as well.
 *
 * Lives in `shared/` because the variant resolver applies it to a cutout the
 * bin designer is not editing, and `features/` cannot import `features/`.
 */
export function resizeAroundCenter(
  cutout: Pick<Cutout, 'x' | 'y' | 'width' | 'depth'>,
  next: { readonly width?: number; readonly depth?: number }
): Pick<Cutout, 'x' | 'y' | 'width' | 'depth'> {
  const width = next.width ?? cutout.width;
  const depth = next.depth ?? cutout.depth;
  return {
    width,
    depth,
    x: cutout.x + (cutout.width - width) / 2,
    y: cutout.y + (cutout.depth - depth) / 2,
  };
}
