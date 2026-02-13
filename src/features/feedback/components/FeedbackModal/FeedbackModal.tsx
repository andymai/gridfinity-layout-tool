import { useState, useCallback } from 'react';
import { Dialog } from '@/design-system/Dialog';
import { Select } from '@/design-system/Select';
import { Input } from '@/design-system/Input';
import { Checkbox } from '@/design-system/Checkbox';
import { Button } from '@/design-system/Button';
import { useTranslation } from '@/i18n';
import { useLayoutStore, useHalfBinModeStore, useToastStore } from '@/core/store';
import { useFeedbackSubmit } from '../../hooks/useFeedbackSubmit';
import type { FeedbackCategory, FeedbackContext, FeedbackPayload } from '../../types';
import { FEEDBACK_CONSTRAINTS } from '../../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function gatherContext(): FeedbackContext {
  const layout = useLayoutStore.getState().layout;
  const halfBinMode = useHalfBinModeStore.getState().halfBinMode;
  const { width, depth, height } = layout.drawer;
  return {
    drawerSize: `${width}x${depth}x${height}`,
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

  const categoryOptions = [
    { id: 'feature_request', name: t('feedback.categoryFeature') },
    { id: 'bug_report', name: t('feedback.categoryBug') },
    { id: 'general', name: t('feedback.categoryGeneral') },
  ];

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

      const payload: FeedbackPayload = { category, description };
      if (email.trim()) payload.email = email.trim();
      if (includeContext) payload.context = gatherContext();
      if (hp) payload.hp = hp;

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
            <Select
              id="feedback-category"
              aria-label={t('feedback.categoryLabel')}
              value={category}
              onValueChange={(v) => setCategory(v as FeedbackCategory)}
              options={categoryOptions}
              fullWidth
            />
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
              className="px-3 py-2 rounded-md text-sm bg-surface border border-stroke text-content placeholder:text-content-tertiary resize-y transition-all duration-100 hover:border-stroke-strong focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="feedback-email" className="text-sm font-medium text-content">
              {t('feedback.emailLabel')}
            </label>
            <Input
              id="feedback-email"
              aria-label={t('feedback.emailLabel')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('feedback.emailPlaceholder')}
              maxLength={FEEDBACK_CONSTRAINTS.EMAIL_MAX}
              wrapperClassName="w-full"
            />
          </div>

          {/* Include context checkbox */}
          <Checkbox
            checked={includeContext}
            onChange={setIncludeContext}
            label={t('feedback.includeContext')}
            aria-label={t('feedback.includeContext')}
          />

          {/* Error message */}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {t(error)}
            </p>
          )}
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Button
          type="button"
          variant="ghost"
          onClick={handleClose}
          aria-label={t('feedback.cancel')}
        >
          {t('feedback.cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          form="feedback-form"
          disabled={isSubmitting}
          aria-label={t('feedback.submit')}
        >
          {isSubmitting ? t('feedback.submitting') : t('feedback.submit')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
