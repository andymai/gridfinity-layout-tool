/**
 * Which outer walls are free of slot grooves.
 *
 * Shared because three things gate on it: the wall pattern, wall text, and the
 * panel that has to explain why a wall refused either. Kept out of the worker's
 * `wallPatterns` so the main thread can ask the same question.
 */

import type { BinParams } from '@/shared/types/bin';
import { slottedWalls } from '@/shared/utils/slotMath';

export interface SlotFreeWalls {
  readonly front: boolean;
  readonly back: boolean;
  readonly left: boolean;
  readonly right: boolean;
}

export function getSlotFreeWalls(params: BinParams): SlotFreeWalls {
  if (params.style !== 'slotted') {
    return { front: true, back: true, left: true, right: true };
  }
  const walls = slottedWalls(params.slotConfig);
  return { front: !walls.front, back: !walls.back, left: !walls.left, right: !walls.right };
}
