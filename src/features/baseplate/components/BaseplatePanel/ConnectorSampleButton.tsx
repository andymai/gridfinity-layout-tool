/**
 * "Print fit sample" control for the baseplate connector section.
 *
 * Opens the shared ExportDialog to download a one-file calibration tray that
 * sweeps the selected connector style across a fit-offset ladder, so makers can
 * dial in the fit that clicks before committing to a full split baseplate.
 */

import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/design-system/Button';
import { LayoutGridIcon } from '@/design-system/Icon';
import { ExportDialog } from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import {
  useConnectorSampleExport,
  CONNECTOR_SAMPLE_BASE_NAME,
} from '../../hooks/useConnectorSampleExport';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';

export function ConnectorSampleButton() {
  const t = useTranslation();
  const { isExporting, canExport, downloadSample } = useConnectorSampleExport();

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
      : CONNECTOR_SAMPLE_BASE_NAME;

  const handleDownload = useCallback(() => {
    void downloadSample(activeFormat, baseName).then((succeeded) => {
      if (!succeeded) return;
      useToastStore
        .getState()
        .addToast(t('baseplate.connectorSample.exportComplete'), 'success', 3000);
      setOpen(false);
    });
  }, [downloadSample, activeFormat, baseName, t]);

  const tips = useMemo(
    () => [
      t('baseplate.connectorSample.tip1'),
      t('baseplate.connectorSample.tip2'),
      t('baseplate.connectorSample.tip3'),
      t('baseplate.connectorSample.tip4'),
    ],
    [t]
  );

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        leftIcon={<LayoutGridIcon className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        disabled={!canExport}
      >
        {t('baseplate.connectorSample.button')}
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
        sectionTitle={t('baseplate.connectorSample.dialogTitle')}
        sectionDescription={t('baseplate.connectorSample.dialogDescription')}
        extras={
          <div className="mb-4 rounded-lg border border-stroke-subtle bg-surface p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
              {t('baseplate.connectorSample.tipsTitle')}
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
