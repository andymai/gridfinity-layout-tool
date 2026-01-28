import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/i18n';
import { useTwoClickDelete } from '@/shared/components';
import type { SavedDesign } from '../types';

interface DesignActionsProps {
  design: SavedDesign;
  isActive: boolean;
  onLoad: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * Action buttons for a design list/grid item.
 * Shows overflow menu with Load, Rename, Duplicate, Delete actions.
 */
export function DesignActions({
  design,
  isActive,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
}: DesignActionsProps) {
  const t = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Two-click delete state
  const {
    isConfirming: isConfirmingDelete,
    handleClick: handleDeleteClick,
    reset: resetDelete,
  } = useTwoClickDelete(() => {
    onDelete();
    setIsMenuOpen(false);
  });

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
        resetDelete();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, resetDelete]);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (isMenuOpen) {
      setIsMenuOpen(false);
      resetDelete();
    } else {
      const button = menuButtonRef.current;
      if (button) {
        const rect = button.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const openAbove = spaceBelow < 200;

        setMenuStyle({
          position: 'fixed',
          right: window.innerWidth - rect.right,
          ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
        });
      }
      setIsMenuOpen(true);
    }
  };

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setIsMenuOpen(false);
    resetDelete();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDeleteClick();
  };

  return (
    <div className="relative" role="presentation" onClick={(e) => e.stopPropagation()}>
      <button
        ref={menuButtonRef}
        onClick={handleMenuToggle}
        className={`
          p-1.5 rounded transition-colors
          ${
            isMenuOpen
              ? 'bg-surface text-content'
              : 'text-content-tertiary hover:text-content hover:bg-surface'
          }
        `}
        aria-label={`More actions for ${design.name}`}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isMenuOpen &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={menuStyle}
            className="w-40 bg-surface-elevated border border-stroke rounded-lg shadow-lg py-1 z-50"
          >
            {/* Load (only if not active) */}
            {!isActive && (
              <button
                role="menuitem"
                onClick={handleAction(onLoad)}
                className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4 text-content-secondary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                {t('binDesigner.load')}
              </button>
            )}

            {/* Rename */}
            <button
              role="menuitem"
              onClick={handleAction(onRename)}
              className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-content-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {t('common.rename')}
            </button>

            {/* Duplicate */}
            <button
              role="menuitem"
              onClick={handleAction(onDuplicate)}
              className="w-full px-3 py-2 text-left text-sm text-content hover:bg-surface flex items-center gap-2"
            >
              <svg
                className="w-4 h-4 text-content-secondary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {t('common.duplicate')}
            </button>

            {/* Delete */}
            <div className="border-t border-stroke my-1" />
            <button
              role="menuitem"
              onClick={handleDelete}
              className={`
                w-full px-3 py-2 text-left text-sm flex flex-col gap-0.5 transition-colors
                ${isConfirmingDelete ? 'bg-danger text-on-dark' : 'text-danger hover:bg-surface'}
              `}
            >
              <span className="flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                {isConfirmingDelete ? t('binDesigner.confirmDelete') : t('common.delete')}
              </span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
