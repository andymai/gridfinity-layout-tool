import { Suspense } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore, useViewStore } from '@/core/store';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { useMutations } from '@/shared/contexts';
import { useResponsive } from '@/shared/hooks';
import { useCollabMode } from '@/shared/hooks/useCollabMode';
import { CONSTRAINTS, DEFAULT_LAYOUT_NAME } from '@/core/constants';
import { activePress, Button, IconButton, InlineEditText, Tooltip } from '@/design-system';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';
import { ShareButton } from '@/features/cloud-share/components/ShareButton';
import { ShareModal } from '@/features/cloud-share/components/ShareModal';
import { ToolSwitcher } from '@/shared/components/ToolSwitcher';
import { LayoutQuickSwitch } from '@/features/layout-library';
import { trackEvent } from '@/shared/analytics/posthog';
import { HeaderSupportLinks } from '@/shared/components/HeaderSupportLinks';
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
const BaseplateLibraryModal = lazyWithRetry(() =>
  import('@/features/baseplate/components/BaseplateLibraryModal').then(
    namedExport('BaseplateLibraryModal')
  )
);
const PrintModal = lazyWithRetry(() =>
  import('@/features/print-export/components/PrintModal').then(namedExport('PrintModal'))
);
const LayoutExportDialog = lazyWithRetry(() =>
  import('@/shell/layoutExport/LayoutExportDialog').then(namedExport('LayoutExportDialog'))
);
// Presence avatars pull the Liveblocks client. Most layouts never enter a
// collab session, so keep it out of the eager Header bundle — load only when
// a collab session is actually active.
const PresenceAvatars = lazyWithRetry(() =>
  import('../Collab/PresenceAvatars').then(namedExport('PresenceAvatars'))
);

interface HeaderProps {
  saveStatus: SaveStatus;
}

export function Header({ saveStatus }: HeaderProps) {
  const t = useTranslation();
  const { isTablet } = useResponsive();
  const { isCollaborative } = useCollabMode();

  const layout = useLayoutStore((state) => state.layout);
  const { setName } = useMutations();

  const { canUndo, canRedo, undo, redo } = useHistoryStore(
    useShallow((state) => ({
      canUndo: state.canUndo,
      canRedo: state.canRedo,
      undo: state.undo,
      redo: state.redo,
    }))
  );

  const {
    printModalOpen,
    setPrintModalOpen,
    layoutExportOpen,
    setLayoutExportOpen,
    showLayoutManager,
    setShowLayoutManager,
    showBaseplateLibrary,
    setShowBaseplateLibrary,
  } = useViewStore(
    useShallow((state) => ({
      printModalOpen: state.printModalOpen,
      setPrintModalOpen: state.setPrintModalOpen,
      layoutExportOpen: state.layoutExportOpen,
      setLayoutExportOpen: state.setLayoutExportOpen,
      showLayoutManager: state.showLayoutManager,
      setShowLayoutManager: state.setShowLayoutManager,
      showBaseplateLibrary: state.showBaseplateLibrary,
      setShowBaseplateLibrary: state.setShowBaseplateLibrary,
    }))
  );

  // Only bins linked to a saved design have printable geometry, but the button
  // stays live when none are: LayoutExportDialog explains the gap and names the
  // action that closes it. Gating the control instead put the sole explanation
  // in a tooltip that touch devices never render, leaving the dialog
  // effectively unreachable.

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
        <InlineEditText
          value={layout.name}
          onCommit={setName}
          fallback={DEFAULT_LAYOUT_NAME}
          maxLength={CONSTRAINTS.NAME_MAX_LENGTH}
          aria-label={t('header.editLayoutName')}
          displayClassName="h-8 max-w-[200px]"
        />

        <LayoutQuickSwitch onManage={() => setShowLayoutManager(true)} />

        {/* Print Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPrintModalOpen(true)}
          className={`px-2 h-8 text-sm gap-1.5 ${activePress} text-content-secondary`}
          title={t('header.printLayout')}
          aria-label={t('header.printLayout')}
          leftIcon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
          }
        >
          {!isTablet && <span className="hidden sm:inline">{t('header.print')}</span>}
        </Button>

        {/* Export Button — label stays visible at every width because the
            tooltip that would otherwise explain it is suppressed on touch. */}
        <Tooltip content={t('layoutExport.button')}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              trackEvent('ui.modalOpen', { modal: 'layoutExport', source: 'header' });
              setLayoutExportOpen(true);
            }}
            className={`px-2 h-8 text-sm gap-1.5 ${activePress} text-content-secondary`}
            aria-label={t('layoutExport.button')}
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {ICON_PATHS.download.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
            }
          >
            <span>{t('header.export')}</span>
          </Button>
        </Tooltip>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Save status indicator */}
        {saveStatus === 'saving' && (
          <div
            className="flex items-center gap-1.5 px-2 py-1 text-micro mr-2 text-content-tertiary"
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
            className="flex items-center gap-1.5 px-2 py-1 text-micro mr-2 text-content-secondary animate-fade-in"
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

        <div className="flex items-center">
          <IconButton
            size="sm"
            touchTarget={false}
            onClick={undo}
            disabled={!canUndo}
            className="h-8 w-8"
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
          </IconButton>
          <IconButton
            size="sm"
            touchTarget={false}
            onClick={redo}
            disabled={!canRedo}
            className="h-8 w-8"
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
          </IconButton>
          <ShareButton />
        </div>

        {/* Only render PresenceAvatars when actually in collab mode (inside RoomProvider) */}
        {isCollaborative && (
          <Suspense fallback={null}>
            <PresenceAvatars className="ml-2" />
          </Suspense>
        )}

        <div className="w-px h-6 bg-stroke-subtle mx-2" />

        <HeaderSupportLinks />
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

      {showBaseplateLibrary && (
        <Suspense fallback={<LoadingFallback variant="overlay" />}>
          <BaseplateLibraryModal
            isOpen={showBaseplateLibrary}
            onClose={() => setShowBaseplateLibrary(false)}
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

      {layoutExportOpen && (
        <Suspense fallback={<LoadingFallback variant="overlay" />}>
          <LayoutExportDialog open={layoutExportOpen} onClose={() => setLayoutExportOpen(false)} />
        </Suspense>
      )}
    </header>
  );
}
