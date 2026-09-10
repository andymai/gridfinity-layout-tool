/** Record loading, print and moderation state, and every action handler behind the community detail dialog; the component keeps the markup. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import type { CommunityDetailRequest } from '@/core/store/communityDetail';
import { useGapFitStore } from '@/core/store/gapFit';
import { useToastStore } from '@/core/store/toast';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityDesign, CommunityDesignCounts } from '@/shared/types/community';
import type { CommunityPrint, CommunityPrintSummary } from '@/shared/types/communityPrint';
import type { CommunityDetailProps } from '@/shared/types/communityDetail';
import { fetchCommunityDesign } from '../../api/client';
import { buildDesignImages, findPhotoIndex } from '../../utils/designMedia';
import { useLikeToggle } from '../../hooks/useLikeToggle';
import type { LikeToggleTarget } from '../../hooks/useLikeToggle';
import { useBrowseStore } from '../../store/browseStore';
import type { CardLikePatch } from '../../store/browseStore';
import { recordRecentlyViewed } from '../../utils/recentlyViewed';
import { fetchPrints } from '../../api/printsClient';
import { usePrintDialogStore } from '../../store/printDialogStore';
import type { OwnerModeration, ParentResolution } from './CommunityDetailContent';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';

export type DetailPhase = 'loading' | 'ready' | 'gone' | 'error';

/** Stable empty reference so the media memo does not churn every render. */
export const EMPTY_PRINTS: readonly CommunityPrint[] = [];

export type BusyAction = 'remix' | 'edit' | 'duplicate' | 'place' | null;

/** Detail-payload stats fallback for designs the capped browse index lacks. */
export interface DetailStats {
  counts: CommunityDesignCounts;
  likedByMe: boolean;
}

export function publicDesignUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/community/d/${id}`;
}

export interface CommunityDetailDialogProps extends CommunityDetailProps {
  request: CommunityDetailRequest;
  close: () => void;
  consumeTrap: (onConsumed: () => void) => void;
}

export function useCommunityDetailDialog({
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
  const [authorIsSupporter, setAuthorIsSupporter] = useState(false);
  // Stamped with the design it belongs to rather than cleared on switch: the
  // overlay can go ready for design B while this still holds A's answer, and a
  // stamped value is stale-proof without a synchronous reset in an effect.
  const [ownPrint, setOwnPrint] = useState<{
    designId: string;
    print: CommunityPrint | null;
    summary: CommunityPrintSummary | null;
  } | null>(null);
  const [printsAvailable, setPrintsAvailable] = useState(true);
  // The gap the viewer picked in the layout editor, if any. Read here rather
  // than passed down so the detail answers the same question the gallery
  // filtered on.
  const gapContext = useBrowseStore((s) => s.fitsGapContext);
  // Bumped after a write so the list refetches; the parent owns it because the
  // CTA and the list must agree on whether the viewer has a print.
  const [printsRefresh, setPrintsRefresh] = useState(0);
  const [reportPrintTarget, setReportPrintTarget] = useState<CommunityPrint | null>(null);
  // Stamped with its design as a guard, not as the mechanism: the dialog is
  // keyed by designId, so switching designs remounts it. The stamp is what
  // stops an in-flight response for the previous design from being read as
  // this one's if that key ever goes away.
  const [printItems, setPrintItems] = useState<{
    designId: string;
    items: readonly CommunityPrint[];
  } | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
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
        setAuthorIsSupporter(result.value.authorIsSupporter);
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
  // Keyed off the id, not the design object: a counts refresh replaces the
  // object without changing which design this is, and depending on the object
  // would re-fetch prints every time.
  const printsDesignId = design?.id ?? null;
  useEffect(() => {
    if (phase !== 'ready' || printsDesignId === null) return;
    let cancelled = false;
    void fetchPrints(printsDesignId).then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setOwnPrint({
          designId: printsDesignId,
          print: result.value.mine,
          summary: result.value.summary,
        });
        setPrintItems({ designId: printsDesignId, items: result.value.items });
        return;
      }
      // The kill switch is the one failure worth acting on: a CTA that opens a
      // dialog which can only fail is worse than no CTA. Any other error just
      // leaves the button in its "post" state.
      setPrintsAvailable(result.error.kind !== 'disabled');
      setOwnPrint({ designId: printsDesignId, print: null, summary: null });
    });
    return () => {
      cancelled = true;
    };
    // printsRefresh is a dependency, not just PrintsSection's: the cost panel
    // reads its summary from here, so without it a save could leave the panel
    // showing "estimated" after the report that should have flipped it.
  }, [phase, printsDesignId, printsRefresh]);

  const stampedPrints = design !== null && ownPrint?.designId === design.id ? ownPrint : null;
  const myPrint = stampedPrints?.print ?? null;
  const printSummary = stampedPrints?.summary ?? null;

  const mediaPrints =
    design !== null && printItems?.designId === design.id ? printItems.items : EMPTY_PRINTS;
  const images = useMemo(
    () => buildDesignImages(design?.thumbnails ?? [], mediaPrints),
    [design?.thumbnails, mediaPrints]
  );

  const handlePrintItemsChange = useCallback(
    (items: readonly CommunityPrint[]) => {
      if (design === null) return;
      setPrintItems({ designId: design.id, items });
    },
    [design]
  );

  const handleOpenPhoto = useCallback(
    (printId: string, photoIndex: number) => {
      const index = findPhotoIndex(images, mediaPrints, printId, photoIndex);
      if (index >= 0) setLightboxIndex(index);
    },
    [images, mediaPrints]
  );

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const printDialogOpen = usePrintDialogStore((s) => s.phase !== 'closed');

  // Opening by bare id rather than a card: an ancestor may sit outside the
  // loaded index, and the detail view already handles a cold id fetch.
  const handleOpenAncestor = useCallback((ancestorId: string) => {
    useCommunityDetailStore.getState().open(ancestorId);
  }, []);

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

  return {
    t,
    isMobile,
    phase,
    design,
    detailStats,
    isOwner,
    authorIsSupporter,
    setOwnPrint,
    printsAvailable,
    gapContext,
    printsRefresh,
    setPrintsRefresh,
    reportPrintTarget,
    setReportPrintTarget,
    lightboxIndex,
    setLightboxIndex,
    ownerModeration,
    offline,
    busy,
    parentResolution,
    reportOpen,
    setReportOpen,
    signInIntent,
    setSignInIntent,
    overflowMenu,
    setOverflowMenu,
    designId,
    card,
    liveCard,
    counts,
    likedByMe,
    handleToggleLike,
    handleReportEntry,
    handleOverflowOpen,
    retry,
    handleRemix,
    handleDuplicate,
    handleEditOriginal,
    placeAvailable,
    handlePlaceInLayout,
    myPrint,
    printSummary,
    images,
    handlePrintItemsChange,
    handleOpenPhoto,
    closeLightbox,
    printDialogOpen,
    handleOpenAncestor,
    handleAddPrint,
    handleFilterByAuthor,
    handleShare,
  };
}
