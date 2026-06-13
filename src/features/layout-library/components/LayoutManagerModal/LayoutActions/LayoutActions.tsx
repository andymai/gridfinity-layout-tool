import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LayoutEntry } from '@/core/types';
import { useTranslation } from '@/i18n';
import { useTwoClickDelete } from '@/shared/components';
import { Button, IconButton } from '@/design-system';

interface LayoutActionsProps {
  entry: LayoutEntry;
  isOnlyLayout: boolean;
  onCopyLink: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/**
 * Action buttons for a layout list item.
 * Shows download as icon button, with overflow menu for rename/duplicate/copy link/delete.
 */
export function LayoutActions({
  entry,
  isOnlyLayout,
  onCopyLink,
  onDownload,
  onRename,
  onDuplicate,
  onDelete,
}: LayoutActionsProps) {
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
      // Calculate fixed position based on button location
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    handleDeleteClick();
  };

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setIsMenuOpen(false);
  };

  return (
    <div
      className="flex items-center gap-1"
      role="presentation"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Download Button */}
      <IconButton
        size="sm"
        touchTarget={false}
        onClick={handleAction(onDownload)}
        className="text-content-tertiary hover:bg-surface hover:text-content"
        title={t('common.download')}
        aria-label={`${t('common.download')} ${entry.name}`}
      >
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
      </IconButton>

      {/* Overflow Menu Button */}
      <div className="relative">
        <IconButton
          ref={menuButtonRef}
          size="sm"
          touchTarget={false}
          pressed={isMenuOpen}
          onClick={handleMenuToggle}
          className="text-content-tertiary hover:bg-surface hover:text-content"
          aria-label={`More actions for ${entry.name}`}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </IconButton>

        {/* Dropdown Menu - rendered via portal to escape modal's transform */}
        {isMenuOpen &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={menuStyle}
              className="w-40 bg-surface-elevated border border-stroke rounded-lg shadow-lg py-1 z-50"
            >
              <Button
                variant="ghost"
                fullWidth
                role="menuitem"
                onClick={handleAction(onRename)}
                className="justify-start rounded-none px-3 py-2 text-left text-sm font-normal text-content hover:bg-surface"
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
              </Button>
              <Button
                variant="ghost"
                fullWidth
                role="menuitem"
                onClick={handleAction(onDuplicate)}
                className="justify-start rounded-none px-3 py-2 text-left text-sm font-normal text-content hover:bg-surface"
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
              </Button>
              {/* Copy Link */}
              <Button
                variant="ghost"
                fullWidth
                role="menuitem"
                onClick={handleAction(onCopyLink)}
                className="justify-start rounded-none px-3 py-2 text-left text-sm font-normal text-content hover:bg-surface"
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
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                {t('share.copyLink')}
              </Button>
              {!isOnlyLayout && (
                <>
                  <div className="border-t border-stroke my-1" />
                  <Button
                    variant="ghost"
                    fullWidth
                    role="menuitem"
                    onClick={handleDelete}
                    className={`
                      flex-col items-start gap-0.5 rounded-none px-3 py-2 text-left text-sm font-normal
                      ${
                        isConfirmingDelete
                          ? 'bg-danger text-on-dark hover:bg-danger'
                          : 'text-danger hover:bg-surface hover:text-danger'
                      }
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
                      {isConfirmingDelete ? t('layouts.confirmDelete.confirm') : t('common.delete')}
                    </span>
                    {isConfirmingDelete && entry.preview.binCount > 0 && (
                      <span className="text-xs opacity-70 ml-6">
                        {t('layouts.binsWillBeDeleted', { count: entry.preview.binCount })}
                      </span>
                    )}
                  </Button>
                </>
              )}
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
