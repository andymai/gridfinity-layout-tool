/**
 * The design detail's print list: the derived summary, then everyone's
 * records, newest first.
 *
 * Owns its own fetch rather than taking a prop, because the detail overlay
 * already fetches the caller's own print for the CTA and the two would
 * otherwise have to stay in sync through the parent.
 */

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
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
  /** Opens the enlarged view on a print's nth photo. */
  onOpenPhoto?: (printId: string, photoIndex: number) => void;
  /**
   * Reports the loaded records upward. The detail view builds the media
   * sequence from them, and this section is the only place that paginates, so
   * without it a photo revealed by Load more would have no index to open on.
   */
  onItemsChange?: (items: readonly CommunityPrint[]) => void;
  /** Opens the print dialog from this section's own header; absent hides the CTA. */
  onAddPrint?: () => void;
  /** Drives the CTA's touch target; the overlay owns the breakpoint. */
  isMobile?: boolean;
}

type LoadStatus = 'loading' | 'ready' | 'error';

export function PrintsSection({
  designId,
  ownPrint,
  refreshToken,
  onReport,
  isOwner = false,
  coverPhotoUrl = '',
  onOpenPhoto,
  onItemsChange,
  onAddPrint,
  isMobile = false,
}: PrintsSectionProps) {
  const t = useTranslation();

  const [items, setItems] = useState<readonly CommunityPrint[]>([]);
  // Accumulates across pages like `items` does: a printer badged on page one
  // must stay badged when page two loads.
  const [supporterAuthors, setSupporterAuthors] = useState<ReadonlySet<string>>(new Set());
  const [summary, setSummary] = useState<CommunityPrintSummary | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Which request the state below answers. Deriving the loading state from
  // this rather than resetting a status flag in the effect body keeps the
  // effect free of a synchronous setState.
  const [answered, setAnswered] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  // Stamped with the design it belongs to, the same trick the detail overlay
  // uses for its own print: the component can be reused across designs, and a
  // stamped value is stale-proof without a synchronous reset in an effect.
  const [coverOverride, setCoverOverride] = useState<{ designId: string; url: string } | null>(
    null
  );
  const cover = coverOverride?.designId === designId ? coverOverride.url : coverPhotoUrl;
  const setCover = useCallback((url: string) => setCoverOverride({ designId, url }), [designId]);

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
          setSupporterAuthors(new Set());
          setSummary(null);
          setCursor(null);
          setAnswered(requestKey);
          return;
        }
        setFailed(requestKey);
        return;
      }
      setItems(result.value.items);
      setSupporterAuthors(new Set(result.value.supporterAuthorIds ?? []));
      setSummary(result.value.summary);
      setCursor(result.value.nextCursor);
      setAnswered(requestKey);
    });
    return () => {
      cancelled = true;
    };
  }, [designId, requestKey]);

  // Layout effect, not a passive one: Load more renders the new photo tiles as
  // clickable in the same commit, and the parent resolves a click against its
  // own copy of the list. A passive effect leaves a window where those tiles
  // exist but the parent cannot place them, and the click resolves to nothing.
  useLayoutEffect(() => {
    onItemsChange?.(items);
  }, [items, onItemsChange]);

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
    [cover, designId, setCover, t]
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
        setSupporterAuthors(
          (current) => new Set([...current, ...(result.value.supporterAuthorIds ?? [])])
        );
        setCursor(result.value.nextCursor);
      })
      .finally(() => setMoreBusy(false));
  }, [cursor, designId, moreBusy]);

  // Rendered in every load state, so the CTA survives the spinner and a failed
  // fetch: posting a print does not depend on being able to read the existing
  // ones.
  const header = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-content">{t('community.prints.title')}</h3>
        {onAddPrint !== undefined && (
          <Button
            variant="secondary"
            // The feature's primary conversion button. `size="sm"` is 24px, so
            // without this it would be the one control in the overlay a thumb
            // cannot reliably hit.
            touchTarget={isMobile}
            size={isMobile ? undefined : 'sm'}
            onClick={onAddPrint}
            data-testid="community-detail-add-print"
          >
            {t(ownPrint === null ? 'community.print.cta' : 'community.print.editCta')}
          </Button>
        )}
      </div>
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
    </>
  );

  return (
    <section className="space-y-3" data-testid="prints-section">
      {header}

      {status === 'loading' && (
        <div className="flex justify-center py-4" data-testid="prints-section-loading">
          <Spinner size="sm" />
          <span className="sr-only" role="status">
            {t('common.loading')}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2" data-testid="prints-section-error">
          <p className="text-sm text-content-secondary">{t('community.prints.error')}</p>
          <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            {t('community.prints.retry')}
          </Button>
        </div>
      )}

      {status === 'ready' && (
        <>
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
              <ul role="list" className="space-y-2">
                {items.map((print) => (
                  <PrintCard
                    key={print.id}
                    print={print}
                    isMine={ownPrint !== null && print.id === ownPrint.id}
                    authorIsSupporter={supporterAuthors.has(print.authorPublicId)}
                    onReport={onReport}
                    onPromoteCover={isOwner ? applyCover : undefined}
                    coverPhotoUrl={cover}
                    onOpenPhoto={onOpenPhoto}
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
        </>
      )}
    </section>
  );
}
