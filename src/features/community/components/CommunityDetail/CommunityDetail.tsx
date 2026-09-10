/**
 * Community design detail overlay. Mounted by the shell (DesignGalleryModal)
 * only while a request is open in the core communityDetail store; the
 * designer-facing actions arrive as props from the shell composition so this
 * feature never imports the bin designer (see shared/types/communityDetail).
 */

import { useCallback } from 'react';
import { Button, Dialog, IconButton, Menu, Spinner } from '@/design-system';
import { MoreHorizontalIcon } from '@/design-system/Icon';
import { useCommunityDetailStore } from '@/core/store/communityDetail';
import type { CommunityDetailRequest } from '@/core/store/communityDetail';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityDetailProps } from '@/shared/types/communityDetail';
import { savePendingLikeAction } from '@/shared/utils/communityPendingLikeAction';
import { ReportDialog } from '../ReportDialog';
import { CommunitySignInPrompt } from '../SignInPrompt';
import { reportPrint } from '../../api/printsClient';
import { PrintDialog } from '../PrintDialog';
import { PrintCostPanel } from '../PrintCostPanel';
import { PrintsSection } from '../PrintsSection';
import { MediaLightbox } from '../MediaLightbox';
import { CommunityDetailContent } from './CommunityDetailContent';
import { useDetailHistoryTrap } from './useDetailHistoryTrap';
import { useCommunityDetailDialog } from './useCommunityDetailDialog';
import type { CommunityDetailDialogProps } from './useCommunityDetailDialog';

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

function CommunityDetailDialog(props: CommunityDetailDialogProps) {
  const { close } = props;
  const {
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
  } = useCommunityDetailDialog(props);

  const title = design?.name ?? card?.name ?? t('community.detail.title');

  /**
   * The buttons that act on the design itself. They live in the rail under the
   * author rather than in the dialog footer, so the decision button sits with
   * the thing it acts on instead of below a rail you have to scroll past.
   *
   * Share, report and the owner's Duplicate as new stay in the footer: those
   * act on the record, not on what you are deciding to print.
   */
  const primaryActions =
    design === null ? undefined : (
      <>
        {placeAvailable && (
          <Button
            // Fits-gap context: placing at the selected gap is the primary
            // intent, for the owner as much as for anyone else.
            variant="primary"
            touchTarget={isMobile}
            loading={busy === 'place'}
            disabled={busy !== null && busy !== 'place'}
            onClick={() => void handlePlaceInLayout()}
            className="w-full justify-center"
            data-testid="community-place-in-layout"
          >
            {t('community.detail.placeInLayout')}
          </Button>
        )}
        {isOwner ? (
          <Button
            variant={placeAvailable ? 'secondary' : 'primary'}
            touchTarget={isMobile}
            loading={busy === 'edit'}
            // Hidden designs reject updates server-side (PUT 403s while
            // non-live); disabling up front spares the owner a publish flow
            // guaranteed to fail at submit.
            disabled={(busy !== null && busy !== 'edit') || design.status !== 'live'}
            title={design.status !== 'live' ? t('community.detail.editDisabledHidden') : undefined}
            onClick={() => void handleEditOriginal()}
            className="w-full justify-center"
          >
            {t('community.detail.editOriginal')}
          </Button>
        ) : (
          <Button
            variant={placeAvailable ? 'secondary' : 'primary'}
            touchTarget={isMobile}
            loading={busy === 'remix'}
            disabled={busy !== null && busy !== 'remix'}
            onClick={handleRemix}
            className="w-full justify-center"
          >
            {t(placeAvailable ? 'community.detail.openInDesigner' : 'community.detail.remix')}
          </Button>
        )}
        {!isOwner && (
          <p className="text-xs text-content-tertiary">{t('community.detail.remixHint')}</p>
        )}
      </>
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
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
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
            images={images}
            onOpenLightbox={setLightboxIndex}
            primaryActions={primaryActions}
            like={
              liveCard !== null || detailStats !== null
                ? { likedByMe, onToggle: handleToggleLike }
                : null
            }
            onFilterByAuthor={handleFilterByAuthor}
            authorIsSupporter={authorIsSupporter}
            ownerModeration={ownerModeration}
            onOpenDesign={handleOpenAncestor}
            costSlot={
              <PrintCostPanel
                params={design.params}
                metrics={design.metrics}
                summary={printSummary}
                gapContext={gapContext}
              />
            }
            printsSlot={
              printsAvailable ? (
                <PrintsSection
                  designId={design.id}
                  ownPrint={myPrint}
                  refreshToken={printsRefresh}
                  onReport={setReportPrintTarget}
                  isOwner={isOwner}
                  coverPhotoUrl={design.coverPhotoUrl ?? ''}
                  onOpenPhoto={handleOpenPhoto}
                  onItemsChange={handlePrintItemsChange}
                  onAddPrint={handleAddPrint}
                  isMobile={isMobile}
                />
              ) : undefined
            }
          />
        )}
      </Dialog.Body>

      {phase === 'ready' && design !== null && (
        <Dialog.Footer
          bordered
          className="max-md:flex-col-reverse max-md:items-stretch max-md:gap-2"
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
          ) : isOwner ? (
            <Button
              variant="secondary"
              loading={busy === 'duplicate'}
              disabled={busy !== null && busy !== 'duplicate'}
              onClick={handleDuplicate}
            >
              {t('community.detail.duplicateAsNew')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleReportEntry}>
              {t('community.detail.report')}
            </Button>
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
      {reportPrintTarget !== null && (
        <ReportDialog
          designId={designId}
          title={t('community.prints.report')}
          // Same reason union, note field and error handling as a design
          // report; only the target differs.
          submit={(reason, note) =>
            reportPrint(designId, reportPrintTarget.authorPublicId, reason, note)
          }
          onClose={() => {
            setReportPrintTarget(null);
            setPrintsRefresh((n) => n + 1);
          }}
          onNeedsAuth={() => {
            setReportPrintTarget(null);
            trackEvent('community_signin_prompt_shown', { intent: 'report' });
            setSignInIntent('report');
          }}
        />
      )}

      {lightboxIndex !== null && design !== null && (
        <MediaLightbox
          // A guard, not a fix: closing already unmounts this, so startIndex is
          // read fresh on every open today. The key is what keeps that true if
          // an opener ever becomes reachable without closing first, since the
          // viewer only reads startIndex on mount.
          key={lightboxIndex}
          images={images}
          startIndex={lightboxIndex}
          designName={design.name}
          onClose={closeLightbox}
        />
      )}

      {printDialogOpen && (
        <PrintDialog
          onSaved={(print) => {
            setOwnPrint((current) => ({
              designId: print.designId,
              print,
              summary: current?.designId === print.designId ? current.summary : null,
            }));
            setPrintsRefresh((n) => n + 1);
          }}
          onDeleted={() => {
            setOwnPrint(
              design === null ? null : { designId: design.id, print: null, summary: null }
            );
            setPrintsRefresh((n) => n + 1);
          }}
        />
      )}
    </Dialog.Root>
  );
}
