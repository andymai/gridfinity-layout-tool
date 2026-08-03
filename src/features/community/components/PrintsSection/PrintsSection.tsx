/**
 * The design detail's print list: the derived summary, then everyone's
 * records, newest first.
 *
 * Owns its own fetch rather than taking a prop, because the detail overlay
 * already fetches the caller's own print for the CTA and the two would
 * otherwise have to stay in sync through the parent.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import type { CommunityPrint, CommunityPrintSummary } from '@/shared/types/communityPrint';
import { useToastStore } from '@/core/store/toast';
import { fetchPrints, setCoverPhoto } from '../../api/printsClient';
import { PrintCard } from './PrintCard';
import { PrintSummary } from './PrintSummary';

export interface PrintsSectionProps {
  designId: string;
  /** The viewer's own print, owned by the parent so the CTA and this list agree. */
  ownPrint: CommunityPrint | null;
  /** Bumped by the parent after a save or delete to force a refetch. */
  refreshToken: number;
  onReport?: (print: CommunityPrint) => void;
  /** Present only for the design's owner; enables cover promotion. */
  isOwner?: boolean;
  /** The design's current cover photo, '' when it still uses the render. */
  coverPhotoUrl?: string;
}

type LoadStatus = 'loading' | 'ready' | 'error';

export function PrintsSection({
  designId,
  ownPrint,
  refreshToken,
  onReport,
  isOwner = false,
  coverPhotoUrl = '',
}: PrintsSectionProps) {
  const t = useTranslation();

  const [items, setItems] = useState<readonly CommunityPrint[]>([]);
  const [summary, setSummary] = useState<CommunityPrintSummary | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Which request the state below answers. Deriving the loading state from
  // this rather than resetting a status flag in the effect body keeps the
  // effect free of a synchronous setState.
  const [answered, setAnswered] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [cover, setCover] = useState(coverPhotoUrl);

  const requestKey = `${designId}:${refreshToken}:${attempt}`;
  const status: LoadStatus =
    failed === requestKey ? 'error' : answered === requestKey ? 'ready' : 'loading';

  useEffect(() => {
    let cancelled = false;
    void fetchPrints(designId).then((result) => {
      if (cancelled) return;
      if (!isOk(result)) {
        // The kill switch renders as an empty section rather than an error:
        // "we could not load this" is wrong when the feature is simply off.
        if (result.error.kind === 'disabled') {
          setItems([]);
          setSummary(null);
          setCursor(null);
          setAnswered(requestKey);
          return;
        }
        setFailed(requestKey);
        return;
      }
      setItems(result.value.items);
      setSummary(result.value.summary);
      setCursor(result.value.nextCursor);
      setAnswered(requestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [designId, requestKey]);

  const applyCover = useCallback(
    (photoUrl: string | null) => {
      const previous = cover;
      // Optimistic: the grid is elsewhere, so the only local feedback is this
      // label. Reverted on failure rather than left claiming a cover that the
      // server rejected.
      setCover(photoUrl ?? '');
      void setCoverPhoto(designId, photoUrl).then((result) => {
        if (!isOk(result)) {
          setCover(previous);
          useToastStore.getState().addToast(t('community.prints.coverFailed'), 'error');
        }
      });
    },
    [cover, designId, t]
  );

  const handleLoadMore = useCallback(() => {
    if (cursor === null || moreBusy) return;
    setMoreBusy(true);
    void fetchPrints(designId, cursor)
      .then((result) => {
        if (!isOk(result)) return;
        // Appending by id keeps a record that arrived on both pages (a write
        // landing mid-pagination shifts the offsets) from rendering twice.
        setItems((current) => {
          const seen = new Set(current.map((print) => print.id));
          return [...current, ...result.value.items.filter((print) => !seen.has(print.id))];
        });
        setCursor(result.value.nextCursor);
      })
      .finally(() => setMoreBusy(false));
  }, [cursor, designId, moreBusy]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center py-4" data-testid="prints-section-loading">
        <Spinner size="sm" />
        <span className="sr-only" role="status">
          {t('common.loading')}
        </span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="space-y-2" data-testid="prints-section-error">
        <p className="text-sm text-content-secondary">{t('community.prints.error')}</p>
        <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
          {t('community.prints.retry')}
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-3" data-testid="prints-section">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-content">{t('community.prints.title')}</h3>
        {isOwner && cover !== '' && (
          <Button
            variant="ghost"
            onClick={() => applyCover(null)}
            className="h-auto p-0 text-xs font-normal text-content-tertiary underline-offset-2 hover:underline"
            data-testid="prints-clear-cover"
          >
            {t('community.prints.clearCover')}
          </Button>
        )}
      </div>

      {summary !== null && summary.count > 0 && (
        <>
          <PrintSummary summary={summary} />
          <p className="text-xs text-content-tertiary">{t('community.prints.verdictHint')}</p>
        </>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-content-tertiary" data-testid="prints-section-empty">
          {ownPrint === null ? t('community.prints.emptyOwn') : t('community.prints.empty')}
        </p>
      ) : (
        <>
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles */}
          <ul role="list" className="space-y-2">
            {items.map((print) => (
              <PrintCard
                key={print.id}
                print={print}
                isMine={ownPrint !== null && print.id === ownPrint.id}
                onReport={onReport}
                onPromoteCover={isOwner ? applyCover : undefined}
                coverPhotoUrl={cover}
              />
            ))}
          </ul>

          {cursor !== null && (
            <Button
              variant="secondary"
              onClick={handleLoadMore}
              disabled={moreBusy}
              className="w-full justify-center"
              data-testid="prints-load-more"
            >
              {t('community.prints.loadMore')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
