/**
 * Floating context menu for cutout operations.
 *
 * Renders as an HTML overlay positioned at cursor location with
 * actions like copy, paste, duplicate, delete, etc.
 */

import { useEffect, useCallback } from 'react';

export interface ContextMenuAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly dividerAfter?: boolean;
}

export interface CutoutContextMenuProps {
  readonly x: number; // CSS pixel X (fixed positioning)
  readonly y: number; // CSS pixel Y (fixed positioning)
  readonly actions: readonly ContextMenuAction[];
  readonly onClose: () => void;
}

export function CutoutContextMenu({ x, y, actions, onClose }: CutoutContextMenuProps) {
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleActionClick = useCallback(
    (action: ContextMenuAction) => {
      if (!action.disabled) {
        action.onClick();
        onClose();
      }
    },
    [onClose]
  );

  return (
    <>
      {/* Invisible backdrop to catch clicks outside the menu */}
      {}
      <div className="fixed inset-0 z-40" onPointerDown={onClose} />

      {/* Context menu */}
      <div
        data-testid="cutout-context-menu"
        className="fixed z-50 rounded-md border border-stroke-subtle bg-surface-elevated shadow-lg py-1 min-w-[140px]"
        style={{ left: x, top: y }}
      >
        {actions.map((action, index) => (
          <div key={index}>
            <button
              type="button"
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                action.disabled
                  ? 'text-content-tertiary cursor-not-allowed opacity-50'
                  : action.danger
                    ? 'text-red-400 hover:text-red-300 hover:bg-surface-hover'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
              }`}
              onClick={() => handleActionClick(action)}
              disabled={action.disabled}
            >
              {action.label}
            </button>
            {action.dividerAfter && <div className="border-t border-stroke-subtle my-1" />}
          </div>
        ))}
      </div>
    </>
  );
}
