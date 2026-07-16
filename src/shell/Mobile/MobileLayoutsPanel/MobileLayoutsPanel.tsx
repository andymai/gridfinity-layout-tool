import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useMobileStore } from '@/core/store/mobile';
import { useInteractionStore } from '@/core/store/interaction';
import { useLayoutStore } from '@/core/store/layout';
import { useLayoutSwitcher } from '@/shared/hooks';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { LoadingFallback } from '@/shared/components/LoadingFallback';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';

// Lazy load gallery — only loaded when opened (matches Sidebar pattern)
const InspirationGallery = lazyWithRetry(() =>
  import('@/features/inspiration-gallery').then(namedExport('InspirationGallery'))
);

import {
  loadLayoutAsync,
  generateShareableURL,
  copyToClipboard,
  downloadLayoutAsFile,
} from '@/core/storage';
import type { Layout } from '@/core/types';
import { layoutId } from '@/core/types';
import { isOk } from '@/core/result';
import { useTranslation, useFormatting } from '@/i18n';
import { Button } from '@/design-system';
import { SvgIcon, ActionSheet, ShareOptionButton, ICON_PATHS } from './MobileLayoutsPanelParts';
import { LayoutListItem, findEntry } from './MobileLayoutsListItem';
import { MobileCloudSharePanel } from './MobileCloudSharePanel';

async function resolveLayout(
  id: string,
  activeLayoutId: string | null,
  currentLayout: Layout
): Promise<Layout | null> {
  if (id === activeLayoutId) return currentLayout;
  return loadLayoutAsync(id);
}

export function MobileLayoutsPanel() {
  const t = useTranslation();
  const { formatRelativeDate } = useFormatting();
  const [deleteLayoutId, setDeleteLayoutId] = useState<string | null>(null);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [cloudShareId, setCloudShareId] = useState<string | null>(null);
  const [renameLayoutId, setRenameLayoutId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showInspirationGallery, setShowInspirationGallery] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renameLayoutId && renameInputRef.current) {
      const timer = setTimeout(() => {
        renameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [renameLayoutId]);

  const {
    activeLayoutId,
    library,
    switchLayout,
    createNewLayout,
    deleteLayout,
    duplicateLayout,
    renameLayout,
  } = useLayoutSwitcher();

  const currentLayout = useLayoutStore((state) => state.layout);
  const closeMobilePanel = useMobileStore((state) => state.closeMobilePanel);
  const announceToScreenReader = useInteractionStore((state) => state.announceToScreenReader);

  const entries = library.entries;

  const resetSwipe = useCallback(() => {
    setSwipingId(null);
    setSwipeX(0);
  }, []);

  const sortedEntries = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.id === activeLayoutId) return -1;
        if (b.id === activeLayoutId) return 1;
        return b.modifiedAt - a.modifiedAt;
      }),
    [entries, activeLayoutId]
  );

  const handleSelectLayout = useCallback(
    async (id: string) => {
      if (id === activeLayoutId) return;

      const entry = findEntry(entries, id);
      const result = await switchLayout(layoutId(id));
      if (isOk(result)) {
        announceToScreenReader(
          t('layouts.announce.switchedTo', {
            name: entry?.name ?? t('layouts.announce.fallbackName'),
          })
        );
        closeMobilePanel();
      }
    },
    [activeLayoutId, switchLayout, entries, announceToScreenReader, closeMobilePanel, t]
  );

  const handleCreateNew = useCallback(async () => {
    const result = await createNewLayout();
    if (isOk(result)) {
      announceToScreenReader(t('toast.layoutCreated'));
      closeMobilePanel();
    }
  }, [createNewLayout, announceToScreenReader, closeMobilePanel, t]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      const entry = findEntry(entries, id);
      const result = await duplicateLayout(layoutId(id));
      if (isOk(result)) {
        announceToScreenReader(
          t('layouts.announce.duplicated', {
            name: entry?.name ?? t('layouts.announce.fallbackName'),
          })
        );
      }
      resetSwipe();
    },
    [duplicateLayout, entries, announceToScreenReader, resetSwipe, t]
  );

  const handleShare = useCallback(
    (id: string) => {
      setShareMenuId(id);
      resetSwipe();
    },
    [resetSwipe]
  );

  const handleRenameRequest = useCallback(
    (id: string) => {
      const entry = findEntry(entries, id);
      setRenameValue(entry?.name ?? '');
      setRenameLayoutId(id);
      resetSwipe();
    },
    [entries, resetSwipe]
  );

  const handleRenameConfirm = useCallback(() => {
    if (!renameLayoutId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameLayout(layoutId(renameLayoutId), trimmed);
      announceToScreenReader(t('layouts.announce.renamedTo', { name: trimmed }));
    }
    setRenameLayoutId(null);
    setRenameValue('');
  }, [renameLayoutId, renameValue, renameLayout, announceToScreenReader, t]);

  const handleCopyLink = useCallback(
    async (id: string) => {
      const entry = findEntry(entries, id);
      const layout = await resolveLayout(id, activeLayoutId, currentLayout);
      if (layout) {
        const url = generateShareableURL(layout);
        const success = await copyToClipboard(url);
        if (success) {
          announceToScreenReader(
            t('layouts.announce.linkCopiedFor', {
              name: entry?.name ?? t('layouts.announce.fallbackName'),
            })
          );
        }
      }
      setShareMenuId(null);
    },
    [activeLayoutId, currentLayout, entries, announceToScreenReader, t]
  );

  const handleDownload = useCallback(
    async (id: string) => {
      const entry = findEntry(entries, id);
      const layout = await resolveLayout(id, activeLayoutId, currentLayout);
      if (layout && entry) {
        await downloadLayoutAsFile(
          layout,
          `${entry.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`
        );
        announceToScreenReader(t('layouts.announce.downloaded'));
      }
      setShareMenuId(null);
    },
    [activeLayoutId, currentLayout, entries, announceToScreenReader, t]
  );

  const handleCloudShare = useCallback((id: string) => {
    setShareMenuId(null);
    setCloudShareId(id);
  }, []);

  const handleDeleteRequest = useCallback(
    (id: string) => {
      if (entries.length <= 1) {
        announceToScreenReader(t('layouts.announce.cannotDeleteOnly'));
        return;
      }
      setDeleteLayoutId(id);
      resetSwipe();
    },
    [entries.length, announceToScreenReader, resetSwipe, t]
  );

  const confirmDelete = useCallback(() => {
    if (!deleteLayoutId) return;
    const entry = findEntry(entries, deleteLayoutId);
    void deleteLayout(layoutId(deleteLayoutId));
    announceToScreenReader(
      t('layouts.announce.deleted', {
        name: entry?.name ?? t('layouts.announce.fallbackNameCapitalized'),
      })
    );
    setDeleteLayoutId(null);
  }, [deleteLayoutId, deleteLayout, entries, announceToScreenReader, t]);

  const handleTouchStart = useCallback(
    (_e: React.TouchEvent, id: string) => {
      if (id === activeLayoutId) return;
      setSwipingId(id);
      setSwipeX(0);
    },
    [activeLayoutId]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!swipingId) return;
      const touch = e.touches[0];
      const startX = e.currentTarget.getBoundingClientRect().left;
      const deltaX = touch.clientX - startX - e.currentTarget.clientWidth / 2;
      setSwipeX(Math.min(0, Math.max(-160, deltaX)));
    },
    [swipingId]
  );

  const handleTouchEnd = useCallback(() => {
    if (!swipingId) return;
    if (swipeX < -80) {
      setSwipeX(-160);
    } else {
      resetSwipe();
    }
  }, [swipingId, swipeX, resetSwipe]);

  const layoutToDelete = deleteLayoutId ? findEntry(entries, deleteLayoutId) : null;

  const dismissRename = useCallback(() => {
    setRenameLayoutId(null);
    setRenameValue('');
  }, []);

  const canDelete = entries.length > 1;

  return (
    <div className="pb-4">
      <div className="text-sm text-content-tertiary mb-3">
        {entries.length === 1
          ? t('mobile.layouts.layoutCountOne')
          : t('mobile.layouts.layoutCount', { count: entries.length })}
      </div>

      <div className="space-y-2">
        {sortedEntries.map((entry) => (
          <LayoutListItem
            key={entry.id}
            entry={entry}
            isActive={entry.id === activeLayoutId}
            isSwiping={swipingId === entry.id}
            swipeX={swipeX}
            canDelete={canDelete}
            formatRelativeDate={formatRelativeDate}
            onSelect={handleSelectLayout}
            onRename={handleRenameRequest}
            onShare={handleShare}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteRequest}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        ))}
      </div>

      <Button
        variant="ghost"
        fullWidth
        onClick={() => setShowInspirationGallery(true)}
        className="flex items-center gap-3 mt-4 p-3 rounded-xl bg-gradient-to-r from-accent/10 to-purple-500/10 border border-accent/20 active:scale-[0.98] hover:bg-gradient-to-r"
      >
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
          <SvgIcon path={ICON_PATHS.grid} className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-content">{t('gallery.title')}</div>
          <div className="text-xs text-content-tertiary">
            {t('mobile.layouts.getIdeasForYourDrawer')}
          </div>
        </div>
        <SvgIcon path={ICON_PATHS.chevronRight} className="w-4 h-4 text-content-tertiary" />
      </Button>

      <Button
        variant="secondary"
        fullWidth
        onClick={handleCreateNew}
        className="mt-3 h-12"
        leftIcon={<SvgIcon path={ICON_PATHS.plus} className="w-5 h-5" />}
      >
        {t('layouts.newLayout')}
      </Button>

      <ConfirmDialog
        isOpen={deleteLayoutId !== null}
        title={t('layouts.confirmDelete.title')}
        message={t('layouts.confirmDelete.message', { name: layoutToDelete?.name ?? '' })}
        confirmText={t('layouts.confirmDelete.confirm')}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteLayoutId(null)}
      />

      {shareMenuId && (
        <ActionSheet onClose={() => setShareMenuId(null)}>
          <h3 className="text-lg font-semibold text-content mb-4">{t('layouts.shareLayout')}</h3>
          <div className="space-y-2">
            <ShareOptionButton
              onClick={() => handleCloudShare(shareMenuId)}
              iconPath={ICON_PATHS.cloud}
              iconColor="text-purple-500"
              bgColor="bg-purple-500/20"
              title={t('share.shareToCloud')}
              description={t('mobile.layouts.createExpiringShareLink')}
            />
            <ShareOptionButton
              onClick={() => handleCopyLink(shareMenuId)}
              iconPath={ICON_PATHS.link}
              iconColor="text-accent"
              bgColor="bg-accent/20"
              title={t('share.copyLink')}
              description={t('share.link.urlEncoded')}
            />
            <ShareOptionButton
              onClick={() => handleDownload(shareMenuId)}
              iconPath={ICON_PATHS.download}
              iconColor="text-accent"
              bgColor="bg-accent-muted"
              title={t('share.file.download')}
              description={t('share.file.saveAsFile')}
            />
          </div>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => setShareMenuId(null)}
            className="mt-4 py-3 text-content-secondary hover:bg-transparent"
          >
            {t('common.cancel')}
          </Button>
        </ActionSheet>
      )}

      {renameLayoutId && (
        <ActionSheet onClose={dismissRename}>
          <h3 className="text-lg font-semibold text-content mb-4">
            {t('mobile.layouts.renameLayout')}
          </h3>
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameConfirm();
              } else if (e.key === 'Escape') {
                dismissRename();
              }
            }}
            className="w-full bg-surface px-4 py-3 rounded-lg border border-stroke focus:border-accent focus:outline-none text-content text-base"
            placeholder={t('layouts.layoutNamePlaceholder')}
            maxLength={64}
            // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
            autoFocus
          />
          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              fullWidth
              onClick={dismissRename}
              className="flex-1 py-3 text-content-secondary bg-surface rounded-lg"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={handleRenameConfirm}
              disabled={!renameValue.trim()}
              className="flex-1 py-3 text-on-dark bg-accent rounded-lg disabled:opacity-50"
            >
              {t('common.rename')}
            </Button>
          </div>
        </ActionSheet>
      )}

      {cloudShareId &&
        createPortal(
          <MobileCloudSharePanel layoutId={cloudShareId} onClose={() => setCloudShareId(null)} />,
          document.body
        )}

      {showInspirationGallery &&
        createPortal(
          <Suspense fallback={<LoadingFallback variant="overlay" label={t('loading.gallery')} />}>
            <InspirationGallery
              isOpen={showInspirationGallery}
              onClose={() => setShowInspirationGallery(false)}
            />
          </Suspense>,
          document.body
        )}
    </div>
  );
}
