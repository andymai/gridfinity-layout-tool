import { describe, it, expect, vi } from 'vitest';
import { handlePendingPlaceMove } from './pendingPlaceHandler';
import type { InteractionMode } from '../useCutoutInteraction';

type PendingPlaceMode = Extract<InteractionMode, { type: 'pending-place' }>;

function pending(shape: PendingPlaceMode['shape']): PendingPlaceMode {
  return { type: 'pending-place', shape, startMmX: 10, startMmY: 10 };
}

describe('handlePendingPlaceMove', () => {
  it('enters drawing mode once the cursor clears the threshold', () => {
    const setMode = vi.fn();
    handlePendingPlaceMove(pending('rectangle'), { mmX: 15, mmY: 10 }, setMode);
    expect(setMode).toHaveBeenCalledWith({
      type: 'drawing',
      shape: 'rectangle',
      startMmX: 10,
      startMmY: 10,
    });
  });

  it('never enters drawing for a text element — its box follows the caption', () => {
    const setMode = vi.fn();
    handlePendingPlaceMove(pending('text'), { mmX: 40, mmY: 40 }, setMode);
    expect(setMode).not.toHaveBeenCalled();
  });
});
