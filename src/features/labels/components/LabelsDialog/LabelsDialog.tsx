import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, ConfirmDialog, Dialog } from '@/design-system';
import { useToastStore } from '@/core/store';
import { trackEvent } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';
import { useLabelPlans } from '../../hooks/useLabelPlans';
import { useLabelListStore } from '../../store/labelListStore';
import { downloadLabels } from '../../utils/downloadLabels';
import { LabelListEditor } from '../LabelListEditor';
import { LabelPrinterSettings } from '../LabelPrinterSettings';

interface LabelsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Make paper labels for a label maker from a typed or pasted list. */
export function LabelsDialog({ open, onClose }: LabelsDialogProps) {
  const t = useTranslation();
  const { entries, clearEntries } = useLabelListStore(
    useShallow((state) => ({ entries: state.entries, clearEntries: state.clearEntries }))
  );
  const { printer, media, measurer, plans } = useLabelPlans();
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const tooLong = entries.filter((entry) => plans.get(entry.id)?.fits === false).length;
  const printable = measurer === null ? 0 : entries.length - tooLong;

  const download = async (): Promise<void> => {
    if (measurer === null) return;
    setBusy(true);
    try {
      const saved = await downloadLabels(entries, plans, measurer, printer, media);
      if (saved > 0) {
        trackEvent('labels_downloaded', { printer: printer.id, media: media.id, labels: saved });
      }
    } catch {
      useToastStore.getState().addToast(t('labels.downloadFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onClose={onClose} size="3xl" height="fixed" fullScreen="mobile">
      <Dialog.Header title={t('labels.title')} bordered closeAriaLabel={t('common.close')} />
      <Dialog.Split>
        <Dialog.Sidebar className="p-[var(--space-2xl)] max-md:w-full">
          <LabelPrinterSettings />
        </Dialog.Sidebar>
        <Dialog.Pane>
          <LabelListEditor plans={plans} measurer={measurer} />
        </Dialog.Pane>
      </Dialog.Split>
      <Dialog.Footer
        justify="between"
        bordered
        leading={
          <div className="flex items-center gap-3 text-xs">
            {entries.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)}>
                {t('labels.clear')}
              </Button>
            )}
            {measurer === null && entries.length > 0 && (
              <span className="text-content-tertiary">{t('labels.loadingFonts')}</span>
            )}
            {tooLong > 0 && (
              <span className="text-warning">{t('labels.tooLongCount', { count: tooLong })}</span>
            )}
          </div>
        }
      >
        <Button
          variant="primary"
          onClick={() => void download()}
          disabled={printable === 0 || busy}
          loading={busy}
        >
          {printable > 1 ? t('labels.downloadZip') : t('labels.download')}
        </Button>
      </Dialog.Footer>

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
    </Dialog.Root>
  );
}
