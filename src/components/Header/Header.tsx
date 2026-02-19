import { useState, useRef, useEffect, Suspense } from 'react';
import { useShallow } from 'zustand/shallow';
import {
  useLayoutStore,
  useHistoryStore,
  useHalfBinModeStore,
  useViewStore,
  useLibraryStore,
} from '@/core/store';
import { useResponsive } from '@/shared/hooks';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useCollabMode } from '@/hooks/useCollabMode';
import { CONSTRAINTS } from '@/core/constants';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import { ShareButton } from '@/features/cloud-share/components/ShareButton';
import { ShareModal } from '@/features/cloud-share/components/ShareModal';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { LanguageSelector } from '@/shared/components/LanguageSelector';
import { PresenceAvatars } from '../Collab';
import { useTranslation } from '@/i18n';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
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

  const halfBinMode = useHalfBinModeStore((state) => state.halfBinMode);
  const { printModalOpen, setPrintModalOpen } = useViewStore(
    useShallow((state) => ({
      printModalOpen: state.printModalOpen,
      setPrintModalOpen: state.setPrintModalOpen,
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
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
  const modKey = isMac ? '⌘' : 'Ctrl';

  return (
    <header className="h-12 flex items-center justify-between px-4 bg-surface-secondary border-b border-stroke-subtle">
      <div className="flex items-center gap-4 min-w-0">
        <ToolSwitcher iconOnly={isTablet} />

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
            {ICON_PATHS.layers.map((d) => (
              <path key={d} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
            ))}
          </svg>
          {!isTablet && <span className="hidden sm:inline">{t('header.layouts')}</span>}
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
          {!isTablet && <span className="hidden sm:inline">{t('header.print')}</span>}
        </button>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
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
              {ICON_PATHS.check.map((d) => (
                <path
                  key={d}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d={d}
                />
              ))}
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

        {/* Feedback link */}
        <a
          href="https://github.com/andymai/gridfinity-layout-tool/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost px-2.5 py-1.5 text-sm text-content-secondary flex items-center gap-1.5"
          title={t('header.sendFeedback')}
          aria-label={t('header.sendFeedback')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="hidden lg:inline">{t('header.sendFeedback')}</span>
        </a>

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

        <a
          href="https://github.com/andymai/gridfinity-layout-tool"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost px-2.5 py-1.5 text-sm text-content-secondary flex items-center gap-1.5"
          title={t('header.starOnGithub')}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          <span className="hidden lg:inline">{t('header.starOnGithub')}</span>
        </a>
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
