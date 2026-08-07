/**
 * "Print fit test" control for the sliding tray.
 *
 * Opens the shared ExportDialog to download a one-file calibration card: five
 * rail stubs across a clearance ladder plus one tray stub that runs in all of
 * them. The rung the stub slides best in names the clearance to enter above.
 *
 * The rungs are ordered rather than labelled, so the tips explain how to read
 * the card. Embossing five numbers would smear on a 0.4mm nozzle, which is the
 * nozzle most of these will be printed on.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/design-system/Button';
import { ExportDialog } from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import {
  useSlideFitSampleExport,
  SLIDE_FIT_SAMPLE_BASE_NAME,
} from '../../../hooks/useSlideFitSampleExport';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';

export function SlideFitSampleButton() {
  const t = useTranslation();
  const { isExporting, canExport, downloadSample } = useSlideFitSampleExport();

  const [open, setOpen] = useState(false);
  const [fileNameConfig, setFileNameConfig] = useState<ExportFileNameConfig>({
    style: 'descriptive',
    customName: '',
    format: 'stl',
  });

  const activeFormat: ExportFileFormat = fileNameConfig.format ?? 'stl';
  const displayExtension = FORMAT_EXTENSIONS[activeFormat];
  const baseName =
    fileNameConfig.style === 'custom' && fileNameConfig.customName.trim() !== ''
      ? fileNameConfig.customName.trim()
      : SLIDE_FIT_SAMPLE_BASE_NAME;

  const handleDownload = useCallback(() => {
    void downloadSample(activeFormat, baseName).then((succeeded) => {
      if (!succeeded) return;
      useToastStore
        .getState()
        .addToast(t('binDesigner.slideTray.fitSample.exportComplete'), 'success', 3000);
      setOpen(false);
    });
  }, [downloadSample, activeFormat, baseName, t]);

  const tips = useMemo(
    () => [
      t('binDesigner.slideTray.fitSample.tip1'),
      t('binDesigner.slideTray.fitSample.tip2'),
      t('binDesigner.slideTray.fitSample.tip3'),
    ],
    [t]
  );

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => setOpen(true)}
        disabled={!canExport}
      >
        {t('binDesigner.slideTray.fitSample.button')}
      </Button>

      <ExportDialog
        open={open}
        onClose={() => setOpen(false)}
        activeFormat={activeFormat}
        fileNameConfig={fileNameConfig}
        onFileNameConfigChange={setFileNameConfig}
        fileName={`${baseName}${displayExtension}`}
        displayExtension={displayExtension}
        canExport={canExport}
        isExporting={isExporting}
        onDownload={handleDownload}
        sectionTitle={t('binDesigner.slideTray.fitSample.dialogTitle')}
        sectionDescription={t('binDesigner.slideTray.fitSample.dialogDescription')}
        extras={
          <div className="mb-4 rounded-lg border border-stroke-subtle bg-surface p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
              {t('binDesigner.slideTray.fitSample.tipsTitle')}
            </h3>
            <ul className="space-y-1 text-xs text-content-secondary">
              {tips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span aria-hidden="true" className="text-content-tertiary">
                    •
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        }
      />
    </>
  );
}
