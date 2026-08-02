import { useMemo, useState } from 'react';
import { Button, Dialog, Field, Input, Select, Spinner, Textarea } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { CommunityPublishCaptures } from '@/core/store/communityPublish';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityCategory, CommunityDesignLineage } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { deriveTechniques } from '@/shared/utils/communityTechniques';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import type { PublishDialogMode, PublishPrefill } from '../../store/publishStore';

/** Mirrors COMMUNITY_NAME_MAX_LENGTH / COMMUNITY_DESCRIPTION_MAX_LENGTH in api/lib/communityValidation.ts. */
const PUBLISH_NAME_MAX_LENGTH = 60;
const PUBLISH_DESCRIPTION_MAX_LENGTH = 500;

export interface PublishFormFields {
  name: string;
  description: string;
  category: CommunityCategory;
}

export interface PublishFormProps {
  mode: PublishDialogMode;
  prefill: PublishPrefill;
  captures: CommunityPublishCaptures | null;
  captureFailed: boolean;
  params: BinParams;
  lineage: CommunityDesignLineage | null;
  onSubmit: (fields: PublishFormFields) => void;
  onRetryCapture: () => void;
  onUnpublish: (() => void) | null;
}

function thumbnailSrc(value: string): string {
  return value.startsWith('data:') ? value : `data:image/webp;base64,${value}`;
}

export function PublishForm({
  mode,
  prefill,
  captures,
  captureFailed,
  params,
  lineage,
  onSubmit,
  onRetryCapture,
  onUnpublish,
}: PublishFormProps) {
  const t = useTranslation();
  const [name, setName] = useState(() => prefill.name.slice(0, PUBLISH_NAME_MAX_LENGTH));
  const [description, setDescription] = useState(() =>
    prefill.description.slice(0, PUBLISH_DESCRIPTION_MAX_LENGTH)
  );
  const [category, setCategory] = useState<CommunityCategory | ''>(prefill.category ?? '');
  const [showErrors, setShowErrors] = useState(false);

  const techniques = useMemo(() => deriveTechniques(params), [params]);
  const categoryOptions = useMemo<SelectOption[]>(
    () =>
      (Object.keys(CATEGORY_LABEL_KEYS) as CommunityCategory[]).map((id) => ({
        id,
        name: t(CATEGORY_LABEL_KEYS[id]),
      })),
    [t]
  );

  const nameError = name.trim() === '' ? t('community.publish.form.nameRequired') : undefined;
  const categoryError = category === '' ? t('community.publish.form.categoryRequired') : undefined;

  const handleSubmit = () => {
    if (nameError !== undefined || category === '') {
      setShowErrors(true);
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim(), category });
  };

  const showRootLine =
    lineage !== null &&
    lineage.parentId !== lineage.rootId &&
    lineage.rootAuthorName !== '' &&
    lineage.rootAuthorName !== lineage.parentAuthorName;

  return (
    <>
      <Dialog.Body>
        <div className="space-y-4">
          <div
            role="group"
            aria-label={t('community.publish.form.previewLabel')}
            className="flex items-center gap-2 overflow-x-auto"
          >
            {captures ? (
              captures.thumbnails.map((thumb, index) => (
                <img
                  key={index}
                  src={thumbnailSrc(thumb)}
                  alt={t('community.publish.form.previewAlt', { index: index + 1 })}
                  className="h-20 w-20 flex-shrink-0 rounded-md border border-stroke-subtle object-cover"
                />
              ))
            ) : captureFailed ? (
              <div className="flex min-h-11 w-full items-center gap-3 rounded-md border border-stroke-subtle px-3 py-2">
                <span role="alert" className="text-sm text-content">
                  {t('community.publish.form.previewFailed')}
                </span>
                <Button variant="ghost" className="min-h-11 md:min-h-0" onClick={onRetryCapture}>
                  {t('community.publish.form.retryPreview')}
                </Button>
              </div>
            ) : (
              <div className="flex min-h-11 w-full items-center gap-3 rounded-md border border-stroke-subtle px-3 py-2">
                <Spinner />
                <span className="text-sm text-content-secondary">
                  {t('community.publish.form.preparingPreview')}
                </span>
              </div>
            )}
          </div>

          <Field
            label={t('community.publish.form.nameLabel')}
            htmlFor="community-publish-name"
            error={showErrors ? nameError : undefined}
          >
            <Input
              id="community-publish-name"
              value={name}
              maxLength={PUBLISH_NAME_MAX_LENGTH}
              aria-describedby={
                showErrors && nameError ? 'community-publish-name-error' : undefined
              }
              aria-invalid={showErrors && nameError !== undefined}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field
            label={t('community.publish.form.descriptionLabel')}
            htmlFor="community-publish-description"
          >
            <Textarea
              id="community-publish-description"
              value={description}
              maxLength={PUBLISH_DESCRIPTION_MAX_LENGTH}
              showCount
              rows={3}
              placeholder={t('community.publish.form.descriptionPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <Field
            label={t('community.publish.form.categoryLabel')}
            htmlFor="community-publish-category"
            error={showErrors ? categoryError : undefined}
          >
            <Select
              id="community-publish-category"
              options={categoryOptions}
              value={category}
              placeholder={t('community.publish.form.categoryPlaceholder')}
              error={showErrors && categoryError !== undefined}
              aria-describedby={
                showErrors && categoryError ? 'community-publish-category-error' : undefined
              }
              onValueChange={(value) => setCategory(value as CommunityCategory)}
            />
          </Field>

          <div>
            <p className="text-xs font-medium text-content-tertiary">
              {t('community.publish.form.techniquesLabel')}
            </p>
            {techniques.length === 0 ? (
              <p className="mt-1 text-sm text-content-secondary">
                {t('community.publish.form.techniquesNone')}
              </p>
            ) : (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {techniques.map((technique) => (
                  <li
                    key={technique}
                    className="rounded-full bg-surface-hover px-2.5 py-0.5 text-xs text-content-secondary"
                  >
                    {t(TECHNIQUE_CONFIG[technique].labelKey)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lineage !== null && (
            <div className="rounded-md bg-surface-hover px-3 py-2 text-sm text-content-secondary">
              <p>
                {t('community.publish.form.lineageNotice', {
                  parent: lineage.parentName,
                  author: lineage.parentAuthorName,
                })}
              </p>
              {showRootLine && (
                <p>
                  {t('community.publish.form.lineageNoticeRoot', {
                    author: lineage.rootAuthorName,
                  })}
                </p>
              )}
            </div>
          )}

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
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        {onUnpublish !== null && (
          <Button variant="danger" className="min-h-11 md:min-h-0" onClick={onUnpublish}>
            {t('community.publish.unpublish')}
          </Button>
        )}
        <Button
          variant="primary"
          className="min-h-11 md:min-h-0"
          disabled={captures === null}
          onClick={handleSubmit}
        >
          {mode === 'update' ? t('community.publish.submitUpdate') : t('community.publish.submit')}
        </Button>
      </Dialog.Footer>
    </>
  );
}
