import { useState } from 'react';
import { Alert, Button, Dialog, Field, Input, Textarea } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityPublishCaptures } from '@/core/store/communityPublish';
import type { AuthProvider } from '@/core/sync/session/sessionApi';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityCategory, CommunityDesignLineage } from '@/shared/types/community';
import { hasQualifyingCutout } from '@/shared/utils/communityLowEffort';
import type { CommunityClientError } from '../../api/client';
import type { PublishDialogMode, PublishPrefill } from '../../store/publishStore';
import { CategoryChips } from './CategoryChips';
import { CoverImageSection } from './CoverImageSection';
import { PublishArtefact } from './PublishArtefact';
import { PublisherIdentity } from './PublisherIdentity';
import { presentPublishError } from './publishErrors';
import type { PublishErrorField } from './publishErrors';

/** Mirrors COMMUNITY_NAME_MAX_LENGTH / COMMUNITY_DESCRIPTION_MAX_LENGTH in api/lib/communityValidation.ts. */
const PUBLISH_NAME_MAX_LENGTH = 60;
const PUBLISH_DESCRIPTION_MAX_LENGTH = 500;

export interface PublishFormFields {
  name: string;
  description: string;
  category: CommunityCategory;
  publicName: string;
}

/**
 * Whatever the user had typed when the redirect took them away. Sign-in now
 * happens from inside the form, so the draft has to travel with it or the
 * OAuth round trip silently discards their work.
 */
export interface PublishSignInDraft {
  name: string;
  description: string;
  category: CommunityCategory | '';
  publicName: string;
}

export interface PublishFormProps {
  mode: PublishDialogMode;
  prefill: PublishPrefill;
  captures: CommunityPublishCaptures | null;
  captureFailed: boolean;
  params: BinParams;
  lineage: CommunityDesignLineage | null;
  publicName: string;
  /** No public name was ever saved, so the identity field opens expanded. */
  firstTimePublisher: boolean;
  signedIn: boolean;
  /** Server policy: designs without a tool cutout are rejected. */
  requireCutouts: boolean;
  printsEnabled: boolean;
  publishedId: string | null;
  currentCoverUrl: string;
  error: CommunityClientError | null;
  onPublicNameChange: (name: string) => void;
  onSubmit: (fields: PublishFormFields) => void;
  onSignIn: (provider: AuthProvider, draft: PublishSignInDraft) => void;
  onRetryCapture: () => void;
  onDropRemix: () => void;
}

export function PublishForm({
  mode,
  prefill,
  captures,
  captureFailed,
  params,
  lineage,
  publicName,
  firstTimePublisher,
  signedIn,
  requireCutouts,
  printsEnabled,
  publishedId,
  currentCoverUrl,
  error,
  onPublicNameChange,
  onSubmit,
  onSignIn,
  onRetryCapture,
  onDropRemix,
}: PublishFormProps) {
  const t = useTranslation();
  const [name, setName] = useState(() => prefill.name.slice(0, PUBLISH_NAME_MAX_LENGTH));
  const [description, setDescription] = useState(() =>
    prefill.description.slice(0, PUBLISH_DESCRIPTION_MAX_LENGTH)
  );
  const [category, setCategory] = useState<CommunityCategory | ''>(prefill.category ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const [edited, setEdited] = useState<Partial<Record<PublishErrorField, boolean>>>({});

  const markEdited = (field: PublishErrorField) =>
    setEdited((previous) => (previous[field] === true ? previous : { ...previous, [field]: true }));

  const cutoutMissing = requireCutouts && !hasQualifyingCutout(params);

  const presented = error !== null ? presentPublishError(error) : null;
  // A rejection stops applying to the input the moment its author starts
  // fixing it; leaving it under a field being retyped reads as a live verdict
  // on the new text. The banner stays until the next submit answers it.
  const serverFieldError = (field: PublishErrorField): string | undefined =>
    presented?.field === field && edited[field] !== true
      ? t(presented.messageKey, presented.values)
      : undefined;

  const nameError =
    serverFieldError('name') ??
    (showErrors && name.trim() === '' ? t('community.publish.form.nameRequired') : undefined);
  const categoryError =
    serverFieldError('category') ??
    (showErrors && category === '' ? t('community.publish.form.categoryRequired') : undefined);
  const publicNameError =
    serverFieldError('publicName') ??
    (showErrors && publicName.trim() === '' ? t('community.publish.identity.required') : undefined);

  const previewPending = captures === null && !captureFailed;
  // A disabled primary must say why. Order matters: the cutout policy is a
  // hard rejection, a missing capture is only a wait.
  const blockedReason = cutoutMissing
    ? t('community.publish.needsCutout.button')
    : captures === null
      ? previewPending
        ? t('community.publish.form.waitingPreview')
        : t('community.publish.form.previewRequired')
      : null;

  const signInDraft = (): PublishSignInDraft => ({
    name: name.trim(),
    description: description.trim(),
    category,
    publicName: publicName.trim(),
  });

  const handleSubmit = () => {
    if (name.trim() === '' || category === '' || publicName.trim() === '') {
      setShowErrors(true);
      return;
    }
    // Validate before sending anyone through OAuth: coming back to a form
    // that then rejects the name wastes a full redirect round trip.
    if (!signedIn) {
      setAuthPrompt(true);
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      category,
      publicName: publicName.trim(),
    });
  };

  return (
    <>
      <Dialog.Split>
        <Dialog.Sidebar className="p-[var(--space-2xl)] md:w-80">
          <PublishArtefact
            thumbnails={captures?.thumbnails ?? null}
            captureFailed={captureFailed}
            params={params}
            lineage={lineage}
            onRetryCapture={onRetryCapture}
          />
        </Dialog.Sidebar>

        <Dialog.Pane>
          <div className="space-y-4">
            {presented !== null && presented.field === null && (
              <Alert intent="error" size="md">
                <div className="space-y-2">
                  <p>{t(presented.messageKey, presented.values)}</p>
                  {error?.kind === 'quotaExceeded' && (
                    <p className="text-xs">{t('community.publish.error.quotaHint')}</p>
                  )}
                  {presented.needsAuth && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" onClick={() => onSignIn('google', signInDraft())}>
                        {t('auth.signInWithGoogle')}
                      </Button>
                      <Button variant="secondary" onClick={() => onSignIn('github', signInDraft())}>
                        {t('auth.signInWithGithub')}
                      </Button>
                    </div>
                  )}
                  {presented.canDropRemix && (
                    <Button variant="secondary" onClick={onDropRemix}>
                      {t('community.publish.error.publishWithoutRemix')}
                    </Button>
                  )}
                </div>
              </Alert>
            )}

            {cutoutMissing && (
              <Alert intent="warning" size="md" title={t('community.publish.needsCutout.title')}>
                {t('community.publish.needsCutout.button')}
              </Alert>
            )}

            {authPrompt && (
              <Alert intent="info" size="md" title={t('community.publish.signin.title')}>
                <div className="space-y-2">
                  <p>{t('community.publish.signin.value')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => onSignIn('google', signInDraft())}>
                      {t('auth.signInWithGoogle')}
                    </Button>
                    <Button variant="secondary" onClick={() => onSignIn('github', signInDraft())}>
                      {t('auth.signInWithGithub')}
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            <Field
              label={t('community.publish.form.nameLabel')}
              htmlFor="community-publish-name"
              error={nameError}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="community-publish-name"
                  value={name}
                  maxLength={PUBLISH_NAME_MAX_LENGTH}
                  placeholder={t('community.publish.form.namePlaceholder')}
                  aria-invalid={nameError !== undefined}
                  onChange={(e) => {
                    setName(e.target.value);
                    markEdited('name');
                  }}
                />
                <span aria-hidden className="shrink-0 text-xs tabular-nums text-content-tertiary">
                  {name.length}/{PUBLISH_NAME_MAX_LENGTH}
                </span>
              </div>
            </Field>

            <Field
              label={t('community.publish.form.descriptionLabel')}
              htmlFor="community-publish-description"
              error={serverFieldError('description')}
            >
              <Textarea
                id="community-publish-description"
                value={description}
                maxLength={PUBLISH_DESCRIPTION_MAX_LENGTH}
                showCount
                rows={4}
                placeholder={t('community.publish.form.descriptionPlaceholder')}
                onChange={(e) => {
                  setDescription(e.target.value);
                  markEdited('description');
                }}
              />
            </Field>

            <Field
              label={t('community.publish.form.categoryLabel')}
              htmlFor="community-publish-category"
              error={categoryError}
            >
              <CategoryChips
                id="community-publish-category"
                value={category}
                invalid={categoryError !== undefined}
                describedBy={
                  categoryError !== undefined ? 'community-publish-category-error' : undefined
                }
                onChange={(value) => {
                  setCategory(value);
                  markEdited('category');
                }}
              />
            </Field>

            <PublisherIdentity
              value={publicName}
              firstTime={firstTimePublisher}
              error={publicNameError}
              onChange={(value) => {
                onPublicNameChange(value);
                markEdited('publicName');
              }}
            />

            {mode === 'update' && publishedId !== null && printsEnabled && (
              <CoverImageSection designId={publishedId} currentCoverUrl={currentCoverUrl} />
            )}
          </div>
        </Dialog.Pane>
      </Dialog.Split>
      <Dialog.Footer
        bordered
        leading={
          blockedReason !== null ? (
            <p id="community-publish-blocked" className="text-xs text-content-tertiary">
              {blockedReason}
            </p>
          ) : (
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
          )
        }
      >
        <Button
          variant="primary"
          className="min-h-11 md:min-h-0"
          disabled={captures === null || cutoutMissing}
          aria-describedby={blockedReason !== null ? 'community-publish-blocked' : undefined}
          onClick={handleSubmit}
        >
          {mode === 'update'
            ? t('community.publish.submitUpdate')
            : signedIn
              ? t('community.publish.submit')
              : t('community.publish.submitSignedOut')}
        </Button>
      </Dialog.Footer>
    </>
  );
}
