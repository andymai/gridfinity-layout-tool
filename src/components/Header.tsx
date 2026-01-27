import { useState, useRef, useEffect, Suspense } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore, useHistoryStore, useUIStore, useLibraryStore } from '@/core/store';
import { useResponsive } from '@/shared/hooks';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useCollabMode } from '@/hooks/useCollabMode';
import { CONSTRAINTS } from '@/core/constants';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import { ShareButton } from '@/features/cloud-share/components/ShareButton';
import { ShareModal } from '@/features/cloud-share/components/ShareModal';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { PresenceAvatars } from './Collab';
import { useTranslation } from '@/i18n';
import type { SaveStatus } from '@/shared/hooks';
import type { ShareModalRenderProps } from '@/features/layout-library/components/LayoutManagerModal';
import { LoadingFallback } from '@/shared/components/LoadingFallback';

// Lazy load modals - only loaded when opened (with retry for chunk load failures)
const LayoutManagerModal = lazyWithRetry(() =>
  import('@/features/layout-library/components/LayoutManagerModal').then(
    namedExport('LayoutManagerModal')
  )
);
const PrintModal = lazyWithRetry(() =>
  import('@/features/print-export/components/PrintModal').then(namedExport('PrintModal'))
);

// Lazy load name suggestions feature to reduce main bundle size
const NameFieldHighlight = lazyWithRetry(() =>
  import('@/features/name-suggestions').then(namedExport('NameFieldHighlight'))
);

interface HeaderProps {
  onHelpClick: () => void;
  saveStatus: SaveStatus;
}

export function Header({ onHelpClick, saveStatus }: HeaderProps) {
  const t = useTranslation();
  const { isTablet } = useResponsive();
  const isCollabEnabled = useFeatureFlag('collaborative_editing');
  const { isCollaborative } = useCollabMode();

  const { layout, setName } = useLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      setName: state.setName,
    }))
  );

  const { canUndo, canRedo, undo, redo } = useHistoryStore(
    useShallow((state) => ({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undo: state.undo,
      redo: state.redo,
    }))
  );

  const halfBinMode = useUIStore((state) => state.halfBinMode);
  const { printModalOpen, setPrintModalOpen } = useUIStore(
    useShallow((state) => ({
      printModalOpen: state.printModalOpen,
      setPrintModalOpen: state.setPrintModalOpen,
    }))
  );

  const { leftPanelCollapsed, rightPanelCollapsed, toggleLeftPanel, toggleRightPanel } = useUIStore(
    useShallow((state) => ({
      leftPanelCollapsed: state.leftPanelCollapsed,
      rightPanelCollapsed: state.rightPanelCollapsed,
      toggleLeftPanel: state.toggleLeftPanel,
      toggleRightPanel: state.toggleRightPanel,
    }))
  );

  const { showLayoutManager, setShowLayoutManager } = useLibraryStore(
    useShallow((state) => ({
      showLayoutManager: state.showLayoutManager,
      setShowLayoutManager: state.setShowLayoutManager,
    }))
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(layout.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleNameClick = () => {
    setEditValue(layout.name);
    setIsEditing(true);
  };

  const handleNameSubmit = () => {
    setName(editValue.trim() || 'Untitled layout');
    setIsEditing(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditValue(layout.name);
      setIsEditing(false);
    }
  };

  // Platform detection for keyboard shortcut hints
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle">
      <div className="flex items-center gap-4 min-w-0">
        <ToolSwitcher />

        {/* Divider */}
        <div className="w-px h-6 bg-stroke-subtle" />

        {/* Layout name */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            maxLength={CONSTRAINTS.NAME_MAX_LENGTH}
            aria-label={t('header.layoutName')}
            className="px-3 py-1.5 rounded-md text-sm transition-all bg-surface-elevated border border-accent text-content"
            style={{
              boxShadow: '0 0 0 3px var(--color-primary-muted)',
            }}
          />
        ) : (
          <Suspense
            fallback={
              <button
                onClick={handleNameClick}
                className="px-3 py-1.5 text-sm rounded-md transition-all hover:scale-[1.02] text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content truncate max-w-[200px]"
                title={t('header.editLayoutName')}
              >
                {layout.name}
              </button>
            }
          >
            <NameFieldHighlight>
              <button
                onClick={handleNameClick}
                className="px-3 py-1.5 text-sm rounded-md transition-all hover:scale-[1.02] text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content truncate max-w-[200px]"
                title={t('header.editLayoutName')}
              >
                {layout.name}
              </button>
            </NameFieldHighlight>
          </Suspense>
        )}

        {/* Half-bin mode indicator badge */}
        {halfBinMode && (
          <div
            className="px-2 py-1 text-xs font-medium rounded-md bg-accent/10 text-accent border border-accent/20 flex items-center gap-1.5"
            title={t('header.halfBinModeTitle')}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h4a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z"
              />
            </svg>
            <span className="hidden sm:inline">{t('header.halfBinMode')}</span>
            <span className="sm:hidden">{t('header.halfBinModeShort')}</span>
          </div>
        )}

        {/* Layout Manager Button */}
        <button
          onClick={() => setShowLayoutManager(true)}
          className="px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
          title={`${t('header.openLayoutManager')} (${modKey}+O)`}
          aria-label={t('header.openLayoutManager')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <span className="hidden sm:inline">{t('header.layouts')}</span>
        </button>

        {/* Print Button */}
        <button
          onClick={() => setPrintModalOpen(true)}
          className="px-2 py-1.5 text-sm rounded-md transition-all text-content-secondary bg-transparent hover:bg-surface-hover hover:text-content flex items-center gap-1.5"
          title={t('header.printLayout')}
          aria-label={t('header.printLayout')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          <span className="hidden sm:inline">{t('header.print')}</span>
        </button>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Tablet panel toggle buttons */}
        {isTablet && (
          <div className="flex items-center mr-2 border-r border-stroke-subtle pr-2">
            <button
              onClick={toggleLeftPanel}
              className={`btn btn-ghost btn-icon ${!leftPanelCollapsed ? 'bg-surface-hover' : ''}`}
              title={t('header.toggleSidebar')}
              aria-label={t('header.toggleSidebar')}
              aria-pressed={!leftPanelCollapsed}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h7"
                />
              </svg>
            </button>
            <button
              onClick={toggleRightPanel}
              className={`btn btn-ghost btn-icon ${!rightPanelCollapsed ? 'bg-surface-hover' : ''}`}
              title={t('header.toggleInspector')}
              aria-label={t('header.toggleInspector')}
              aria-pressed={!rightPanelCollapsed}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Save status indicator */}
        {saveStatus === 'saving' && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] mr-2 text-content-tertiary"
            aria-live="polite"
            role="status"
          >
            <svg
              className="w-3 h-3 animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-70"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span>{t('header.saving')}</span>
          </div>
        )}
        {saveStatus === 'saved' && (
          <div
            className="flex items-center gap-1 px-2 py-1 text-[11px] mr-2 text-content-secondary animate-fade-in"
            aria-live="polite"
            role="status"
          >
            <svg
              className="w-3 h-3 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{t('header.saved')}</span>
          </div>
        )}

        {/* Undo/Redo buttons */}
        <div className="flex items-center">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="btn btn-ghost btn-icon"
            title={t('header.undoAction', { mod: modKey })}
            aria-label={t('header.undo', { mod: modKey })}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="btn btn-ghost btn-icon"
            title={t('header.redoAction', { mod: modKey })}
            aria-label={t('header.redo', { mod: modKey })}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
              />
            </svg>
          </button>
        </div>

        {/* Share button and presence avatars (only visible when collaborative_editing flag is enabled) */}
        {isCollabEnabled && <div className="w-px h-6 bg-stroke-subtle mx-2" />}
        <ShareButton />
        {/* Only render PresenceAvatars when actually in collab mode (inside RoomProvider) */}
        {isCollabEnabled && isCollaborative && <PresenceAvatars className="ml-2" />}
        {isCollabEnabled && <div className="w-px h-6 bg-stroke-subtle mx-2" />}

        {/* Divider before external links (only when collab is disabled) */}
        {!isCollabEnabled && <div className="w-px h-6 bg-stroke-subtle mx-2" />}

        {/* Language selector */}
        <LanguageSelector />

        <button
          onClick={onHelpClick}
          className="btn btn-ghost px-2.5 py-1.5 text-sm text-content-secondary"
          title={t('header.showHelp')}
          aria-label={t('header.helpAndShortcuts')}
        >
          <span className="hidden xl:inline">
            {t('header.pressForHelp')}{' '}
            <kbd
              className="mx-1 px-2 py-1 text-xs font-mono rounded text-content leading-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-default)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              ?
            </kbd>{' '}
            {t('header.forHelp')}
          </span>
          <span className="xl:hidden flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="hidden lg:inline">{t('header.help')}</span>
          </span>
        </button>
      </div>

      {/* Lazy-loaded modals - only load chunks when modal is opened */}
      {showLayoutManager && (
        <Suspense
          fallback={<LoadingFallback variant="overlay" label={t('header.loadingLayouts')} />}
        >
          <LayoutManagerModal
            isOpen={showLayoutManager}
            onClose={() => setShowLayoutManager(false)}
            renderShareModal={(props: ShareModalRenderProps) => (
              <ShareModal isOpen={props.isOpen} onClose={props.onClose} layoutId={props.layoutId} />
            )}
          />
        </Suspense>
      )}

      {/* PrintModal must always be rendered (not just when open) because it always
          renders a print portal via createPortal that's required for @media print CSS
          rules to work when user presses Cmd+P or Ctrl+P. The modal UI itself is only
          shown when printModalOpen is true. */}
      <Suspense fallback={null}>
        <PrintModal isOpen={printModalOpen} onClose={() => setPrintModalOpen(false)} />
      </Suspense>
    </header>
  );
}
