import { canPlaceBin } from '../shared/utils/validation';
import type { Bin, Layout } from '../core/types';

export type RotationResult =
  | { valid: true }
  | { valid: false; message: string };

/**
 * Validate whether a bin can be rotated (swap width and depth).
 * Returns an error message if rotation would cause bounds violation or collision.
 *
 * This utility is used by keyboard shortcuts, inspector buttons, and context menus
 * to ensure consistent validation and error messages.
 */
export function validateRotation(bin: Bin, layout: Layout): RotationResult {
  // Create rotated rect (swap width and depth)
  const rotatedRect = {
    x: bin.x,
    y: bin.y,
    width: bin.depth,
    depth: bin.width,
    height: bin.height,
    clearanceHeight: bin.clearanceHeight,
  };

  const validation = canPlaceBin(rotatedRect, bin.layerId, layout, bin.id);

  if (!validation.valid) {
    let message = 'Cannot rotate bin';
    switch (validation.reason) {
      case 'exceeds_width':
      case 'exceeds_depth':
      case 'out_of_bounds':
        message = 'Cannot rotate: bin would exceed drawer bounds';
        break;
      case 'collision':
        message = 'Cannot rotate: would collide with another bin';
        break;
      case 'blocked_zone':
        message = 'Cannot rotate: space is blocked by a bin below';
        break;
    }
    return { valid: false, message };
  }

  return { valid: true };
}
