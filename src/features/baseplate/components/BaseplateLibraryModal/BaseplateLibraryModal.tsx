/**
 * Baseplate Library manager modal.
 *
 * A simplified clone of the Layout Manager modal (no import/share tabs): a grid
 * of saved baseplate designs with switch, inline rename, duplicate, and delete.
 * The design list is loaded from IndexedDB (BaseplateStorage) on open and
 * refreshed after each mutation. Deleting a referenced design routes through a
 * warning dialog that orphans the current layout to its inline copy.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useMutations } from '@/shared/contexts';
import { isOk } from '@/core/result';
import { useTranslation } from '@/i18n';
import { useInlineEdit, useResponsive } from '@/shared/hooks';
import { Button, IconButton, XIcon } from '@/design-system';
import type { BaseplateDesignId } from '@/core/types';
import type { SavedBaseplateDesign } from '@/features/baseplate/types/library';
import { listDesigns } from '@/features/baseplate/storage/BaseplateStorage';
import { useBaseplateLibrary } from '@/features/baseplate/hooks/useBaseplateLibrary';
import { DeleteBaseplateWarningDialog } from '../DeleteBaseplateWarningDialog';

interface BaseplateLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BaseplateLibraryModal({ isOpen, onClose }: BaseplateLibraryModalProps) {
  if (!isOpen) return null;
  return <BaseplateLibraryModalContent onClose={onClose} />;
}

function BaseplateLibraryModalContent({ onClose }: { onClose: () => void }) {
  const t = useTranslation();
  const { switchActive, renameDesign, duplicateDesign, deleteDesign } = useBaseplateLibrary();
  const { activeBaseplateId, baseplateParams } = useLayoutStore(
    useShallow((s) => ({
      activeBaseplateId: s.layout.activeBaseplateId ?? null,
      baseplateParams: s.layout.baseplateParams,
    }))
  );
  const mutations = useMutations();

  const [designs, setDesigns] = useState<SavedBaseplateDesign[]>([]);
  const [pendingDelete, setPendingDelete] = useState<SavedBaseplateDesign | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const refresh = useCallback(async () => {
    const result = await listDesigns();
    if (isOk(result)) {
      setDesigns(result.value);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void listDesigns().then((result) => {
      if (active && isOk(result)) {
        setDesigns(result.value);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Capture phase: the dialog container calls stopPropagation on keydown,
    // which would otherwise starve this bubble-phase listener.
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleSwitch = useCallback(
    (id: BaseplateDesignId) => {
      if (id !== activeBaseplateId) {
        void switchActive(id);
      }
      onClose();
    },
    [activeBaseplateId, switchActive, onClose]
  );

  const handleRename = useCallback(
    async (id: BaseplateDesignId, name: string) => {
      await renameDesign(id, name);
      await refresh();
    },
    [renameDesign, refresh]
  );

  const handleDuplicate = useCallback(
    async (id: BaseplateDesignId) => {
      await duplicateDesign(id);
      await refresh();
    },
    [duplicateDesign, refresh]
  );

  const handleConfirmDelete = useCallback(async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    const result = await deleteDesign(target.id);
    if (isOk(result)) {
      // Orphan the current layout to its inline copy if it referenced the design.
      if (activeBaseplateId === target.id && baseplateParams) {
        mutations.setActiveBaseplate(null, baseplateParams);
      }
      await refresh();
    }
  }, [pendingDelete, deleteDesign, activeBaseplateId, baseplateParams, mutations, refresh]);

  const affectedCount = pendingDelete && activeBaseplateId === pendingDelete.id ? 1 : 0;

  return createPortal(
    <div
      className="fixed inset-0 bg-overlay-dark flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="baseplate-library-title"
        className="bg-surface-elevated rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] grid grid-rows-[auto_1fr] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-stroke-subtle px-6 py-4">
          <h2 id="baseplate-library-title" className="text-2xl font-bold text-content">
            {t('baseplate.library.title')}
          </h2>
          <IconButton
            ref={closeButtonRef}
            size="sm"
            touchTarget={false}
            onClick={onClose}
            className="text-content-secondary hover:bg-surface hover:text-content"
            aria-label={t('baseplate.library.closeDialog')}
          >
            <XIcon className="w-5 h-5" />
          </IconButton>
        </div>

        {/* Content */}
        <div className="min-h-0 overflow-hidden flex flex-col px-6 pb-6">
          {designs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-content-tertiary">
              <p>{t('baseplate.library.empty')}</p>
              <p className="text-sm mt-1">{t('baseplate.library.emptyHint')}</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto pt-4">
              <div
                role="listbox"
                aria-label={t('baseplate.library.title')}
                className="grid grid-cols-[repeat(auto-fill,minmax(225px,1fr))] gap-3 content-start"
              >
                {designs.map((design) => (
                  <BaseplateCard
                    key={design.id}
                    design={design}
                    isActive={design.id === activeBaseplateId}
                    onSelect={() => handleSwitch(design.id)}
                    onRename={(name) => void handleRename(design.id, name)}
                    onDuplicate={() => void handleDuplicate(design.id)}
                    onDelete={() => setPendingDelete(design)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-stroke text-sm text-content-tertiary">
            {t('baseplate.library.count', { count: designs.length })}
          </div>
        </div>
      </div>

      <DeleteBaseplateWarningDialog
        isOpen={pendingDelete !== null}
        designName={pendingDelete?.name ?? ''}
        affectedCount={affectedCount}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>,
    document.body
  );
}

interface BaseplateCardProps {
  design: SavedBaseplateDesign;
  isActive: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function BaseplateCard({
  design,
  isActive,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: BaseplateCardProps) {
  const t = useTranslation();
  const {
    isEditing,
    editingValue,
    inputRef,
    startEditing,
    handleChange,
    handleFinish,
    handleKeyDown,
  } = useInlineEdit({ initialValue: design.name, onSave: onRename });

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };

  return (
    <div
      role="option"
      aria-selected={isActive}
      aria-current={isActive ? 'true' : undefined}
      tabIndex={0}
      className={`w-full text-left rounded-lg overflow-hidden border-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary ${
        isActive ? 'border-accent' : 'border-transparent hover:border-accent/50'
      }`}
      onClick={() => !isEditing && onSelect()}
      onKeyDown={handleItemKeyDown}
    >
      <div className="aspect-[4/3] relative flex items-center justify-center bg-surface-secondary">
        {design.thumbnail ? (
          <img src={design.thumbnail} alt="" className="max-w-full max-h-full object-contain" />
        ) : (
          <span className="text-xs text-content-tertiary">
            {t('baseplate.library.thumbnailPlaceholder')}
          </span>
        )}
        {isActive && (
          <span
            className="absolute top-1.5 right-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-on-dark"
            aria-label={t('baseplate.library.currentlyActive')}
          >
            {t('baseplate.library.active')}
          </span>
        )}
      </div>

      <div className="px-2 py-1.5 bg-surface-secondary flex items-center justify-between gap-1">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editingValue}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleFinish}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-surface px-1.5 py-0.5 rounded border border-stroke focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none text-content text-sm"
            maxLength={64}
            aria-label={t('baseplate.library.designName')}
          />
        ) : (
          <h3
            className="font-medium text-content text-sm leading-tight line-clamp-1"
            title={design.name}
          >
            {design.name}
          </h3>
        )}
        <BaseplateCardActions
          designName={design.name}
          onRename={startEditing}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

interface BaseplateCardActionsProps {
  designName: string;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function BaseplateCardActions({
  designName,
  onRename,
  onDuplicate,
  onDelete,
}: BaseplateCardActionsProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMenuOpen) {
      setIsMenuOpen(false);
      return;
    }
    const button = menuButtonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const openAbove = window.innerHeight - rect.bottom < 200;
      setMenuStyle({
        position: 'fixed',
        right: window.innerWidth - rect.right,
        ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      });
    }
    setIsMenuOpen(true);
  };

  const handleAction = (action: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    action();
    setIsMenuOpen(false);
  };

  return (
    <div className="relative" role="presentation" onClick={(e) => e.stopPropagation()}>
      <IconButton
        ref={menuButtonRef}
        size="sm"
        touchTarget={isMobile}
        pressed={isMenuOpen}
        onClick={handleMenuToggle}
        className="text-content-tertiary hover:bg-surface hover:text-content"
        aria-label={t('baseplate.library.moreActions', { name: designName })}
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </IconButton>

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
              {t('common.rename')}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              role="menuitem"
              onClick={handleAction(onDuplicate)}
              className="justify-start rounded-none px-3 py-2 text-left text-sm font-normal text-content hover:bg-surface"
            >
              {t('common.duplicate')}
            </Button>
            <div className="border-t border-stroke my-1" />
            <Button
              variant="ghost"
              fullWidth
              role="menuitem"
              onClick={handleAction(onDelete)}
              className="justify-start rounded-none px-3 py-2 text-left text-sm font-normal text-danger hover:bg-surface hover:text-danger"
            >
              {t('common.delete')}
            </Button>
          </div>,
          document.body
        )}
    </div>
  );
}
