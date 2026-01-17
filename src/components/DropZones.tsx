import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore } from '../core/store';

/**
 * Drop zone for deleting bins. Appears at top of screen when dragging.
 * Stash drop target is handled by the Staging component itself.
 */
export function DropZones() {
  const { interaction, dropTarget, setDropTarget } = useUIStore(
    useShallow((state) => ({
      interaction: state.interaction,
      dropTarget: state.dropTarget,
      setDropTarget: state.setDropTarget,
    }))
  );
  const interactionType = interaction?.type ?? null;

  const trashRef = useRef<HTMLDivElement>(null);

  // Use ref to track current dropTarget without causing effect re-runs
  const dropTargetRef = useRef(dropTarget);
  useEffect(() => {
    dropTargetRef.current = dropTarget;
  }, [dropTarget]);

  // Determine if we're in a dragging state
  const isDragging = interactionType === 'drag' || interactionType === 'stagingDrag';

  // Only show drop zones after actual pointer movement during drag.
  // On desktop, drag interaction starts immediately on pointerDown, but we only
  // want to show drop zones when the user actually starts moving (not just clicking).
  const [hasMoved, setHasMoved] = useState(false);
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = () => setHasMoved(true);
    // Listen for first pointer move after drag starts
    document.addEventListener('pointermove', handleMove, { once: true });
    return () => {
      document.removeEventListener('pointermove', handleMove);
      setHasMoved(false);
    };
  }, [isDragging]);

  const showZones = isDragging && hasMoved;

  useEffect(() => {
    if (!isDragging) {
      // Only clear if it's 'trash' (staging is handled by Staging component)
      if (dropTargetRef.current === 'trash') setDropTarget(null);
      return;
    }

    const handlePointerMove = (e: PointerEvent) => {
      const trashRect = trashRef.current?.getBoundingClientRect();

      const isOverTrash = trashRect &&
        e.clientX >= trashRect.left &&
        e.clientX <= trashRect.right &&
        e.clientY >= trashRect.top &&
        e.clientY <= trashRect.bottom;

      if (isOverTrash) {
        if (dropTargetRef.current !== 'trash') setDropTarget('trash');
      } else if (dropTargetRef.current === 'trash') {
        // Only clear trash target; staging is handled by Staging component
        setDropTarget(null);
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [isDragging, setDropTarget]);

  if (!showZones || !interaction) {
    return null;
  }

  const binCount = interaction.type === 'drag' ? interaction.binIds.length : 1;
  const binLabel = binCount === 1 ? '1 bin' : `${binCount} bins`;

  return (
    <div
      className="fixed top-0 left-0 right-0 flex justify-center p-4 pointer-events-none z-50"
      style={{
        background: 'linear-gradient(to bottom, var(--overlay-medium) 0%, transparent 100%)',
      }}
    >
      {/* Trash drop zone - at top of screen, away from stash */}
      <div
        ref={trashRef}
        className="pointer-events-auto flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-200"
        style={{
          backgroundColor: dropTarget === 'trash'
            ? 'var(--color-error)'
            : 'var(--bg-elevated)',
          border: `2px dashed ${dropTarget === 'trash' ? 'var(--color-error)' : 'var(--border-default)'}`,
          boxShadow: dropTarget === 'trash'
            ? 'var(--glow-red)'
            : 'var(--shadow-lg)',
          transform: dropTarget === 'trash' ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <svg
          className="w-5 h-5 transition-colors"
          style={{
            color: dropTarget === 'trash' ? 'white' : 'var(--text-tertiary)'
          }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        <div
          className="font-medium transition-colors text-sm"
          style={{
            color: dropTarget === 'trash' ? 'white' : 'var(--text-primary)'
          }}
        >
          Delete {binLabel}
        </div>
      </div>
    </div>
  );
}
