import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button, Dialog, Field, Textarea, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useToastStore } from '@/core/store/toast';
import { trackEvent } from '@/shared/analytics/posthog';
import {
  COMMUNITY_REPORT_NOTE_MAX_LENGTH,
  COMMUNITY_REPORT_REASONS,
} from '@/shared/types/community';
import type { CommunityReportReason } from '@/shared/types/community';
import { reportDesign } from '../../api/client';
import type { CommunityClientError } from '../../api/client';

const REASON_LABEL_KEYS: Record<CommunityReportReason, string> = {
  inappropriate: 'community.report.reason.inappropriate',
  spam: 'community.report.reason.spam',
  broken: 'community.report.reason.broken',
  stolen: 'community.report.reason.stolen',
};

interface ReportDialogProps {
  designId: string;
  onClose: () => void;
  /** Session expired between opening the dialog and submitting. */
  onNeedsAuth: () => void;
}

/** Signed-in report flow: closed reason union + optional note, toast on success. */
export function ReportDialog({ designId, onClose, onNeedsAuth }: ReportDialogProps) {
  const t = useTranslation();
  const [reason, setReason] = useState<CommunityReportReason | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const errorMessage = (err: CommunityClientError): string => {
    switch (err.kind) {
      case 'rateLimited':
        return t('community.report.error.rateLimited');
      case 'contentBlocked':
        return t('community.report.error.contentBlocked');
      case 'network':
        return t('community.report.error.offline');
      case 'notFound':
      case 'needsAuth':
      case 'disabled':
      case 'quotaExceeded':
      case 'validation':
      case 'forbidden':
      case 'server':
        return t('community.report.error.generic');
    }
  };

  // Radio keyboard model: arrows/Home/End move selection and focus, matching
  // the ConnectorPicker radiogroup convention.
  const handleGroupKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const pos = COMMUNITY_REPORT_REASONS.findIndex((entry) => entry === reason);
      const count = COMMUNITY_REPORT_REASONS.length;
      let next: number;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        next = pos < 0 ? 0 : (pos + 1) % count;
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        next = pos < 0 ? count - 1 : (pos - 1 + count) % count;
      } else if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = count - 1;
      } else {
        return;
      }
      event.preventDefault();
      setReason(COMMUNITY_REPORT_REASONS[next]);
      const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios?.[next]?.focus();
    },
    [reason]
  );

  const handleSubmit = () => {
    if (reason === null || busy) return;
    setBusy(true);
    setError(null);
    void reportDesign(designId, reason, note).then((result) => {
      setBusy(false);
      if (isOk(result)) {
        trackEvent('community_report', { reason });
        useToastStore.getState().addToast({
          message: t('community.report.submitted'),
          type: 'success',
        });
        onClose();
      } else if (result.error.kind === 'needsAuth') {
        onNeedsAuth();
      } else {
        setError(errorMessage(result.error));
      }
    });
  };

  return (
    <Dialog.Root open onClose={onClose} size="md" mobilePresentation="sheet" dismissable={!busy}>
      <Dialog.Header title={t('community.report.title')} closeAriaLabel={t('common.closeDialog')} />
      <Dialog.Body>
        <div className="space-y-4">
          <div
            ref={groupRef}
            role="radiogroup"
            aria-label={t('community.report.reasonLabel')}
            tabIndex={-1}
            onKeyDown={handleGroupKeyDown}
            className="space-y-1.5"
          >
            {COMMUNITY_REPORT_REASONS.map((entry, index) => {
              const selected = entry === reason;
              // Roving tabIndex: the selected radio is the tab stop; before
              // any selection the first option is.
              const isTabStop = selected || (reason === null && index === 0);
              return (
                <Button
                  key={entry}
                  type="button"
                  variant="ghost"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={isTabStop ? 0 : -1}
                  onClick={() => setReason(entry)}
                  className={cn(
                    'h-auto w-full justify-start rounded-lg border p-3 text-left text-sm font-normal',
                    selected
                      ? 'border-accent bg-accent/5'
                      : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
                  )}
                >
                  {t(REASON_LABEL_KEYS[entry])}
                </Button>
              );
            })}
          </div>

          <Field label={t('community.report.noteLabel')}>
            <Textarea
              value={note}
              maxLength={COMMUNITY_REPORT_NOTE_MAX_LENGTH}
              rows={3}
              resize="none"
              placeholder={t('community.report.notePlaceholder')}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>

          {error !== null && (
            <p role="alert" className="text-sm text-error">
              {error}
            </p>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer bordered>
        <Button variant="ghost" className="min-h-11 md:min-h-0" onClick={onClose} disabled={busy}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          className="min-h-11 md:min-h-0"
          onClick={handleSubmit}
          disabled={reason === null}
          loading={busy}
        >
          {t('community.report.submit')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
