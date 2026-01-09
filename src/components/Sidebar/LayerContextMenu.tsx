import { useEffect, useRef } from 'react';

interface LayerContextMenuProps {
  position: { x: number; y: number };
  onClose: () => void;
  onFillGaps: () => void;
  onClearLayer: () => void;
  emptyCells: number;
  binCount: number;
}

/**
 * Context menu for layer actions (Fill gaps, Clear layer).
 */
export function LayerContextMenu({
  position,
  onClose,
  onFillGaps,
  onClearLayer,
  emptyCells,
  binCount,
}: LayerContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use timeout to avoid immediate close from the triggering event
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Position adjustment to stay within viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 160),
    y: Math.min(position.y, window.innerHeight - 120),
  };

  const canFillGaps = emptyCells > 0;
  const canClear = binCount > 0;

  const handleFillGaps = () => {
    onFillGaps();
    onClose();
  };

  const handleClear = () => {
    onClearLayer();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg overflow-hidden shadow-xl bg-surface-elevated border border-stroke-subtle py-1"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        minWidth: '140px',
      }}
    >
      <button
        onClick={handleFillGaps}
        disabled={!canFillGaps}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs transition-colors text-content hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <svg className="w-4 h-4 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        {canFillGaps ? `Fill ${emptyCells} gap${emptyCells !== 1 ? 's' : ''}` : 'Filled'}
      </button>

      <button
        onClick={handleClear}
        disabled={!canClear}
        className="w-full px-3 py-2 flex items-center gap-2 text-xs transition-colors text-error hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Clear layer
      </button>
    </div>
  );
}
