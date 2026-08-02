/**
 * Community publish dialog, mounted at app level (App.tsx) behind the
 * community_showcase flag and driven by the core communityPublish store.
 * Composition contract: the opener (bin designer) supplies design context,
 * captures, and handlers; this dialog never imports another feature.
 */

import { useEffect, useRef, useState } from 'react';
import { Button, ConfirmDialog, CopyField, Dialog, Field, Spinner } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk, ok } from '@/core/result';
import type { Result } from '@/core/result';
import { useCommunityPublishStore } from '@/core/store/communityPublish';
import { useToastStore } from '@/core/store/toast';
import { signInUrl } from '@/core/sync/session/sessionApi';
import type { AuthProvider } from '@/core/sync/session/sessionApi';
import { useSessionStore } from '@/core/sync/session/useSession';
import { trackEvent } from '@/shared/analytics/posthog';
import { hashBinParams } from '@/shared/utils/binParamsHash';
import { savePendingPublishAction } from '@/shared/utils/communityPendingAction';
import { fetchOwnDesign, publishDesign, unpublishDesign, updateDesign } from '../../api/client';
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
import { IdentityStep } from './IdentityStep';
import { PublishForm } from './PublishForm';
import type { PublishFormFields } from './PublishForm';

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

const VALIDATION_CODE_KEYS: Partial<Record<string, string>> = {
  INVALID_NAME: 'community.publish.error.invalidName',
  INVALID_DESCRIPTION: 'community.publish.error.invalidDescription',
  INVALID_AUTHOR_NAME: 'community.publish.error.invalidAuthorName',
  INVALID_CATEGORY: 'community.publish.error.invalidCategory',
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
  const error = usePublishDialogStore((s) => s.error);
  const success = usePublishDialogStore((s) => s.success);

  const [lastFields, setLastFields] = useState<PublishFormFields | null>(null);
  const openedForRef = useRef<string | null>(null);
  const [interstitialOpen, setInterstitialOpen] = useState(false);
  const [parentParamsHash, setParentParamsHash] = useState<string | null>(null);
  const [fetchedPrefill, setFetchedPrefill] = useState<PublishPrefill | null>(null);
  const [updateFetchPending, setUpdateFetchPending] = useState(
    () => typeof context?.publishedId === 'string'
  );
  const [updateFetchFailed, setUpdateFetchFailed] = useState(false);
  const [updateFetchAttempt, setUpdateFetchAttempt] = useState(0);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [unpublishError, setUnpublishError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!context) return;
    if (openedForRef.current === context.designId) return;
    openedForRef.current = context.designId;
    usePublishDialogStore.getState().open({
      mode: context.publishedId !== null ? 'update' : 'create',
      signedIn: sessionStatus === 'authenticated',
    });
  }, [context, sessionStatus]);

  useEffect(() => {
    if (phase === 'signin' && sessionStatus === 'authenticated') {
      usePublishDialogStore.getState().completeSignIn();
    }
  }, [phase, sessionStatus]);

  const errorKind = error?.kind ?? null;
  useEffect(() => {
    if (phase === 'signin' || (phase === 'error' && errorKind === 'needsAuth')) {
      trackEvent('community_signin_prompt_shown', { intent: 'publish' });
    }
  }, [phase, errorKind]);

  const publishedId = context?.publishedId ?? null;
  useEffect(() => {
    if (publishedId === null) return;
    let cancelled = false;
    void fetchOwnDesign(publishedId).then((result) => {
      if (cancelled) return;
      if (isOk(result)) {
        setFetchedPrefill({
          name: result.value.name,
          description: result.value.description,
          category: result.value.category,
        });
      } else if (result.error.kind === 'notFound') {
        const publish = useCommunityPublishStore.getState();
        publish.handlers?.onUnpublished();
        publish.clearContextPublishedId();
        usePublishDialogStore.getState().switchToCreate();
        useToastStore.getState().addToast({
          message: t('community.publish.error.republishAsNew'),
          type: 'info',
        });
      } else {
        // Without the live record, submitting would overwrite the published
        // name/description with local defaults; block the form instead.
        setUpdateFetchFailed(true);
      }
      setUpdateFetchPending(false);
    });
    return () => {
      cancelled = true;
    };
  }, [publishedId, updateFetchAttempt, t]);

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

  const handleSignIn = (provider: AuthProvider) => {
    const fields = lastFields;
    savePendingPublishAction({
      designId: context.designId,
      returnSurface: 'designer',
      draft: fields
        ? { name: fields.name, description: fields.description, category: fields.category }
        : (context.draft ?? null),
    });
    goTo(signInUrl(provider));
  };

  const errorMessage = (err: CommunityClientError): string => {
    switch (err.kind) {
      case 'needsAuth':
        return t('community.publish.error.needsAuth');
      case 'disabled':
        return t('community.publish.error.disabled');
      case 'rateLimited':
        return err.retryAfterSeconds !== null
          ? t('community.publish.error.rateLimitedWait', { seconds: err.retryAfterSeconds })
          : t('community.publish.error.rateLimited');
      case 'quotaExceeded':
        return t('community.publish.error.quota');
      case 'contentBlocked':
        return t('community.publish.error.contentBlocked');
      case 'validation': {
        // Server messages are English-only; map known codes to i18n keys.
        const key = VALIDATION_CODE_KEYS[err.code];
        return key !== undefined ? t(key) : t('community.publish.error.generic');
      }
      case 'forbidden':
        return t('community.publish.error.generic');
      case 'notFound':
        return t('community.publish.error.notFound');
      case 'network':
        return t('community.publish.error.offline');
      case 'server':
        return t('community.publish.error.generic');
    }
  };

  const doPublish = (fields: PublishFormFields) => {
    const store = usePublishDialogStore.getState();
    // beginPublishing no-ops outside the form phase; bail so a double
    // activation cannot fire two network publishes.
    if (store.phase !== 'form') return;
    store.beginPublishing();
    const publishCaptures = useCommunityPublishStore.getState().captures;
    if (!publishCaptures) {
      store.fail({ kind: 'server' });
      return;
    }
    const input: CommunityPublishInput = {
      name: fields.name,
      description: fields.description,
      authorName: store.displayName,
      category: fields.category,
      params: context.params,
      thumbnails: publishCaptures.thumbnails,
      glb: publishCaptures.glb,
    };
    const isUpdate = mode === 'update' && context.publishedId !== null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PUBLISH_TIMEOUT_MS);
    const request: Promise<Result<CommunityPublishResult, CommunityClientError>> =
      isUpdate && context.publishedId !== null
        ? updateDesign(context.publishedId, input, controller.signal).then((result) =>
            isOk(result)
              ? ok({ id: result.value.id, url: publicDesignUrl(result.value.id) })
              : result
          )
        : publishDesign(input, context.lineage, controller.signal);
    void request.then((result) => {
      window.clearTimeout(timeoutId);
      const dialog = usePublishDialogStore.getState();
      if (isOk(result)) {
        trackEvent('community_publish', {
          is_remix: context.lineage !== null,
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
          // moderated away). Drop the stale link so Back republishes as new.
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

  const handleTryAgain = () => {
    const fields = lastFields;
    usePublishDialogStore.getState().backToForm();
    if (fields) {
      doPublish(fields);
    }
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
        setUnpublishError(errorMessage(result.error));
      }
    });
  };

  // Last-typed fields win so edits survive the error -> Back round trip
  // (the form unmounts during publishing/error phases).
  const prefill: PublishPrefill = lastFields ??
    context.draft ??
    fetchedPrefill ?? { name: context.designName, description: '', category: null };

  const title =
    phase === 'success'
      ? mode === 'update'
        ? t('community.publish.success.updatedTitle')
        : t('community.publish.success.title')
      : mode === 'update'
        ? t('community.publish.updateTitle')
        : t('community.publish.title');

  const disclosure = (
    <p className="text-xs text-content-tertiary">
      {t('community.publish.disclosure')}{' '}
      <a
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-content"
      >
        {t('community.publish.disclosureTerms')}
      </a>
    </p>
  );

  return (
    <>
      <Dialog.Root
        open
        onClose={handleClose}
        size="lg"
        fullScreen="mobile"
        mobilePresentation="sheet"
        dismissable={phase !== 'publishing' && !unpublishBusy}
      >
        <Dialog.Header title={title} closeAriaLabel={t('common.closeDialog')} />

        {phase === 'signin' && (
          <Dialog.Body>
            <div className="space-y-4">
              <p className="text-sm text-content-secondary">
                {t('community.publish.signin.value')}
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  className="min-h-11 md:min-h-0"
                  onClick={() => handleSignIn('google')}
                >
                  {t('auth.signInWithGoogle')}
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 md:min-h-0"
                  onClick={() => handleSignIn('github')}
                >
                  {t('auth.signInWithGithub')}
                </Button>
              </div>
              {disclosure}
            </div>
          </Dialog.Body>
        )}

        {phase === 'identity' && (
          <IdentityStep
            initialName={sessionUser?.provider === 'github' ? (sessionUser.handle ?? '') : ''}
            onContinue={(name) => usePublishDialogStore.getState().confirmIdentity(name)}
          />
        )}

        {phase === 'form' &&
          (updateFetchFailed ? (
            <>
              <Dialog.Body>
                <p role="alert" className="text-sm text-content">
                  {t('community.publish.error.loadFailed')}
                </p>
              </Dialog.Body>
              <Dialog.Footer>
                <Button
                  variant="primary"
                  className="min-h-11 md:min-h-0"
                  onClick={() => {
                    setUpdateFetchFailed(false);
                    setUpdateFetchPending(true);
                    setUpdateFetchAttempt((attempt) => attempt + 1);
                  }}
                >
                  {t('community.publish.error.tryAgain')}
                </Button>
              </Dialog.Footer>
            </>
          ) : updateFetchPending ? (
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
              onSubmit={handleSubmit}
              onRetryCapture={() => {
                useCommunityPublishStore.getState().handlers?.requestRecapture();
              }}
              onUnpublish={
                mode === 'update' && context.publishedId !== null
                  ? () => setUnpublishOpen(true)
                  : null
              }
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
                <Field label={t('community.publish.success.linkLabel')}>
                  <CopyField
                    value={success.url}
                    aria-label={t('community.publish.success.linkLabel')}
                    copyAriaLabel={t('community.publish.success.copy')}
                    copiedLabel={t('community.publish.success.copied')}
                  />
                </Field>
                <p className="text-xs text-content-tertiary">
                  {t('community.publish.success.viewSoon')}
                </p>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="primary" className="min-h-11 md:min-h-0" onClick={handleClose}>
                {t('community.publish.success.done')}
              </Button>
            </Dialog.Footer>
          </>
        )}

        {phase === 'error' && error !== null && (
          <>
            <Dialog.Body>
              <div className="space-y-4">
                <p role="alert" className="text-sm text-content">
                  {errorMessage(error)}
                </p>
                {error.kind === 'needsAuth' && (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="primary"
                      className="min-h-11 md:min-h-0"
                      onClick={() => handleSignIn('google')}
                    >
                      {t('auth.signInWithGoogle')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="min-h-11 md:min-h-0"
                      onClick={() => handleSignIn('github')}
                    >
                      {t('auth.signInWithGithub')}
                    </Button>
                  </div>
                )}
                {error.kind === 'quotaExceeded' && (
                  <p className="text-xs text-content-tertiary">
                    {t('community.publish.error.quotaHint')}
                  </p>
                )}
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Button
                variant="ghost"
                className="min-h-11 md:min-h-0"
                onClick={() => usePublishDialogStore.getState().backToForm()}
              >
                {t('community.publish.error.back')}
              </Button>
              {(error.kind === 'network' || error.kind === 'server') && (
                <Button variant="primary" className="min-h-11 md:min-h-0" onClick={handleTryAgain}>
                  {t('community.publish.error.tryAgain')}
                </Button>
              )}
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
