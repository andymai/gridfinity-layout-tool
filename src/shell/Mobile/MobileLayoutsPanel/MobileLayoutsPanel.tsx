import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMobileStore } from '@/core/store/mobile';
import { useInteractionStore } from '@/core/store/interaction';
import { useLayoutStore } from '@/core/store/layout';
import { useLayoutSwitcher } from '@/shared/hooks';
import { useCloudShare } from '@/features/cloud-share/hooks/useCloudShare';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import { InspirationGallery } from '@/features/inspiration-gallery';
import {
  loadLayoutAsync,
  generateShareableURL,
  copyToClipboard,
  downloadLayoutAsFile,
} from '@/core/storage';
import { formatShareDate } from '@/features/cloud-share/utils/cloudShare';
import type { Layout, LayoutEntry, SharePermission } from '@/core/types';
import { layoutId } from '@/core/types';
import { isOk } from '@/core/result';
import { useTranslation, useFormatting } from '@/i18n';

const ICON_PATHS = {
  rename:
    'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  share:
    'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z',
  duplicate:
    'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  delete:
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  cloud: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  download:
    'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  grid: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  chevronLeft: 'M15 19l-7-7 7-7',
  chevronRight: 'M9 5l7 7-7 7',
  plus: 'M12 4v16m8-8H4',
  close: 'M6 18L18 6M6 6l12 12',
  check: 'M5 13l4 4L19 7',
} as const;

interface SvgIconProps {
  readonly path: string;
  readonly className?: string;
}

function SvgIcon({ path, className = 'w-5 h-5' }: SvgIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

interface ActionSheetProps {
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

function ActionSheet({ onClose, children }: ActionSheetProps) {
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />
        {children}
      </div>
    </div>,
    document.body
  );
}

interface ShareOptionButtonProps {
  readonly onClick: () => void;
  readonly iconPath: string;
  readonly iconColor: string;
  readonly bgColor: string;
  readonly title: string;
  readonly description: string;
}

function ShareOptionButton({
  onClick,
  iconPath,
  iconColor,
  bgColor,
  title,
  description,
}: ShareOptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 bg-surface rounded-lg active:bg-surface-hover"
    >
      <div className={`w-10 h-10 ${bgColor} rounded-full flex items-center justify-center`}>
        <SvgIcon path={iconPath} className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="text-left">
        <div className="font-medium text-content">{title}</div>
        <div className="text-sm text-content-secondary">{description}</div>
      </div>
    </button>
  );
}

interface SwipeActionButtonProps {
  readonly onClick: () => void;
  readonly iconPath: string;
  readonly bgColor: string;
  readonly label: string;
  readonly disabled?: boolean;
}

function SwipeActionButton({
  onClick,
  iconPath,
  bgColor,
  label,
  disabled,
}: SwipeActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-15 flex items-center justify-center ${bgColor} text-on-dark`}
      aria-label={label}
      disabled={disabled}
    >
      <SvgIcon path={iconPath} />
    </button>
  );
}

interface ActiveLayoutActionsProps {
  readonly entryId: string;
  readonly onRename: (id: string) => void;
  readonly onShare: (id: string) => void;
  readonly onDuplicate: (id: string) => void;
}

function ActiveLayoutActions({
  entryId,
  onRename,
  onShare,
  onDuplicate,
}: ActiveLayoutActionsProps) {
  const t = useTranslation();

  const actions = [
    { handler: onRename, icon: ICON_PATHS.rename, label: t('common.rename') },
    { handler: onShare, icon: ICON_PATHS.share, label: t('common.share') },
    { handler: onDuplicate, icon: ICON_PATHS.duplicate, label: t('common.duplicate') },
  ] as const;

  return (
    <div className="flex items-center gap-2 px-4 pb-4">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={() => action.handler(entryId)}
          className="btn btn-secondary flex-1 h-11"
        >
          <SvgIcon path={action.icon} className="w-4 h-4 mr-1.5" />
          {action.label}
        </button>
      ))}
    </div>
  );
}

function LoadingSpinner({ label }: { readonly label: string }) {
  return (
    <div className="flex items-center justify-center py-8" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-content-secondary">
        <svg
          className="w-5 h-5 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
}

interface PermissionSelectProps {
  readonly value: SharePermission;
  readonly onChange: (value: SharePermission) => void;
  readonly id?: string;
  readonly ariaLabel?: string;
  readonly className?: string;
}

function PermissionSelect({ value, onChange, id, ariaLabel, className }: PermissionSelectProps) {
  const t = useTranslation();
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as SharePermission)}
      className={`flex-1 bg-surface text-content px-3 py-2 rounded border border-stroke ${className ?? ''}`}
      aria-label={ariaLabel}
    >
      <option value="view">{t('mobile.layouts.anyoneCanView')}</option>
      <option value="edit">{t('mobile.layouts.anyoneCanEdit')}</option>
    </select>
  );
}

function findEntry(entries: readonly LayoutEntry[], id: string): LayoutEntry | undefined {
  return entries.find((e) => e.id === id);
}

async function resolveLayout(
  id: string,
  activeLayoutId: string | null,
  currentLayout: Layout
): Promise<Layout | null> {
  if (id === activeLayoutId) return currentLayout;
  return loadLayoutAsync(id);
}

interface LayoutListItemProps {
  readonly entry: LayoutEntry;
  readonly isActive: boolean;
  readonly isSwiping: boolean;
  readonly swipeX: number;
  readonly canDelete: boolean;
  readonly formatRelativeDate: (ts: number) => string;
  readonly onSelect: (id: string) => void;
  readonly onRename: (id: string) => void;
  readonly onShare: (id: string) => void;
  readonly onDuplicate: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onTouchStart: (e: React.TouchEvent, id: string) => void;
  readonly onTouchMove: (e: React.TouchEvent) => void;
  readonly onTouchEnd: () => void;
}

function LayoutListItem({
  entry,
  isActive,
  isSwiping,
  swipeX,
  canDelete,
  formatRelativeDate,
  onSelect,
  onRename,
  onShare,
  onDuplicate,
  onDelete,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: LayoutListItemProps) {
  const t = useTranslation();

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        <SwipeActionButton
          onClick={() => onRename(entry.id)}
          iconPath={ICON_PATHS.rename}
          bgColor="bg-warning"
          label={`Rename ${entry.name}`}
        />
        <SwipeActionButton
          onClick={() => onShare(entry.id)}
          iconPath={ICON_PATHS.share}
          bgColor="bg-success"
          label={`Share ${entry.name}`}
        />
        <SwipeActionButton
          onClick={() => onDuplicate(entry.id)}
          iconPath={ICON_PATHS.duplicate}
          bgColor="bg-accent"
          label={`Duplicate ${entry.name}`}
        />
        <SwipeActionButton
          onClick={() => onDelete(entry.id)}
          iconPath={ICON_PATHS.delete}
          bgColor="bg-danger"
          label={`Delete ${entry.name}`}
          disabled={!canDelete}
        />
      </div>

      <div
        className={`relative transition-transform duration-200 ${isActive ? 'bg-surface-hover border-l-4 border-l-accent' : 'bg-surface-elevated border-l-4 border-l-transparent'}`}
        style={{
          transform: isSwiping ? `translateX(${swipeX}px)` : 'translateX(0)',
          transitionDuration: isSwiping ? '0ms' : '200ms',
        }}
        onTouchStart={(e) => onTouchStart(e, entry.id)}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <button
          className="w-full p-4 text-left"
          onClick={() => onSelect(entry.id)}
          aria-current={isActive ? 'true' : undefined}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <LayoutThumbnail preview={entry.preview} size={48} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`truncate text-base ${isActive ? 'font-semibold text-content' : 'font-medium text-content'}`}
                >
                  {entry.name}
                </span>
                {isActive && (
                  <span className="text-xs px-2 py-0.5 bg-accent text-on-dark rounded flex-shrink-0">
                    {t('layouts.active')}
                  </span>
                )}
              </div>

              <LayoutPreviewInfo entry={entry} />

              <div className="text-xs text-content-tertiary mt-0.5">
                {formatRelativeDate(entry.modifiedAt)}
              </div>

              {entry.forkedFrom && (
                <div className="text-xs text-content-disabled">
                  {t('layouts.forkedFrom')}
                  {entry.forkedFrom.name}
                </div>
              )}
            </div>
          </div>
        </button>

        {isActive && (
          <ActiveLayoutActions
            entryId={entry.id}
            onRename={onRename}
            onShare={onShare}
            onDuplicate={onDuplicate}
          />
        )}
      </div>

      {!isActive && !isSwiping && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-content-disabled pointer-events-none">
          <SvgIcon path={ICON_PATHS.chevronLeft} className="w-4 h-4" />
        </div>
      )}
    </div>
  );
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
        announceToScreenReader(`Switched to ${entry?.name ?? 'layout'}`);
        closeMobilePanel();
      }
    },
    [activeLayoutId, switchLayout, entries, announceToScreenReader, closeMobilePanel]
  );

  const handleCreateNew = useCallback(async () => {
    const result = await createNewLayout();
    if (isOk(result)) {
      announceToScreenReader('New layout created');
      closeMobilePanel();
    }
  }, [createNewLayout, announceToScreenReader, closeMobilePanel]);

  const handleDuplicate = useCallback(
    async (id: string) => {
      const entry = findEntry(entries, id);
      const result = await duplicateLayout(layoutId(id));
      if (isOk(result)) {
        announceToScreenReader(`Duplicated ${entry?.name ?? 'layout'}`);
      }
      resetSwipe();
    },
    [duplicateLayout, entries, announceToScreenReader, resetSwipe]
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
      announceToScreenReader(`Renamed to ${trimmed}`);
    }
    setRenameLayoutId(null);
    setRenameValue('');
  }, [renameLayoutId, renameValue, renameLayout, announceToScreenReader]);

  const handleCopyLink = useCallback(
    async (id: string) => {
      const entry = findEntry(entries, id);
      const layout = await resolveLayout(id, activeLayoutId, currentLayout);
      if (layout) {
        const url = generateShareableURL(layout);
        const success = await copyToClipboard(url);
        if (success) {
          announceToScreenReader(`Link copied for ${entry?.name ?? 'layout'}`);
        }
      }
      setShareMenuId(null);
    },
    [activeLayoutId, currentLayout, entries, announceToScreenReader]
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
        announceToScreenReader('Layout downloaded');
      }
      setShareMenuId(null);
    },
    [activeLayoutId, currentLayout, entries, announceToScreenReader]
  );

  const handleCloudShare = useCallback((id: string) => {
    setShareMenuId(null);
    setCloudShareId(id);
  }, []);

  const handleDeleteRequest = useCallback(
    (id: string) => {
      if (entries.length <= 1) {
        announceToScreenReader('Cannot delete the only layout');
        return;
      }
      setDeleteLayoutId(id);
      resetSwipe();
    },
    [entries.length, announceToScreenReader, resetSwipe]
  );

  const confirmDelete = useCallback(() => {
    if (!deleteLayoutId) return;
    const entry = findEntry(entries, deleteLayoutId);
    void deleteLayout(layoutId(deleteLayoutId));
    announceToScreenReader(`${entry?.name ?? 'Layout'} deleted`);
    setDeleteLayoutId(null);
  }, [deleteLayoutId, deleteLayout, entries, announceToScreenReader]);

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
        {t('mobile.layouts.layoutCount', { count: entries.length })}
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

      <button
        onClick={() => setShowInspirationGallery(true)}
        className="w-full flex items-center gap-3 mt-4 p-3 rounded-xl bg-gradient-to-r from-accent/10 to-purple-500/10 border border-accent/20 active:scale-[0.98] transition-transform"
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
      </button>

      <button onClick={handleCreateNew} className="btn btn-secondary w-full mt-3 h-12">
        <SvgIcon path={ICON_PATHS.plus} className="w-5 h-5 mr-2" />
        {t('layouts.newLayout')}
      </button>

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
          <button
            onClick={() => setShareMenuId(null)}
            className="w-full mt-4 py-3 text-content-secondary font-medium"
          >
            {t('common.cancel')}
          </button>
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
            <button
              onClick={dismissRename}
              className="flex-1 py-3 text-content-secondary font-medium bg-surface rounded-lg"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleRenameConfirm}
              disabled={!renameValue.trim()}
              className="flex-1 py-3 text-on-dark font-medium bg-accent rounded-lg disabled:opacity-50"
            >
              {t('common.rename')}
            </button>
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
          <InspirationGallery
            isOpen={showInspirationGallery}
            onClose={() => setShowInspirationGallery(false)}
          />,
          document.body
        )}
    </div>
  );
}

function getLoadingLabel(status: string): string {
  switch (status) {
    case 'sharing':
      return 'Uploading layout...';
    case 'updating':
      return 'Updating share...';
    case 'deleting':
      return 'Deleting share...';
    default:
      return '';
  }
}

function MobileCloudSharePanel({ layoutId, onClose }: { layoutId: string; onClose: () => void }) {
  const t = useTranslation();
  const [urlCopied, setUrlCopied] = useState(false);
  const [localPermission, setLocalPermission] = useState<SharePermission>('view');

  const {
    status,
    result,
    error,
    existingShare,
    hasActiveShare,
    share,
    updatePermission,
    remove,
    copyUrl,
    reset,
  } = useCloudShare(layoutId);

  const permission: SharePermission = existingShare?.permission ?? localPermission;
  const setPermission = (newPermission: SharePermission) => {
    if (existingShare) {
      if (newPermission !== existingShare.permission) {
        void updatePermission(newPermission);
      }
    } else {
      setLocalPermission(newPermission);
    }
  };

  useEffect(() => {
    if (urlCopied) {
      const timer = setTimeout(() => setUrlCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [urlCopied]);

  const handleShare = async () => {
    await share(permission);
  };

  const handleDelete = async () => {
    const success = await remove();
    if (success) {
      onClose();
    }
  };

  const handleCopyUrl = async () => {
    const success = await copyUrl();
    if (success) setUrlCopied(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isLoading = status === 'sharing' || status === 'updating' || status === 'deleting';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end"
      onClick={onClose}
      role="presentation"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- stopPropagation prevents backdrop dismiss */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-cloud-share-title"
        className="bg-surface-elevated w-full rounded-t-2xl p-4 pb-8 animate-slide-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-content-disabled rounded-full mx-auto mb-4" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
            <SvgIcon path={ICON_PATHS.cloud} className="w-5 h-5 text-purple-500" />
          </div>
          <h3 id="mobile-cloud-share-title" className="text-lg font-semibold text-content">
            {t('mobile.layouts.cloudShare')}
          </h3>
        </div>

        {isLoading && <LoadingSpinner label={getLoadingLabel(status)} />}

        {status === 'error' && error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-error">
              <SvgIcon path={ICON_PATHS.close} />
              <span className="font-medium">{t('share.failedToShare')}</span>
            </div>
            <p className="text-sm text-content-secondary">{error.message}</p>
            <button
              onClick={reset}
              className="w-full py-3 bg-accent text-on-dark font-medium rounded-lg"
            >
              {t('mobile.layouts.tryAgain')}
            </button>
          </div>
        )}

        {status === 'success' && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-success">
              <SvgIcon path={ICON_PATHS.check} />
              <span className="font-medium">{t('share.sharedSuccessfully')}</span>
            </div>

            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm text-content-secondary mb-2">{t('toast.linkCopied')}</p>
              <p className="text-xs text-content-tertiary break-all font-mono">{result.url}</p>
            </div>

            <p className="text-sm text-content-secondary">
              {result.permission === 'edit'
                ? t('mobile.layouts.anyoneCanEdit')
                : t('mobile.layouts.anyoneCanView')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleCopyUrl}
                className="flex-1 py-3 bg-accent text-on-dark font-medium rounded-lg"
              >
                {urlCopied ? t('common.copied') : t('mobile.layouts.copyLinkAgain')}
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-surface text-content font-medium rounded-lg"
              >
                {t('common.done')}
              </button>
            </div>
          </div>
        )}

        {status === 'idle' && !hasActiveShare && (
          <div className="space-y-4">
            <p className="text-sm text-content-secondary">
              Share your layout to the cloud. Anyone with the link can import it.
            </p>

            <div className="flex items-center gap-3">
              <label
                htmlFor="mobile-permission"
                className="text-sm text-content-secondary whitespace-nowrap"
              >
                {t('mobile.layouts.permission')}
              </label>
              <PermissionSelect
                id="mobile-permission"
                value={permission}
                onChange={setPermission}
              />
            </div>

            <button
              onClick={handleShare}
              className="w-full py-3 bg-accent text-on-dark font-medium rounded-lg"
            >
              {t('share.shareToCloud')}
            </button>
          </div>
        )}

        {status === 'idle' && hasActiveShare && existingShare && (
          <div className="space-y-4">
            <div className="bg-surface rounded-lg p-3">
              <p className="text-sm text-content-secondary">
                {t('mobile.layouts.sharedOn')}
                {formatShareDate(existingShare.sharedAt)}
              </p>
              <p className="text-sm text-content">
                {existingShare.permission === 'edit'
                  ? t('mobile.layouts.anyoneCanEdit')
                  : t('mobile.layouts.anyoneCanView')}
              </p>
            </div>

            <button
              onClick={handleCopyUrl}
              className="w-full py-3 bg-accent text-on-dark font-medium rounded-lg"
            >
              {urlCopied ? t('common.copied') : t('share.copyLink')}
            </button>

            <div className="flex items-center gap-3">
              <PermissionSelect
                value={permission}
                onChange={setPermission}
                ariaLabel={t('mobile.layouts.updatePermission')}
                className="focus:outline-none"
              />
            </div>

            <button
              onClick={handleDelete}
              className="w-full py-2 text-sm text-content-tertiary hover:text-error transition-colors"
            >
              {t('mobile.layouts.deleteShare')}
            </button>
          </div>
        )}

        {status !== 'success' && (
          <button onClick={onClose} className="w-full mt-4 py-3 text-content-secondary font-medium">
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  );
}

function LayoutPreviewInfo({ entry }: { entry: LayoutEntry }) {
  const t = useTranslation();
  const { preview } = entry;

  return (
    <div className="flex items-center gap-3 text-sm text-content-secondary">
      <span className="flex items-center gap-1">
        <SvgIcon path={ICON_PATHS.grid} className="w-4 h-4" />
        {preview.drawerWidth}×{preview.drawerDepth}
      </span>

      <span>{t('mobile.layouts.previewBins', { count: preview.binCount })}</span>

      {preview.layerCount > 1 && (
        <span>{t('layouts.import.layers', { count: preview.layerCount })}</span>
      )}
    </div>
  );
}
