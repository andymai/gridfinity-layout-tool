/* eslint-disable react-refresh/only-export-components -- findEntry is a tiny lookup helper co-located with its primary consumer; splitting it into a separate file would scatter the row's API across three files */

/**
 * Single row of the mobile layouts list. Renders the swipe-action overlay,
 * the layout thumbnail + name + preview info, and the active-row action bar
 * shown below the active layout.
 */

import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { LayoutThumbnail } from '@/shell/LayoutThumbnail';
import type { LayoutEntry } from '@/core/types';
import {
  SvgIcon,
  SwipeActionButton,
  ActiveLayoutActions,
  ICON_PATHS,
} from './MobileLayoutsPanelParts';

export function findEntry(entries: readonly LayoutEntry[], id: string): LayoutEntry | undefined {
  return entries.find((e) => e.id === id);
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

export function LayoutListItem({
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
        <Button
          variant="ghost"
          className="w-full p-4 text-left justify-start rounded-none hover:bg-transparent"
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

              <div className="text-xs font-normal text-content-tertiary mt-0.5">
                {formatRelativeDate(entry.modifiedAt)}
              </div>

              {entry.forkedFrom && (
                <div className="text-xs font-normal text-content-disabled">
                  {t('layouts.forkedFrom')}
                  {entry.forkedFrom.name}
                </div>
              )}
            </div>
          </div>
        </Button>

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

function LayoutPreviewInfo({ entry }: { entry: LayoutEntry }) {
  const t = useTranslation();
  const { preview } = entry;

  return (
    <div className="flex items-center gap-3 text-sm font-normal text-content-secondary">
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
