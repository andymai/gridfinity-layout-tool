import { useState } from 'react';
import { Button, ConfirmDialog } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { LabelsWorkspace } from '../../hooks/useLabelsWorkspace';
import { useLabelListStore } from '../../store/labelListStore';

interface LabelsFooterProps {
  readonly workspace: LabelsWorkspace;
}

export function LabelsFooter({ workspace }: LabelsFooterProps) {
  const t = useTranslation();
  const clearEntries = useLabelListStore((state) => state.clearEntries);
  const [confirmClear, setConfirmClear] = useState(false);
  const { hasEntries, fontsFailed, retryFonts, measurer, skipped, printable, busy, download } =
    workspace;

  return (
    <div className="flex w-full items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs">
        {hasEntries && (
          <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
            {t('labels.clear')}
          </Button>
        )}
        {fontsFailed ? (
          <>
            <span className="text-error">{t('labels.fontsFailed')}</span>
            <Button variant="ghost" size="sm" onClick={retryFonts}>
              {t('error.tryAgain')}
            </Button>
          </>
        ) : (
          measurer === null &&
          hasEntries && <span className="text-content-tertiary">{t('labels.loadingFonts')}</span>
        )}
        {skipped > 0 && (
          <span className="text-warning">{t('labels.skippedCount', { count: skipped })}</span>
        )}
      </div>
      <Button
        variant="primary"
        onClick={() => void download()}
        disabled={printable === 0 || busy}
        loading={busy}
      >
        {printable > 1 ? t('labels.downloadZip') : t('labels.download')}
      </Button>

      <ConfirmDialog
        isOpen={confirmClear}
        title={t('labels.clear')}
        message={t('labels.clearConfirm')}
        confirmText={t('labels.clear')}
        cancelText={t('common.cancel')}
        destructive
        onConfirm={() => {
          clearEntries();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
