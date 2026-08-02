/**
 * Community design detail overlay. Mounted by the shell (DesignGalleryModal)
 * only while a request is open in the core communityDetail store; the
 * designer-facing actions arrive as props from the shell composition so this
 * feature never imports the bin designer (see shared/types/communityDetail).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import type { CommunityDetailRequest } from '@/core/store/communityDetail';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityDesign } from '@/shared/types/community';
import type { CommunityDetailProps } from '@/shared/types/communityDetail';
import { fetchCommunityDesign } from '../../api/client';
import { CommunityDetailContent } from './CommunityDetailContent';
import type { ParentResolution } from './CommunityDetailContent';
import { useDetailHistoryTrap } from './useDetailHistoryTrap';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useRetryOnReconnect } from '@/shared/hooks/useRetryOnReconnect';

type DetailPhase = 'loading' | 'ready' | 'gone' | 'error';

type BusyAction = 'remix' | 'edit' | 'duplicate' | null;

function publicDesignUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/community/d/${id}`;
}

export function CommunityDetail(props: CommunityDetailProps) {
  const request = useCommunityDetailStore((s) => s.request);
  if (request === null) return null;
  return <CommunityDetailDialog key={request.designId} request={request} {...props} />;
}

interface CommunityDetailDialogProps extends CommunityDetailProps {
  request: CommunityDetailRequest;
}

function CommunityDetailDialog({
  request,
  onRequestCloseGallery,
  onRemixDesign,
  onEditOriginal,
  surface = 'tab',
}: CommunityDetailDialogProps) {
  const t = useTranslation();
  const { isMobile } = useResponsive();
  const addToast = useToastStore((s) => s.addToast);

  const [phase, setPhase] = useState<DetailPhase>('loading');
  const [design, setDesign] = useState<CommunityDesign | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [parentResolution, setParentResolution] = useState<ParentResolution>({
    kind: 'snapshot',
  });

  const close = useCallback(() => {
    useCommunityDetailStore.getState().close();
  }, []);

  // On the route surface the host owns history: /community/d/<id> is a real
  // entry, so the URL-less trap entry must not stack on top of it.
  const consumeTrap = useDetailHistoryTrap(close, surface !== 'route');

  const { designId, card } = request;

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
        setIsOwner(result.value.isOwner);
        setPhase('ready');
        if (!hasTrackedViewRef.current) {
          hasTrackedViewRef.current = true;
          trackEvent('community_detail_viewed', { surface });
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
            counts={card?.counts ?? null}
            isMobile={isMobile}
            parentResolution={parentResolution}
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
          {isOwner ? (
            <>
              <Button
                variant="secondary"
                touchTarget={isMobile}
                loading={busy === 'duplicate'}
                disabled={busy !== null && busy !== 'duplicate'}
                onClick={handleDuplicate}
              >
                {t('community.detail.duplicateAsNew')}
              </Button>
              <Button
                variant="primary"
                touchTarget={isMobile}
                loading={busy === 'edit'}
                disabled={busy !== null && busy !== 'edit'}
                onClick={() => void handleEditOriginal()}
              >
                {t('community.detail.editOriginal')}
              </Button>
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
    </Dialog.Root>
  );
}
