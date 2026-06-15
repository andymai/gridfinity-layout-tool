/**
 * "Print fit sample" control for the vertical-stack section.
 *
 * Opens the shared ExportDialog to download a single stack of two 1×1 plates so
 * makers can dial in the air-gap separation before printing a full stack. STEP
 * is disabled — stacking is a print arrangement, not a CAD interchange concept.
 */

import { useCallback, useState } from 'react';
import { Button } from '@/design-system/Button';
import { LayoutGridIcon } from '@/design-system/Icon';
import { ExportDialog } from '@/shared/components/ExportDialog';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import { useStackSampleExport, STACK_SAMPLE_BASE_NAME } from '../../hooks/useStackSampleExport';
import { FORMAT_EXTENSIONS } from '@/shared/generation/exportUtils';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';

export function StackSampleButton() {
  const t = useTranslation();
  const { isExporting, canExport, downloadSample } = useStackSampleExport();

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
      : STACK_SAMPLE_BASE_NAME;

  const handleDownload = useCallback(() => {
    void downloadSample(activeFormat, baseName).then((succeeded) => {
      if (!succeeded) return;
      useToastStore
        .getState()
        .addToast(t('baseplate.stackPrint.sampleExportComplete'), 'success', 3000);
      setOpen(false);
    });
  }, [downloadSample, activeFormat, baseName, t]);

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
        {t('baseplate.stackPrint.sampleButton')}
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
        sectionTitle={t('baseplate.stackPrint.sampleTitle')}
        sectionDescription={t('baseplate.stackPrint.sampleDescription')}
        formatStates={{ step: { disabled: true } }}
      />
    </>
  );
}
