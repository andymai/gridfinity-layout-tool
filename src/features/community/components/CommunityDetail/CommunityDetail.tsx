/**
 * Community design detail overlay. Mounted by the shell (DesignGalleryModal)
 * only while a request is open in the core communityDetail store; the
 * designer-facing actions arrive as props from the shell composition so this
 * feature never imports the bin designer (see shared/types/communityDetail).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Button, Dialog, IconButton, Menu, Spinner } from '@/design-system';
import { MoreHorizontalIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import type { CommunityDetailRequest } from '@/core/store/communityDetail';
import { useGapFitStore } from '@/core/store/gapFit';
import { useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityDesign, CommunityDesignCounts } from '@/shared/types/community';
import type { CommunityPrint } from '@/shared/types/communityPrint';
import type { CommunityDetailProps } from '@/shared/types/communityDetail';
import { savePendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import { fetchCommunityDesign } from '../../api/client';
import { useLikeToggle } from '../../hooks/useLikeToggle';
import type { LikeToggleTarget } from '../../hooks/useLikeToggle';
import { useBrowseStore } from '../../store/browseStore';
import type { CardLikePatch } from '../../store/browseStore';
import { recordRecentlyViewed } from '../../utils/recentlyViewed';
import { ReportDialog } from '../ReportDialog';
import { CommunitySignInPrompt } from '../SignInPrompt';
import { fetchPrints } from '../../api/printsClient';
import { usePrintDialogStore } from '../../store/printDialogStore';
import { PrintDialog } from '../PrintDialog';
import { CommunityDetailContent } from './CommunityDetailContent';
import type { OwnerModeration, ParentResolution } from './CommunityDetailContent';
import { useDetailHistoryTrap } from './useDetailHistoryTrap';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';

type DetailPhase = 'loading' | 'ready' | 'gone' | 'error';

type BusyAction = 'remix' | 'edit' | 'duplicate' | 'place' | null;

/** Detail-payload stats fallback for designs the capped browse index lacks. */
interface DetailStats {
  counts: CommunityDesignCounts;
  likedByMe: boolean;
}

function publicDesignUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/community/d/${id}`;
}

export function CommunityDetail(props: CommunityDetailProps) {
  const request = useCommunityDetailStore((s) => s.request);
  if (request === null) return null;
  return <CommunityDetailHost request={request} {...props} />;
}

interface CommunityDetailHostProps extends CommunityDetailProps {
  request: CommunityDetailRequest;
}

/**
 * Owns the history trap above the keyed dialog: it stays mounted across
 * detail-to-detail transitions (the similar rail swaps the request in place),
 * so one trapped entry spans them all. Trapping inside the keyed dialog would
 * run the old instance's cleanup back() concurrently with the new instance's
 * pushState and could pop the fresh trap.
 */
function CommunityDetailHost({ request, ...props }: CommunityDetailHostProps) {
  const close = useCallback(() => {
    useCommunityDetailStore.getState().close();
  }, []);

  // On the route surface the host page owns history: /community/d/<id> is a
  // real entry, so the URL-less trap entry must not stack on top of it.
  const consumeTrap = useDetailHistoryTrap(close, (props.surface ?? 'tab') !== 'route');

  return (
    <CommunityDetailDialog
      key={request.designId}
      request={request}
      close={close}
      consumeTrap={consumeTrap}
      {...props}
    />
  );
}

interface CommunityDetailDialogProps extends CommunityDetailProps {
  request: CommunityDetailRequest;
  close: () => void;
  consumeTrap: (onConsumed: () => void) => void;
}

function CommunityDetailDialog({
  request,
  close,
  consumeTrap,
  onRequestCloseGallery,
  onRemixDesign,
  onEditOriginal,
  onPlaceInLayout,
  surface = 'tab',
}: CommunityDetailDialogProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const addToast = useToastStore((s) => s.addToast);

  const [phase, setPhase] = useState<DetailPhase>('loading');
  const [design, setDesign] = useState<CommunityDesign | null>(null);
  const [detailStats, setDetailStats] = useState<DetailStats | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  // Stamped with the design it belongs to rather than cleared on switch: the
  // overlay can go ready for design B while this still holds A's answer, and a
  // stamped value is stale-proof without a synchronous reset in an effect.
  const [ownPrint, setOwnPrint] = useState<{
    designId: string;
    print: CommunityPrint | null;
  } | null>(null);
  const [ownerModeration, setOwnerModeration] = useState<OwnerModeration | null>(null);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [parentResolution, setParentResolution] = useState<ParentResolution>({
    kind: 'snapshot',
  });
  const [reportOpen, setReportOpen] = useState(false);
  const [signInIntent, setSignInIntent] = useState<'like' | 'report' | null>(null);
  const [overflowMenu, setOverflowMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
  }>({ open: false, position: { x: 0, y: 0 } });

  const { designId, card } = request;

  // Live browse-store card for this design: optimistic like patches land in
  // the store, so the stats row reflects them without local mirror state.
  // A design the capped index lacks (or a cold deep link) falls back to the
  // detail payload's stats, then to the request's snapshot.
  const liveCard = useBrowseStore((s) => s.items.find((item) => item.id === designId) ?? null);

  // Post-OAuth resumed like pushed by useCommunityLikeReturn: the record
  // fetch can race the resumed like write server-side and snapshot a stale
  // likedByMe that would contradict the "Design liked." toast, so a matching
  // sync record overrides the fetched fallback until a manual toggle (which
  // consumes it) or close.
  const likeSync = useCommunityDetailStore((s) => s.likeSync);
  const syncForThis = likeSync !== null && likeSync.designId === designId ? likeSync : null;
  const detailCounts = useMemo(
    () =>
      detailStats !== null
        ? syncForThis !== null
          ? { ...detailStats.counts, likes: syncForThis.likes }
          : detailStats.counts
        : null,
    [detailStats, syncForThis]
  );
  const counts = liveCard?.counts ?? detailCounts ?? card?.counts ?? null;
  const likedByMe =
    liveCard !== null
      ? liveCard.likedByMe === true
      : syncForThis !== null
        ? syncForThis.likedByMe
        : detailStats?.likedByMe === true;
  const toggleLike = useLikeToggle();
  const sessionStatus = useSessionStore((s) => s.status);

  const patchDetailStats = useCallback((patch: CardLikePatch) => {
    setDetailStats((current) =>
      current === null
        ? current
        : {
            counts:
              patch.likes !== undefined
                ? { ...current.counts, likes: patch.likes }
                : current.counts,
            likedByMe: patch.likedByMe ?? current.likedByMe,
          }
    );
  }, []);

  const handleToggleLike = useCallback(() => {
    const target: LikeToggleTarget | null =
      liveCard ??
      (detailCounts !== null ? { id: designId, likedByMe, counts: detailCounts } : null);
    if (target === null) return;
    // The toggle starts from the synced state (folded into `target` above),
    // so the sync record is spent; the optimistic patch below lands on
    // detailStats and takes over as the source of truth.
    useCommunityDetailStore.getState().clearLikeSync();
    void toggleLike(target, patchDetailStats).then((outcome) => {
      if (outcome === 'signin-required') setSignInIntent('like');
    });
  }, [designId, detailCounts, likedByMe, liveCard, patchDetailStats, toggleLike]);

  const handleReportEntry = useCallback(() => {
    if (sessionStatus !== 'authenticated') {
      trackEvent('community_signin_prompt_shown', { intent: 'report' });
      setSignInIntent('report');
      return;
    }
    setReportOpen(true);
  }, [sessionStatus]);

  const handleOverflowOpen = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // Anchor to the button's upper-left; Menu.Root clamps to the viewport.
    setOverflowMenu({ open: true, position: { x: rect.left, y: rect.top - 8 } });
  }, []);

  // A bumped reconnectAttempt re-runs the load directly (the error copy stays
  // up until the retry resolves); only the manual Retry button flips the
  // phase back to loading.
  const reconnectAttempt = useRetryOnReconnect(phase === 'error');

  // One viewed event per dialog instance: the load effect re-runs on every
  // manual retry and reconnect, which would otherwise inflate the metric.
  const hasTrackedViewRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchCommunityDesign(designId).then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setDesign(result.value.design);
        setDetailStats(
          result.value.counts !== null
            ? { counts: result.value.counts, likedByMe: result.value.likedByMe }
            : null
        );
        setIsOwner(result.value.isOwner);
        setOwnerModeration(
          result.value.isOwner && result.value.design.status === 'hidden'
            ? {
                hiddenReason: result.value.hiddenReason,
                hiddenReasonCategory: result.value.hiddenReasonCategory,
              }
            : null
        );
        setPhase('ready');
        if (!hasTrackedViewRef.current) {
          hasTrackedViewRef.current = true;
          trackEvent('community_detail_viewed', { surface });
          recordRecentlyViewed(designId);
        }
      } else if (result.error.kind === 'notFound') {
        setPhase('gone');
      } else {
        setOffline(
          result.error.kind === 'network' && typeof navigator !== 'undefined' && !navigator.onLine
        );
        setPhase('error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [designId, attempt, reconnectAttempt, surface]);

  const retry = useCallback(() => {
    setPhase('loading');
    setAttempt((n) => n + 1);
  }, []);

  const parentId = phase === 'ready' ? (design?.lineage?.parentId ?? null) : null;
  useEffect(() => {
    if (parentId === null) return;
    let cancelled = false;
    void fetchCommunityDesign(parentId).then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setParentResolution({
          kind: 'live',
          name: result.value.design.name,
          authorName: result.value.design.authorName,
        });
      } else if (result.error.kind === 'notFound') {
        setParentResolution({ kind: 'gone' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  const switchToDesignerAndClose = useCallback(() => {
    // Pop the trapped history entry before switch-to-designer pushes
    // /designer, otherwise the trap entry is stranded under the new route.
    consumeTrap(() => {
      window.dispatchEvent(new Event('switch-to-designer'));
      close();
      onRequestCloseGallery();
    });
  }, [close, consumeTrap, onRequestCloseGallery]);

  const runDuplicate = useCallback(
    async (target: CommunityDesign, action: Exclude<BusyAction, null>) => {
      setBusy(action);
      try {
        const created = await onRemixDesign(target, { ownDuplicate: action === 'duplicate' });
        if (!created) {
          addToast(t('community.detail.remixFailed'), 'error');
          return;
        }
        if (action === 'remix') {
          trackEvent('community_remix_opened');
          addToast(t('community.detail.remixCreated'), 'success');
        } else {
          addToast(t('community.detail.duplicateCreated'), 'success');
        }
        switchToDesignerAndClose();
      } finally {
        setBusy(null);
      }
    },
    [addToast, onRemixDesign, switchToDesignerAndClose, t]
  );

  const handleRemix = useCallback(() => {
    if (design === null || busy !== null) return;
    void runDuplicate(design, 'remix');
  }, [busy, design, runDuplicate]);

  const handleDuplicate = useCallback(() => {
    if (design === null || busy !== null) return;
    void runDuplicate(design, 'duplicate');
  }, [busy, design, runDuplicate]);

  const handleEditOriginal = useCallback(async () => {
    if (design === null || busy !== null) return;
    setBusy('edit');
    try {
      const outcome = await onEditOriginal(design);
      if (outcome === 'opened') {
        switchToDesignerAndClose();
        return;
      }
      if (outcome === 'missing') {
        // The lost-local-design trap: no local copy carries this publishedId,
        // so fall back to a fresh copy instead of a dead end.
        addToast(t('community.detail.editOriginalMissing'), 'info');
        setBusy(null);
        await runDuplicate(design, 'duplicate');
        return;
      }
      addToast(t('community.detail.editOriginalFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }, [addToast, busy, design, onEditOriginal, runDuplicate, switchToDesignerAndClose, t]);

  // Fits-gap context: active only while the layout editor's handoff is live
  // AND the host wired the placement bridge (the /community route does not).
  const gapConstraintActive = useGapFitStore((s) => s.constraint !== null);
  const placeAvailable = gapConstraintActive && onPlaceInLayout !== undefined;

  const handlePlaceInLayout = useCallback(async () => {
    if (design === null || busy !== null || onPlaceInLayout === undefined) return;
    setBusy('place');
    try {
      const outcome = await onPlaceInLayout(design);
      if (outcome === 'placed') {
        trackEvent('community_place_in_layout');
        addToast(t('community.detail.placedInLayout'), 'success');
        // Stay on the layout canvas with the placed bin selected: close both
        // the detail and the whole gallery, but never switch-to-designer.
        close();
        onRequestCloseGallery();
        return;
      }
      if (outcome === 'no-fit') {
        // Gallery and detail stay open so the user can pick another design.
        addToast(t('community.detail.placeNoFit'), 'error');
        return;
      }
      if (outcome === 'error-copy-saved') {
        // The remix copy was already saved before placement failed; the
        // message must own that side effect.
        addToast(t('community.detail.placeFailedCopySaved'), 'error');
        return;
      }
      addToast(t('community.detail.placeFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }, [addToast, busy, close, design, onPlaceInLayout, onRequestCloseGallery, t]);

  // The caller's own print decides whether the CTA posts or edits. The list
  // response carries it even when it is not on the first page, so this is one
  // request rather than a walk.
  useEffect(() => {
    if (phase !== 'ready' || design === null) return;
    const { id } = design;
    let cancelled = false;
    void fetchPrints(id).then((result) => {
      if (cancelled) return;
      // A disabled kill switch or any other failure just leaves the CTA in its
      // "post" state; the server is still the authority on what happens next.
      setOwnPrint({ designId: id, print: isOk(result) ? result.value.mine : null });
    });
    return () => {
      cancelled = true;
    };
  }, [phase, design]);

  const myPrint = design !== null && ownPrint?.designId === design.id ? ownPrint.print : null;

  const printDialogOpen = usePrintDialogStore((s) => s.phase !== 'closed');

  const handleAddPrint = useCallback(() => {
    if (design === null) return;
    usePrintDialogStore.getState().open({
      designId: design.id,
      designName: design.name,
      signedIn: sessionStatus === 'authenticated',
      existing: myPrint,
    });
  }, [design, myPrint, sessionStatus]);

  const handleFilterByAuthor = useCallback(() => {
    if (design === null) return;
    useBrowseStore.getState().setAuthor({ id: design.authorPublicId, name: design.authorName });
    trackEvent('community_author_filter_applied', { surface: 'detail' });
    // Closing reveals the gallery beneath (tab) or returns the route to
    // /community, where the author sync appends ?author= for sharing.
    close();
  }, [close, design]);

  const handleShare = useCallback(async () => {
    const url = publicDesignUrl(designId);
    try {
      await navigator.clipboard.writeText(url);
      addToast(t('community.detail.shareCopied'), 'success');
    } catch {
      addToast(t('community.detail.shareFailed'), 'error');
    }
  }, [addToast, designId, t]);

  const title = design?.name ?? card?.name ?? t('community.detail.title');

  // Shared between the owner and non-owner footers: in the fits-gap flow
  // placing at the selected gap is the primary intent for both.
  const placeButton = (
    <Button
      variant="primary"
      touchTarget={isMobile}
      loading={busy === 'place'}
      disabled={busy !== null && busy !== 'place'}
      onClick={() => void handlePlaceInLayout()}
      data-testid="community-place-in-layout"
    >
      {t('community.detail.placeInLayout')}
    </Button>
  );

  return (
    <Dialog.Root
      open
      onClose={close}
      size="4xl"
      height="fixed"
      fullScreen="mobile"
      closeOnOverlayClick
    >
      <Dialog.Header title={title} bordered closeAriaLabel={t('common.close')} />
      <Dialog.Body padding="none" scroll={false}>
        {phase === 'loading' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            {card !== null && card.thumbnailUrl !== '' && (
              <img
                src={card.thumbnailUrl}
                alt={card.name}
                className="max-h-48 rounded-lg object-contain"
              />
            )}
            <Spinner size="md" />
            <p className="text-sm text-content-secondary">{t('community.detail.loading')}</p>
          </div>
        )}

        {phase === 'gone' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
            <p className="text-base font-medium text-content">{t('community.detail.goneTitle')}</p>
            <p className="text-sm text-content-secondary">{t('community.detail.goneBody')}</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            {offline ? (
              <>
                <p className="text-base font-medium text-content">
                  {t('community.gallery.offline.title')}
                </p>
                <p className="text-sm text-content-secondary">
                  {t('community.gallery.offline.subtitle')}
                </p>
              </>
            ) : (
              <p className="text-sm text-content-secondary">{t('community.detail.loadFailed')}</p>
            )}
            <Button variant="secondary" onClick={retry}>
              {t('community.detail.retry')}
            </Button>
          </div>
        )}

        {phase === 'ready' && design !== null && (
          <CommunityDetailContent
            design={design}
            counts={counts}
            isMobile={isMobile}
            parentResolution={parentResolution}
            like={
              liveCard !== null || detailStats !== null
                ? { likedByMe, onToggle: handleToggleLike }
                : null
            }
            onFilterByAuthor={handleFilterByAuthor}
            ownerModeration={ownerModeration}
            onAddPrint={handleAddPrint}
            hasOwnPrint={myPrint !== null}
          />
        )}
      </Dialog.Body>

      {phase === 'ready' && design !== null && (
        <Dialog.Footer
          bordered
          className="max-md:flex-col-reverse max-md:items-stretch max-md:gap-2"
          leading={
            isOwner ? undefined : (
              <p className="text-xs text-content-tertiary max-md:hidden">
                {t('community.detail.remixHint')}
              </p>
            )
          }
        >
          <Button variant="ghost" touchTarget={isMobile} onClick={() => void handleShare()}>
            {t('community.detail.share')}
          </Button>
          {/* Mobile keeps secondary actions (Report, or the owner's
              Duplicate as new) in the overflow menu; desktop shows them inline. */}
          {isMobile ? (
            <IconButton
              aria-label={t('community.detail.moreActions')}
              aria-haspopup="menu"
              aria-expanded={overflowMenu.open}
              onClick={handleOverflowOpen}
              data-testid="community-detail-overflow"
            >
              <MoreHorizontalIcon />
            </IconButton>
          ) : (
            !isOwner && (
              <Button variant="ghost" onClick={handleReportEntry}>
                {t('community.detail.report')}
              </Button>
            )
          )}
          {isOwner ? (
            <>
              {!isMobile && (
                <Button
                  variant="secondary"
                  loading={busy === 'duplicate'}
                  disabled={busy !== null && busy !== 'duplicate'}
                  onClick={handleDuplicate}
                >
                  {t('community.detail.duplicateAsNew')}
                </Button>
              )}
              <Button
                // In the fits-gap flow placing at the selected gap is the
                // primary intent even for the design's owner.
                variant={placeAvailable ? 'secondary' : 'primary'}
                touchTarget={isMobile}
                loading={busy === 'edit'}
                // Hidden designs reject updates server-side (PUT 403s while
                // non-live); disabling up front spares the owner a publish
                // flow guaranteed to fail at submit.
                disabled={(busy !== null && busy !== 'edit') || design.status !== 'live'}
                title={
                  design.status !== 'live' ? t('community.detail.editDisabledHidden') : undefined
                }
                onClick={() => void handleEditOriginal()}
              >
                {t('community.detail.editOriginal')}
              </Button>
              {placeAvailable && placeButton}
            </>
          ) : placeAvailable ? (
            <>
              {/* Fits-gap context: placing at the selected gap is primary;
                  the remix path stays available as "Open in designer". */}
              <Button
                variant="secondary"
                touchTarget={isMobile}
                loading={busy === 'remix'}
                disabled={busy !== null && busy !== 'remix'}
                onClick={handleRemix}
              >
                {t('community.detail.openInDesigner')}
              </Button>
              {placeButton}
            </>
          ) : (
            <>
              <Button
                variant="primary"
                touchTarget={isMobile}
                loading={busy === 'remix'}
                disabled={busy !== null && busy !== 'remix'}
                onClick={handleRemix}
              >
                {t('community.detail.remix')}
              </Button>
              {/* Last child + max-md:flex-col-reverse = the hint lands above
                  the mobile action stack; desktop shows it via `leading`. */}
              <p className="text-center text-xs text-content-tertiary md:hidden">
                {t('community.detail.remixHint')}
              </p>
            </>
          )}
        </Dialog.Footer>
      )}

      <Menu.Root
        open={overflowMenu.open}
        onClose={() => setOverflowMenu((state) => ({ ...state, open: false }))}
        position={overflowMenu.position}
      >
        {isOwner ? (
          <Menu.Item
            onClick={() => {
              setOverflowMenu((state) => ({ ...state, open: false }));
              handleDuplicate();
            }}
          >
            {t('community.detail.duplicateAsNew')}
          </Menu.Item>
        ) : (
          <Menu.Item
            onClick={() => {
              setOverflowMenu((state) => ({ ...state, open: false }));
              handleReportEntry();
            }}
          >
            {t('community.detail.report')}
          </Menu.Item>
        )}
      </Menu.Root>

      {reportOpen && (
        <ReportDialog
          designId={designId}
          onClose={() => setReportOpen(false)}
          onNeedsAuth={() => {
            setReportOpen(false);
            trackEvent('community_signin_prompt_shown', { intent: 'report' });
            setSignInIntent('report');
          }}
        />
      )}

      <CommunitySignInPrompt
        open={signInIntent !== null}
        message={
          signInIntent === 'report'
            ? t('community.signin.reportMessage')
            : t('community.signin.likeMessage')
        }
        onClose={() => setSignInIntent(null)}
        onBeforeSignIn={
          signInIntent === 'like'
            ? () =>
                savePendingLikeAction({
                  designId,
                  liked: !likedByMe,
                })
            : undefined
        }
      />

      {/* CommunityDetail is already its own chunk, so the dialog is off the
          eager path without a further split; an extra chunk boundary here only
          adds overhead to the total-JS budget. */}
      {printDialogOpen && (
        <PrintDialog
          onSaved={(print) => setOwnPrint({ designId: print.designId, print })}
          onDeleted={() =>
            setOwnPrint(design === null ? null : { designId: design.id, print: null })
          }
        />
      )}
    </Dialog.Root>
  );
}
