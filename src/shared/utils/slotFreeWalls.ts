/**
 * Which outer walls are free of slot grooves.
 *
 * Shared because four things gate on it: the wall pattern, wall text, handles,
 * and the panel that has to explain why a wall refused any of them. Kept out of
 * the worker's `wallPatterns` so the main thread can ask the same question.
 */

import type { BinParams } from '@/shared/types/bin';
import { isNestingBase } from '@/shared/types/bin';
import { slottedWalls } from '@/shared/utils/slotMath';

export interface SlotFreeWalls {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

/**
 * A body whose walls actually receive slot grooves. A nesting base keeps its
 * own floor plane and takes none, so the style alone does not settle it.
 */
export function isSlottedBody(params: Pick<BinParams, 'style' | 'base'>): boolean {
  return params.style === 'slotted' && !isNestingBase(params.base);
}

export function getSlotFreeWalls(params: Pick<BinParams, 'style' | 'slotConfig'>): SlotFreeWalls {
  if (params.style !== 'slotted') {
    return { front: true, back: true, left: true, right: true };
  }
  const walls = slottedWalls(params.slotConfig);
  return { front: !walls.front, back: !walls.back, left: !walls.left, right: !walls.right };
}

/** Whether any outer wall is left for a feature that cannot share one with slots. */
export function hasSlotFreeWall(params: Pick<BinParams, 'style' | 'slotConfig'>): boolean {
  const free = getSlotFreeWalls(params);
  return free.front || free.back || free.left || free.right;
}
