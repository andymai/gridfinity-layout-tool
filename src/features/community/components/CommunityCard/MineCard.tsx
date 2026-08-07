/**
 * Owner variant of the gallery card for the Mine filter: status badges for
 * hidden designs, the owner-only stats row (opens/views ride along on mine=1
 * items), and Edit/Unpublish actions. No like heart or author link; the
 * owner cannot meaningfully like themselves and the author view is theirs.
 */

import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Badge, Button, ConfirmDialog, cn } from '@/design-system';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { useResponsive } from '@/shared/hooks/useResponsive';
import type { CommunityCard as CommunityCardData } from '@/shared/types/community';
import { unpublishDesign } from '../../api/client';
import { useBrowseStore } from '../../store/browseStore';
import { useMineStore } from '../../store/mineStore';
import { HeartGlyph, PrintGlyph, RemixGlyph } from './CommunityCard';
import { formatCardDims } from './cardDims';

export interface MineCardProps {
  card: CommunityCardData;
  onSelect: (card: CommunityCardData) => void;
  /** Opens the local original in the publish dialog's update mode (shell-implemented). */
  onEdit: (card: CommunityCardData) => void;
  /** Best-effort local publishedId cleanup after a successful unpublish. */
  onUnpublished?: (publishedId: string) => Promise<void>;
  /** True while another card's Edit action is in flight. */
  editBusy: boolean;
  index: number;
}

function PlaceholderGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8 text-content-disabled"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

export function MineCard({
  card,
  onSelect,
  onEdit,
  onUnpublished,
  editBusy,
  index,
}: MineCardProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const removeItem = useMineStore((s) => s.removeItem);
  const addToast = useToastStore((s) => s.addToast);

  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>(
    card.thumbnailUrl === '' ? 'error' : 'loading'
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | undefined>(undefined);

  const animationDelay = `${Math.min(index * 50, 300)}ms`;
  const dims = formatCardDims(card.metrics);
  const isHidden = card.status === 'hidden';
  const isDenylistHide = isHidden && card.hiddenReason === 'denylist';
  const isModerationHide = isHidden && card.hiddenReason === 'moderation';

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(card);
    }
  };

  const handleEdit = (event: MouseEvent<HTMLButtonElement>) => {
    // Nested action on a clickable card root: must not also open the detail.
    event.stopPropagation();
    onEdit(card);
  };

  const handleUnpublishEntry = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setUnpublishError(undefined);
    setConfirmOpen(true);
  };

  const handleUnpublishConfirm = () => {
    if (unpublishBusy) return;
    setUnpublishBusy(true);
    setUnpublishError(undefined);
    void unpublishDesign(card.id).then(async (result) => {
      setUnpublishBusy(false);
      if (isOk(result)) {
        trackEvent('community_unpublish');
        removeItem(card.id);
        // The public index cache holds the same card; drop it too so the
        // just-unpublished design does not linger in the public grid as a
        // dead card until the next staleness refresh.
        useBrowseStore.getState().removeItem(card.id);
        addToast(t('community.toast.unpublished'), 'success');
        setConfirmOpen(false);
        await onUnpublished?.(card.id);
      } else {
        setUnpublishError(
          result.error.kind === 'network'
            ? t('community.publish.error.offline')
            : t('community.mine.unpublishFailed')
        );
      }
    });
  };

  return (
    <>
      {/* Not a design-system Button: Edit/Unpublish are real nested buttons,
          and button-in-button is invalid HTML (same rule as CommunityCard). */}
      <div
        role="button"
        tabIndex={0}
        // The aria-label supplies the whole accessible name, so the visual
        // status badge must be folded in or screen readers never hear it.
        aria-label={isHidden ? t('community.mine.cardHiddenAria', { name: card.name }) : card.name}
        onClick={() => onSelect(card)}
        onKeyDown={handleKeyDown}
        className={cn(
          'group h-auto w-full cursor-pointer select-none flex-col items-stretch justify-start',
          'flex rounded-lg bg-surface-secondary p-2 text-left text-sm font-normal',
          'border-2 border-transparent hover:border-accent/50 hover:bg-surface-secondary',
          'transition-colors motion-safe:animate-fade-in-up',
          'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent'
        )}
        style={{ animationDelay }}
        data-testid="community-mine-card"
      >
        <span className="relative mb-2 flex aspect-square items-center justify-center overflow-hidden rounded bg-surface">
          {imageState !== 'loaded' && (
            <span
              aria-hidden="true"
              data-testid="community-card-placeholder"
              className="absolute inset-0 flex items-center justify-center bg-surface"
            >
              <PlaceholderGlyph />
            </span>
          )}
          {imageState !== 'error' && (
            <img
              src={card.thumbnailUrl}
              alt=""
              loading="lazy"
              draggable={false}
              onLoad={() => setImageState('loaded')}
              onError={() => setImageState('error')}
              className={cn('h-full w-full object-cover', isHidden && 'opacity-50')}
            />
          )}
          {isHidden &&
            (isDenylistHide ? (
              <Badge
                tone="error"
                className="absolute left-1 top-1"
                data-testid="community-denylisted-badge"
              >
                {t('community.mine.badge.accountRestricted')}
              </Badge>
            ) : isModerationHide ? (
              <Badge
                tone="warning"
                className="absolute left-1 top-1"
                data-testid="community-moderation-badge"
              >
                {t('community.mine.badge.hiddenModeration')}
              </Badge>
            ) : (
              <Badge
                tone="warning"
                className="absolute left-1 top-1"
                data-testid="community-hidden-badge"
              >
                {t('community.mine.badge.hiddenReports')}
              </Badge>
            ))}
        </span>

        <span
          className="line-clamp-1 text-sm font-medium leading-tight text-content"
          title={card.name}
        >
          {card.name}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs text-content-tertiary">
          <span>{dims}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-0.5">
            <HeartGlyph />
            <span aria-hidden="true">{card.counts.likes}</span>
            <span className="sr-only">
              {t('community.card.likesLabel', { count: card.counts.likes })}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-0.5">
            <RemixGlyph />
            <span aria-hidden="true">{card.counts.remixes}</span>
            <span className="sr-only">
              {t('community.card.remixesLabel', { count: card.counts.remixes })}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-0.5">
            <PrintGlyph />
            <span aria-hidden="true">{card.counts.exports}</span>
            <span className="sr-only">
              {t('community.mine.printsLabel', { count: card.counts.exports })}
            </span>
          </span>
          {card.counts.opens !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span data-testid="community-mine-opens">
                {t('community.mine.stats.opens')} {card.counts.opens}
              </span>
            </>
          )}
          {card.counts.views !== undefined && (
            <>
              <span aria-hidden="true">·</span>
              <span data-testid="community-mine-views">
                {t('community.mine.stats.views')} {card.counts.views}
              </span>
            </>
          )}
        </span>

        <span className="mt-2 flex items-center gap-1.5">
          <Button
            variant="secondary"
            aria-label={t('community.mine.editAria', { name: card.name })}
            // Server-enforced too (PUT 403s while non-live); disabling up
            // front spares the owner a round trip guaranteed to fail.
            disabled={isHidden || editBusy}
            title={isHidden ? t('community.mine.editDisabledHidden') : undefined}
            touchTarget={isMobile}
            onClick={handleEdit}
            className="h-auto px-2.5 py-1 text-xs"
            data-testid="community-mine-edit"
          >
            {t('community.mine.edit')}
          </Button>
          <Button
            variant="ghost"
            aria-label={t('community.mine.unpublishAria', { name: card.name })}
            touchTarget={isMobile}
            onClick={handleUnpublishEntry}
            className="h-auto px-2.5 py-1 text-xs text-error hover:text-error"
            data-testid="community-mine-unpublish"
          >
            {t('community.mine.unpublish')}
          </Button>
        </span>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title={t('community.publish.unpublishTitle')}
        message={t('community.publish.unpublishMessage')}
        confirmText={t('community.publish.unpublish')}
        cancelText={t('common.cancel')}
        destructive
        busy={unpublishBusy}
        error={unpublishError}
        onConfirm={handleUnpublishConfirm}
        onCancel={() => {
          if (!unpublishBusy) {
            setConfirmOpen(false);
            setUnpublishError(undefined);
          }
        }}
      />
    </>
  );
}
