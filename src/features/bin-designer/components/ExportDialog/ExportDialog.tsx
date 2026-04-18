/**
 * Bin designer export dialog — thin wrapper around the shared ExportDialog.
 *
 * Reads bin-designer-specific state (params, estimates, split info)
 * from Zustand stores and maps them to the shared dialog's props interface.
 *
 * Dividers are automatically included in the export when present —
 * there is no separate divider download button.
 */

import { useCallback, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { getSTLFileSize, estimate3MFFileSize } from '@/shared/generation/export';
import { useToastStore } from '@/core/store/toast';
import { captureException } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';
import { ExportDialog as SharedExportDialog } from '@/shared/components/ExportDialog';
import type { ExportFileFormat } from '@/features/bin-designer/types';

/** File extension display for each format (split ZIP overrides STL) */
const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

export function ExportDialog() {
  const t = useTranslation();
  const { printSettings, defaultPrintBedSize } = useSettingsStore(
    useShallow((s) => ({
      printSettings: s.settings.printSettings,
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
    }))
  );

  const { exportDialogOpen, params, triangleCount, designName, exportFileNameConfig } =
    useDesignerStore(
      useShallow((state) => ({
        exportDialogOpen: state.ui.exportDialogOpen,
        params: state.params,
        triangleCount: state.generation.mesh?.indices
          ? state.generation.mesh.indices.length / 3
          : 0,
        designName: state.designName,
        exportFileNameConfig: state.exportFileNameConfig,
      }))
    );
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);
  const setExportFileNameConfig = useDesignerStore((s) => s.setExportFileNameConfig);

  const {
    canExport,
    hasDividers,
    estimates,
    isExporting,
    isExportingBin,
    downloadBin,
    needsSplit,
    splitPieceCount,
    downloadSplit,
  } = useExport();
  const [splitEnabled, setSplitEnabled] = useState(true);
  const addToast = useToastStore((s) => s.addToast);

  const closeDialog = useCallback(() => setExportDialogOpen(false), [setExportDialogOpen]);

  const activeFormat: ExportFileFormat = exportFileNameConfig.format ?? 'stl';
  const showSplitBanner = needsSplit && activeFormat !== 'step';
  const useSplitExport = showSplitBanner && splitEnabled;

  const fileName = useMemo(
    () => generateFileName(params, activeFormat, exportFileNameConfig, designName),
    [params, activeFormat, exportFileNameConfig, designName]
  );

  // STL + dividers = ZIP; split export = ZIP; otherwise format extension
  const displayExtension =
    useSplitExport || (activeFormat === 'stl' && hasDividers)
      ? '.zip'
      : FORMAT_EXTENSIONS[activeFormat];

  // Build estimates array for the shared dialog
  const fileSizeLabel = getFileSizeLabel(activeFormat, triangleCount);
  const estimateRows = useMemo(
    () => [
      {
        label: t('binDesigner.estimate.filament'),
        value: formatFilament(estimates.metersFilament),
      },
      { label: t('binDesigner.estimate.weight'), value: `${estimates.gramsFilament}g` },
      { label: t('binDesigner.estimate.time'), value: formatPrintTime(estimates.printTimeMinutes) },
      { label: t('binDesigner.estimate.cost'), value: `$${estimates.costUSD.toFixed(2)}` },
      { label: t('binDesigner.estimate.triangles'), value: triangleCount.toLocaleString() },
      { label: t('binDesigner.estimate.fileSize'), value: fileSizeLabel },
    ],
    [t, estimates, triangleCount, fileSizeLabel]
  );

  const handleDownload = useCallback(async () => {
    try {
      if (useSplitExport) {
        await downloadSplit(activeFormat, exportFileNameConfig, designName);
        addToast({
          message: t('binDesigner.splitExport.success', { count: splitPieceCount }),
          type: 'success',
          duration: 3000,
        });
        closeDialog();
        return;
      }
      await downloadBin(activeFormat, exportFileNameConfig, designName);
      addToast({
        message: t('binDesigner.exportSuccess', { format: activeFormat.toUpperCase() }),
        type: 'success',
        duration: 3000,
      });
      closeDialog();
    } catch (err) {
      // Report to PostHog FIRST so the toast path can't mask the capture.
      // Rich bin-config context makes it possible to reproduce from the
      // failure report — GH #1339 was only catchable manually because
      // this catch previously swallowed the error without telemetry.
      const error = err instanceof Error ? err : new Error(String(err));
      captureException(error, {
        source: 'bin_export',
        export_format: activeFormat,
        use_split_export: useSplitExport,
        split_piece_count: useSplitExport ? splitPieceCount : undefined,
        bin_width: params.width,
        bin_depth: params.depth,
        bin_height: params.height,
        bin_style: params.style,
        grid_unit_mm: params.gridUnitMm,
        has_lip: params.base.stackingLip,
        base_style: params.base.style,
        magnet_diameter: params.base.magnetDiameter,
        screw_diameter: params.base.screwDiameter,
        solid_fill: params.base.solid,
        half_sockets: params.base.halfSockets,
        wall_pattern_enabled: params.wallPattern.enabled,
        wall_pattern: params.wallPattern.pattern,
        handles_enabled: params.handles.enabled,
        has_dividers: hasDividers,
        cutout_count: params.cutouts.length,
        insert_count: params.inserts.length,
        // Include original error chain (from binExporter's retry path)
        // — the cause is set to the first-attempt error when retry fails.
        first_attempt_message: error.cause instanceof Error ? error.cause.message : undefined,
      });
      addToast({
        message: err instanceof Error ? err.message : t('binDesigner.exportFailed'),
        type: 'error',
        duration: 5000,
      });
    }
  }, [
    useSplitExport,
    downloadSplit,
    downloadBin,
    activeFormat,
    exportFileNameConfig,
    designName,
    splitPieceCount,
    addToast,
    closeDialog,
    t,
    params,
    hasDividers,
  ]);

  let downloadLabel: string;
  if (isExportingBin) {
    downloadLabel = t('binDesigner.exporting');
  } else if (useSplitExport) {
    downloadLabel = t('binDesigner.splitExport.downloadSplit', {
      format: activeFormat.toUpperCase(),
    });
  } else {
    downloadLabel = t('binDesigner.downloadFormat', { format: activeFormat.toUpperCase() });
  }

  return (
    <SharedExportDialog
      open={exportDialogOpen}
      onClose={closeDialog}
      activeFormat={activeFormat}
      fileNameConfig={exportFileNameConfig}
      onFileNameConfigChange={setExportFileNameConfig}
      fileName={fileName}
      displayExtension={displayExtension}
      canExport={canExport}
      isExporting={isExporting}
      onDownload={() => void handleDownload()}
      downloadLabel={downloadLabel}
      splitBanner={
        showSplitBanner
          ? {
              message: t('binDesigner.splitExport.exceedsPrintBed', {
                size: defaultPrintBedSize,
                count: splitPieceCount,
              }),
              checkboxLabel: t('binDesigner.splitExport.enableSplit'),
              checked: splitEnabled,
              onCheckedChange: setSplitEnabled,
            }
          : null
      }
      estimates={estimateRows}
      estimatesTitle={t('binDesigner.printEstimatesPla')}
      estimatesDisclaimer={t('binDesigner.printEstimatesDisclaimer', {
        nozzle: printSettings.nozzleSizeMm,
        infill: printSettings.infillPercent,
        layerHeight: printSettings.layerHeightMm,
      })}
      noMeshWarning={t('binDesigner.generateAMeshFirstToEnableExport')}
      sectionTitle={t('binDesigner.threeDModel')}
      sectionDescription={t('binDesigner.threeDModelDescription')}
    />
  );
}

function getFileSizeLabel(format: ExportFileFormat, triangleCount: number): string {
  if (format === 'step') return '—';
  const bytes =
    format === '3mf' ? estimate3MFFileSize(triangleCount) : getSTLFileSize(triangleCount);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
