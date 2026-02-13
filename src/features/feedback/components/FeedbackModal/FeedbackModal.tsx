import { useState, useCallback } from 'react';
import { Dialog } from '@/design-system/Dialog';
import { useTranslation } from '@/i18n';
import { useLayoutStore, useHalfBinModeStore, useToastStore } from '@/core/store';
import { useFeedbackSubmit } from '../../hooks/useFeedbackSubmit';
import type { FeedbackCategory, FeedbackContext } from '../../types';
import { FEEDBACK_CONSTRAINTS } from '../../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function gatherContext(): FeedbackContext {
  const { layout } = useLayoutStore.getState();
  const { halfBinMode } = useHalfBinModeStore.getState();
  return {
    drawerSize: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    browser: navigator.userAgent,
    halfBinMode,
    locale: document.documentElement.lang || 'en',
  };
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const { status, error, submit, reset } = useFeedbackSubmit();

  const [category, setCategory] = useState<FeedbackCategory>('feature_request');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [includeContext, setIncludeContext] = useState(false);
  const [hp, setHp] = useState('');

  const resetForm = useCallback(() => {
    setCategory('feature_request');
    setDescription('');
    setEmail('');
    setIncludeContext(false);
    setHp('');
    reset();
  }, [reset]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      const payload = {
        category,
        description,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(includeContext ? { context: gatherContext() } : {}),
        ...(hp ? { hp } : {}),
      };

      const success = await submit(payload);
      if (success) {
        addToast(t('feedback.successToast'), 'success');
        handleClose();
      }
    },
    [category, description, email, includeContext, hp, submit, addToast, t, handleClose]
  );

  if (!isOpen) return null;

  const isSubmitting = status === 'submitting';

  return (
    <Dialog.Root open={isOpen} onClose={handleClose}>
      <Dialog.Header title={t('feedback.title')} />
      <Dialog.Body>
        <form id="feedback-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Honeypot — hidden from users, visible to bots */}
          <div className="absolute opacity-0 pointer-events-none" aria-hidden="true">
            <input
              type="text"
              name="hp"
              tabIndex={-1}
              autoComplete="off"
              value={hp}
              onChange={(e) => setHp(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-category" className="text-sm font-medium text-content">
              {t('feedback.categoryLabel')}
            </label>
            <select
              id="feedback-category"
              aria-label={t('feedback.categoryLabel')}
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content"
            >
              <option value="feature_request">{t('feedback.categoryFeature')}</option>
              <option value="bug_report">{t('feedback.categoryBug')}</option>
              <option value="general">{t('feedback.categoryGeneral')}</option>
            </select>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-description" className="text-sm font-medium text-content">
              {t('feedback.descriptionLabel')}
            </label>
            <textarea
              id="feedback-description"
              aria-label={t('feedback.descriptionLabel')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('feedback.descriptionPlaceholder')}
              maxLength={FEEDBACK_CONSTRAINTS.DESCRIPTION_MAX}
              rows={5}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content placeholder:text-content-tertiary resize-y"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-email" className="text-sm font-medium text-content">
              {t('feedback.emailLabel')}
            </label>
            <input
              id="feedback-email"
              aria-label={t('feedback.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('feedback.emailPlaceholder')}
              maxLength={FEEDBACK_CONSTRAINTS.EMAIL_MAX}
              className="px-3 py-2 rounded-md text-sm bg-surface-elevated border border-stroke-subtle text-content placeholder:text-content-tertiary"
            />
          </div>

          {/* Include context checkbox */}
          <label className="flex items-center gap-2 text-sm text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              aria-label={t('feedback.includeContext')}
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="rounded border-stroke-subtle"
            />
            <span>{t('feedback.includeContext')}</span>
          </label>

          {/* Error message */}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {t(error)}
            </p>
          )}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <button
          type="button"
          onClick={handleClose}
          className="btn btn-ghost"
          aria-label={t('feedback.cancel')}
        >
          {t('feedback.cancel')}
        </button>
        <button
          type="submit"
          form="feedback-form"
          disabled={isSubmitting}
          className="btn btn-primary"
          aria-label={t('feedback.submit')}
        >
          {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
        </button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
