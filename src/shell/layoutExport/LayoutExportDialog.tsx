/**
 * Dialog for exporting the whole active layout (linked bins + baseplate) as a
 * ZIP. Reuses the shared ExportDialog: the filename field names the ZIP archive,
 * while the per-file names inside come from each linked design.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useTranslation } from '@/i18n';
import { ExportDialog } from '@/shared/components/ExportDialog';
import type { ExportFileFormat, ExportFileNameConfig } from '@/shared/types/bin';
import { getLinkedBins } from '@/features/design-linking';
import { useLayoutExport } from './useLayoutExport';

function sanitizeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-z0-9-_ ]+/gi, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'layout';
}

interface LayoutExportDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function LayoutExportDialog({ open, onClose }: LayoutExportDialogProps) {
  const t = useTranslation();
  const { bins, layoutName } = useLayoutStore(
    useShallow((s) => ({ bins: s.layout.bins, layoutName: s.layout.name }))
  );
  const { isExporting, exportProgress, exportLayout } = useLayoutExport();

  const [config, setConfig] = useState<ExportFileNameConfig>({
    style: 'descriptive',
    customName: '',
    format: 'stl',
  });
  const format: ExportFileFormat = config.format ?? 'stl';

  const linkedCount = useMemo(() => getLinkedBins(bins).length, [bins]);
  const totalCount = bins.length;
  const skipped = totalCount - linkedCount;

  const zipBaseName =
    config.style === 'custom' && config.customName.trim()
      ? sanitizeName(config.customName)
      : sanitizeName(layoutName);

  const handleDownload = useCallback(async () => {
    const ok = await exportLayout(format, zipBaseName, config);
    if (ok) onClose();
  }, [exportLayout, format, zipBaseName, config, onClose]);

  // Don't let the dialog close mid-export — the work would finish and download
  // a file the user appeared to cancel.
  const handleClose = useCallback(() => {
    if (!isExporting) onClose();
  }, [isExporting, onClose]);

  return (
    <ExportDialog
      open={open}
      onClose={handleClose}
      activeFormat={format}
      fileNameConfig={config}
      onFileNameConfigChange={setConfig}
      fileName={`${zipBaseName}.zip`}
      displayExtension=".zip"
      canExport={linkedCount > 0 && !isExporting}
      isExporting={isExporting}
      onDownload={handleDownload}
      downloadLabel={t('layoutExport.download')}
      exportProgress={exportProgress}
      sectionTitle={t('layoutExport.title')}
      sectionDescription={t('layoutExport.description')}
      warningBanner={
        skipped > 0
          ? { message: t('layoutExport.skippedNotice', { total: totalCount, skipped }) }
          : null
      }
      noMeshWarning={linkedCount === 0 ? t('layoutExport.noLinkedBins') : null}
    />
  );
}
