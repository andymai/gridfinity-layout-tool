import type { Interaction } from '@/core/types';
import type { InteractionHint } from '@/liveblocks.config';
import type { PointerCaptureHandle } from './types';

// Re-export from shared/utils — this pure geometry function was moved to the
// shared layer so that shared/utils/snap.ts can import it without an upward
// dependency into hooks/.
export { calculateResizeRect } from '@/shared/utils/resize';

/**
 * Capture pointer at document body level for reliable event delivery during interactions.
 *
 * This is used by all interaction modes (drag, resize, draw, staging drag) to ensure
 * pointer events continue to be delivered even when the cursor moves outside the
 * original target element.
 *
 * @param pointerId - The pointer ID to capture (from PointerEvent.pointerId)
 * @param activePointerIdRef - Ref to store the active pointer ID
 * @param capturedPointerRef - Ref to store the capture handle for cleanup
 * @returns true if capture succeeded, false otherwise
 */
export function capturePointer(
  pointerId: number | undefined,
  activePointerIdRef: React.RefObject<number | null>,
  capturedPointerRef: React.RefObject<PointerCaptureHandle | null>
): boolean {
  if (pointerId === undefined) {
    return false;
  }

  activePointerIdRef.current = pointerId;
  try {
    document.body.setPointerCapture(pointerId);
    capturedPointerRef.current = { element: document.body, pointerId };
    return true;
  } catch {
    // Ignore if capture fails (e.g., pointer already released)
    return false;
  }
}

/**
 * Convert local interaction state to InteractionHint format for collaborative broadcasting.
 * Maps internal interaction types to the remote-friendly hint format that other users see.
 *
 * @param interaction - Current interaction state (or null if idle)
 * @returns InteractionHint suitable for broadcasting to collaborators
 */
export function mapInteractionToHint(interaction: Interaction | null): InteractionHint {
  if (!interaction) {
    return { type: 'idle' };
  }

  switch (interaction.type) {
    case 'draw':
      return { type: 'drawing', start: interaction.start, current: interaction.current };
    case 'paint':
      // Paint mode appears as drawing to remote users
      return { type: 'drawing', start: interaction.start, current: interaction.current };
    case 'drag':
      return { type: 'dragging', binIds: interaction.binIds, delta: interaction.currentCoord };
    case 'resize':
      return { type: 'resizing', binIds: interaction.binIds, handle: interaction.handle };
    case 'stagingDrag':
      // Don't broadcast staging drags (too ephemeral/confusing for remote users)
      return { type: 'idle' };
  }
}
