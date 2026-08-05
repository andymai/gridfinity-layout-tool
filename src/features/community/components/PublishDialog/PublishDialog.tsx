/**
 * Community publish dialog, mounted at app level (App.tsx) behind the
 * community_showcase flag and driven by the core communityPublish store.
 * Composition contract: the opener (bin designer) supplies design context,
 * captures, and handlers; this dialog never imports another feature.
 *
 * One review screen rather than a phase gauntlet. Sign-in is deferred to the
 * publish attempt (the pending-action stash already survives the OAuth
 * redirect), identity is a line on the form, and a failed publish returns to
 * the form with the failure attached rather than replacing it.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  CopyField,
  Dialog,
  Field,
  IconButton,
  Menu,
  Spinner,
} from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk, ok } from '@/core/result';
import type { Result } from '@/core/result';
import { useCommunityPublishStore } from '@/core/store/communityPublish';
import { useToastStore } from '@/core/store/toast';
import { signInUrl } from '@/core/sync/session/sessionApi';
import type { AuthProvider } from '@/core/sync/session/sessionApi';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import { ICON_PATHS } from '@/shared/constants/iconPaths';
import { hashBinParams } from '@/shared/utils/binParamsHash';
import { savePendingPublishAction } from '@/shared/utils/communityPendingAction';
import {
  fetchCommunityCapabilities,
  fetchOwnDesign,
  publishDesign,
  unpublishDesign,
  updateDesign,
} from '../../api/client';
import { useBrowseStore } from '../../store/browseStore';
import { useMineStore } from '../../store/mineStore';
import type {
  CommunityClientError,
  CommunityPublishInput,
  CommunityPublishResult,
} from '../../api/client';
import { usePublishDialogStore } from '../../store/publishStore';
import type { PublishPrefill } from '../../store/publishStore';
import { claimMilestone } from '../../utils/communityMilestones';
import { PublishForm } from './PublishForm';
import { useOwnDesignPrefill } from './useOwnDesignPrefill';
import type { PublishFormFields, PublishSignInDraft } from './PublishForm';
import { presentPublishError } from './publishErrors';

function goTo(url: string): void {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
}

// The dialog is non-dismissable while publishing, so a hung connection must
// resolve into the network-error state instead of trapping the user.
const PUBLISH_TIMEOUT_MS = 60_000;

/** Matches useCommunityDigestCheck: a milestone gets more read time than a routine toast. */
const MILESTONE_TOAST_DURATION_MS = 8000;

/** Screen-reader announcement per phase; the dialog stays mounted across phases. */
const PHASE_ANNOUNCE_KEYS: Partial<Record<string, string>> = {
  loading: 'community.publish.announce.loading',
  unavailable: 'community.publish.announce.unavailable',
  form: 'community.publish.announce.form',
  publishing: 'community.publish.announce.publishing',
  success: 'community.publish.announce.success',
};

function publicDesignUrl(id: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/community/d/${id}`;
}

export function PublishDialog() {
  const t = useTranslation();
  const context = useCommunityPublishStore((s) => s.context);
  const captures = useCommunityPublishStore((s) => s.captures);
  const captureFailed = useCommunityPublishStore((s) => s.captureFailed);
  const sessionStatus = useSessionStore((s) => s.status);
  const sessionUser = useSessionStore((s) => s.user);
  const phase = usePublishDialogStore((s) => s.phase);
  const mode = usePublishDialogStore((s) => s.mode);
  const capabilities = usePublishDialogStore((s) => s.capabilities);
  const storedDisplayName = usePublishDialogStore((s) => s.displayName);
  const error = usePublishDialogStore((s) => s.error);
  const success = usePublishDialogStore((s) => s.success);

  const [lastFields, setLastFields] = useState<PublishFormFields | null>(null);
  const openedForRef = useRef<string | null>(null);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [parentParamsHash, setParentParamsHash] = useState<string | null>(null);
  /** Null until the user touches the field, so the suggestion stays live. */
  const [editedPublicName, setEditedPublicName] = useState<string | null>(null);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLButtonElement>(null);
  const [ownerMenu, setOwnerMenu] = useState<{
    open: boolean;
    position: { x: number; y: number };
  }>({ open: false, position: { x: 0, y: 0 } });
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!context) return;
    if (openedForRef.current === context.designId) return;
    openedForRef.current = context.designId;
    usePublishDialogStore.getState().open({
      mode: context.publishedId !== null ? 'update' : 'create',
    });
  }, [context]);

  // Ask the server what it will actually accept before showing a form. The
  // publish kill switch is a deployment env var with no client-side shadow, so
  // without this the only way to discover publishing is off is to POST a
  // finished design and read the 503.
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;
    void fetchCommunityCapabilities().then((result) => {
      if (cancelled) return;
      const store = usePublishDialogStore.getState();
      if (isOk(result)) store.ready(result.value);
      else store.failProbe(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Derived, not seeded through an effect, so a session that resolves after
  // mount still supplies the suggestion. A GitHub handle is only ever a
  // suggestion for someone who has not chosen a name; a profile display name
  // never is, since it is usually a real name.
  const suggestedName =
    storedDisplayName !== ''
      ? storedDisplayName
      : sessionUser?.provider === 'github'
        ? (sessionUser.handle ?? '')
        : '';
  const publicName = editedPublicName ?? suggestedName;

  // Sign-in is no longer a phase, so the prompt is "the form was shown to
  // someone who will have to authenticate to finish".
  useEffect(() => {
    if (phase !== 'form' || sessionStatus === 'authenticated') return;
    trackEvent('community_signin_prompt_shown', { intent: 'publish' });
  }, [phase, sessionStatus]);

  // The Dialog focus trap places initial focus once at mount, but this dialog
  // stays open while `phase` swaps its whole body (loading -> form ->
  // publishing -> success). Move focus into each new phase so keyboard and
  // screen-reader users land on the fresh content instead of a detached
  // <body>. The aria-live region below announces the transition.
  useEffect(() => {
    if (phase === 'closed') return;
    const raf = requestAnimationFrame(() => {
      const dialogEl = document.querySelector('[role="dialog"]');
      const focusable = dialogEl?.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const publishedId = context?.publishedId ?? null;
  const ownDesign = useOwnDesignPrefill(publishedId, sessionStatus);

  const parentId = context?.lineage?.parentId ?? null;
  useEffect(() => {
    if (parentId === null) return;
    let cancelled = false;
    void fetchOwnDesign(parentId).then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setParentParamsHash(hashBinParams(result.value.params));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [parentId]);

  if (!context) return null;
  if (phase === 'closed') return null;

  const handleClose = () => {
    usePublishDialogStore.getState().reset();
    useCommunityPublishStore.getState().close();
  };

  const stashAndSignIn = (provider: AuthProvider, draft: PublishSignInDraft) => {
    // The public name lives in localStorage, which survives the redirect; the
    // rest rides the one-shot sessionStorage pending action.
    if (draft.publicName !== '') {
      usePublishDialogStore.getState().setDisplayName(draft.publicName);
    }
    savePendingPublishAction({
      designId: context.designId,
      returnSurface: 'designer',
      draft:
        draft.category !== ''
          ? { name: draft.name, description: draft.description, category: draft.category }
          : (context.draft ?? null),
    });
    goTo(signInUrl(provider));
  };

  const doPublish = (fields: PublishFormFields) => {
    const store = usePublishDialogStore.getState();
    // beginPublishing no-ops outside the form phase; bail so a double
    // activation cannot fire two network publishes.
    if (store.phase !== 'form') return;
    store.setDisplayName(fields.publicName);
    store.beginPublishing();
    const publishCaptures = useCommunityPublishStore.getState().captures;
    if (!publishCaptures) {
      store.fail({ kind: 'server' });
      return;
    }
    const input: CommunityPublishInput = {
      name: fields.name,
      description: fields.description,
      authorName: fields.publicName,
      category: fields.category,
      params: context.params,
      thumbnails: publishCaptures.thumbnails,
      glb: publishCaptures.glb,
    };
    const isUpdate = mode === 'update' && context.publishedId !== null;
    // Read lineage fresh so an INVALID_LINEAGE retry that dropped the remix
    // link (clearContextLineage) publishes standalone instead of re-sending
    // the stale parent from this closure.
    const currentLineage = useCommunityPublishStore.getState().context?.lineage ?? null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);
    const request: Promise<Result<CommunityPublishResult, CommunityClientError>> =
      isUpdate && context.publishedId !== null
        ? updateDesign(context.publishedId, input, controller.signal).then((result) =>
            isOk(result)
              ? ok({ id: result.value.id, url: publicDesignUrl(result.value.id) })
              : result
          )
        : publishDesign(input, currentLineage, controller.signal);
    void request.then((result) => {
      window.clearTimeout(timeoutId);
      const dialog = usePublishDialogStore.getState();
      if (isOk(result)) {
        trackEvent('community_publish', {
          is_remix: currentLineage !== null,
          is_update: isUpdate,
        });
        if (!isUpdate) {
          const publisherId = useSessionStore.getState().user?.userId ?? null;
          if (publisherId !== null && claimMilestone(publisherId, 'first_publish')) {
            trackEvent('community_milestone', { kind: 'first_publish' });
            useToastStore.getState().addToast({
              message: t('community.milestone.firstPublish'),
              type: 'success',
              duration: MILESTONE_TOAST_DURATION_MS,
            });
          }
        }
        const onPublished = useCommunityPublishStore.getState().handlers?.onPublished;
        if (onPublished) {
          void onPublished(result.value.id).then((saved) => {
            if (!saved) {
              useToastStore.getState().addToast({
                message: t('community.toast.publishLinkNotSaved'),
                type: 'error',
              });
            }
          });
        }
        dialog.succeed(result.value);
      } else {
        if (isUpdate && result.error.kind === 'notFound') {
          // The published record vanished under us (unpublished elsewhere or
          // moderated away). Drop the stale link so a retry republishes as new.
          const publish = useCommunityPublishStore.getState();
          publish.handlers?.onUnpublished();
          publish.clearContextPublishedId();
          dialog.switchToCreate();
        }
        dialog.fail(result.error);
      }
    });
  };

  const handleSubmit = (fields: PublishFormFields) => {
    setLastFields(fields);
    if (
      mode === 'create' &&
      context.lineage !== null &&
      parentParamsHash !== null &&
      parentParamsHash === context.paramsHash
    ) {
      setInterstitialOpen(true);
      return;
    }
    doPublish(fields);
  };

  const handleDropRemix = () => {
    useCommunityPublishStore.getState().clearContextLineage();
    usePublishDialogStore.getState().dismissError();
    if (lastFields) doPublish(lastFields);
  };

  const handleUnpublishConfirm = () => {
    if (context.publishedId === null || unpublishBusy) return;
    const publishedId = context.publishedId;
    setUnpublishBusy(true);
    setUnpublishError(undefined);
    void unpublishDesign(publishedId).then((result) => {
      setUnpublishBusy(false);
      if (isOk(result)) {
        trackEvent('community_unpublish');
        // Both gallery caches still hold the card; drop it from each so the
        // unpublished design does not linger as a dead entry until the next
        // staleness refresh.
        useMineStore.getState().removeItem(publishedId);
        useBrowseStore.getState().removeItem(publishedId);
        useCommunityPublishStore.getState().handlers?.onUnpublished();
        useToastStore.getState().addToast({
          message: t('community.toast.unpublished'),
          type: 'success',
        });
        setUnpublishOpen(false);
        handleClose();
      } else {
        const presented = presentPublishError(result.error);
        setUnpublishError(t(presented.messageKey, presented.values));
      }
    });
  };

  // Last-typed fields win so edits survive a failed publish (the form
  // remounts when the phase leaves `form`).
  const prefill: PublishPrefill = lastFields ??
    context.draft ??
    ownDesign.prefill ?? { name: context.designName, description: '', category: null };

  // Owner actions are destructive and belong to the published record, not to
  // the edit in progress, so they hang off the header rather than the form.
  const canUnpublish = mode === 'update' && context.publishedId !== null;

  const title =
    phase === 'success'
      ? mode === 'update'
        ? t('community.publish.success.updatedTitle')
        : t('community.publish.success.title')
      : mode === 'update'
        ? t('community.publish.updateTitle')
        : t('community.publish.title');

  return (
    <>
      <Dialog.Root
        open
        onClose={handleClose}
        size="3xl"
        fullScreen="mobile"
        mobilePresentation="sheet"
        dismissable={phase !== 'publishing' && !unpublishBusy}
      >
        <Dialog.Header
          title={
            <span className="flex items-center gap-2">
              {title}
              <Badge tone="info">{t('common.experimental')}</Badge>
            </span>
          }
          closeAriaLabel={t('common.closeDialog')}
        >
          {canUnpublish && phase === 'form' && (
            <IconButton
              ref={ownerMenuRef}
              size="sm"
              aria-label={t('community.publish.ownerActions')}
              aria-haspopup="menu"
              aria-expanded={ownerMenu.open}
              onClick={() => {
                const rect = ownerMenuRef.current?.getBoundingClientRect();
                setOwnerMenu((previous) =>
                  previous.open
                    ? { ...previous, open: false }
                    : { open: true, position: { x: rect?.left ?? 0, y: (rect?.bottom ?? 0) + 4 } }
                );
              }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {ICON_PATHS.dotsVertical.map((d) => (
                  <path
                    key={d}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={d}
                  />
                ))}
              </svg>
            </IconButton>
          )}
        </Dialog.Header>

        <Menu.Root
          open={ownerMenu.open}
          onClose={() => setOwnerMenu((previous) => ({ ...previous, open: false }))}
          position={ownerMenu.position}
        >
          <Menu.Item variant="danger" onClick={() => setUnpublishOpen(true)}>
            {t('community.publish.unpublish')}
          </Menu.Item>
        </Menu.Root>

        <div className="sr-only" role="status" aria-live="polite">
          {PHASE_ANNOUNCE_KEYS[phase] ? t(PHASE_ANNOUNCE_KEYS[phase]) : ''}
        </div>

        {phase === 'loading' && (
          <Dialog.Body>
            <div className="flex min-h-24 items-center gap-3">
              <Spinner />
              <span className="text-sm text-content-secondary">
                {t('community.publish.checking')}
              </span>
            </div>
          </Dialog.Body>
        )}

        {phase === 'unavailable' && (
          <>
            <Dialog.Body>
              <Alert intent="info" size="md" title={t('community.publish.unavailable.title')}>
                {t('community.publish.unavailable.body')}
              </Alert>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="primary" className="min-h-11 md:min-h-0" onClick={handleClose}>
                {t('common.close')}
              </Button>
            </Dialog.Footer>
          </>
        )}

        {phase === 'form' &&
          (ownDesign.failed ? (
            <>
              <Dialog.Body>
                <Alert intent="error" size="md">
                  {t('community.publish.error.loadFailed')}
                </Alert>
              </Dialog.Body>
              <Dialog.Footer>
                <Button variant="primary" className="min-h-11 md:min-h-0" onClick={ownDesign.retry}>
                  {t('community.publish.error.tryAgain')}
                </Button>
              </Dialog.Footer>
            </>
          ) : ownDesign.pending ? (
            <Dialog.Body>
              <div className="flex min-h-24 items-center gap-3">
                <Spinner />
                <span className="text-sm text-content-secondary">
                  {t('community.publish.loadingPublished')}
                </span>
              </div>
            </Dialog.Body>
          ) : (
            <PublishForm
              mode={mode}
              prefill={prefill}
              captures={captures}
              captureFailed={captureFailed}
              params={context.params}
              lineage={context.lineage}
              publicName={publicName}
              firstTimePublisher={storedDisplayName === ''}
              signedIn={sessionStatus === 'authenticated'}
              requireCutouts={capabilities?.requireCutouts ?? false}
              printsEnabled={capabilities?.printsEnabled ?? false}
              publishedId={context.publishedId}
              currentCoverUrl={ownDesign.coverUrl}
              error={error}
              onPublicNameChange={setEditedPublicName}
              onSubmit={handleSubmit}
              onSignIn={stashAndSignIn}
              onRetryCapture={() => {
                useCommunityPublishStore.getState().handlers?.requestRecapture();
              }}
              onDropRemix={handleDropRemix}
            />
          ))}

        {phase === 'publishing' && (
          <Dialog.Body>
            <div className="flex min-h-24 items-center gap-3">
              <Spinner />
              <span className="text-sm text-content-secondary">
                {mode === 'update'
                  ? t('community.publish.updating')
                  : t('community.publish.publishing')}
              </span>
            </div>
          </Dialog.Body>
        )}

        {phase === 'success' && success !== null && (
          <>
            <Dialog.Body>
              <div className="space-y-4">
                <p className="text-sm text-content-secondary">
                  {t('community.publish.success.body')}
                </p>
                <Field label={t('community.publish.success.linkLabel')}>
                  <CopyField
                    value={success.url}
                    aria-label={t('community.publish.success.linkLabel')}
                    copyAriaLabel={t('community.publish.success.copy')}
                    copiedLabel={t('community.publish.success.copied')}
                  />
                </Field>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="ghost" className="min-h-11 md:min-h-0" onClick={handleClose}>
                {t('community.publish.success.done')}
              </Button>
              <Button
                variant="primary"
                className="min-h-11 md:min-h-0"
                onClick={() => {
                  handleClose();
                  goTo(success.url);
                }}
              >
                {t('community.publish.success.view')}
              </Button>
            </Dialog.Footer>
          </>
        )}
      </Dialog.Root>

      <ConfirmDialog
        isOpen={interstitialOpen}
        title={t('community.publish.form.identicalTitle')}
        message={t('community.publish.form.identicalMessage', {
          parent: context.lineage?.parentName ?? '',
        })}
        confirmText={t('community.publish.form.identicalConfirm')}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          const fields = lastFields;
          setInterstitialOpen(false);
          if (fields) doPublish(fields);
        }}
        onCancel={() => setInterstitialOpen(false)}
      />

      <ConfirmDialog
        isOpen={unpublishOpen}
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
            setUnpublishOpen(false);
            setUnpublishError(undefined);
          }
        }}
      />
    </>
  );
}
