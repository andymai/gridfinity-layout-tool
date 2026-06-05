/**
 * Bin designer export dialog — thin wrapper around the shared ExportDialog.
 *
 * Reads bin-designer-specific state (params, estimates, split info)
 * from Zustand stores and maps them to the shared dialog's props interface.
 *
 * Dividers are automatically included in the export when present —
 * there is no separate divider download button.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { computeActiveZones, isSingleColor } from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { SlicerHandoffPreview } from './SlicerHandoffPreview';
import { formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { getSTLFileSize, estimate3MFFileSize } from '@/shared/generation/export';
import { useToastStore } from '@/core/store/toast';
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
    engineReady,
    hasDividers,
    estimates,
    isExporting,
    isExportingBin,
    exportProgress: exportFraction,
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

  // A design is multi-color when the per-design toggle is on AND its currently
  // active zones do not all share the body color. STL and STEP silently drop
  // this color data, so we steer the user toward 3MF.
  const isMultiColor = useMemo(() => {
    if (!params.featureColors.enabled) return false;
    return !isSingleColor(params.featureColors, computeActiveZones(params));
  }, [params]);

  // Auto-switch to 3MF the first time the dialog opens on a multi-color
  // design with a colorless format selected. Tracked by a ref so we only
  // do it on the open transition, not while the user is inside the dialog
  // (they may deliberately pick STL/STEP after seeing the disabled state).
  const prevOpenRef = useRef(exportDialogOpen);
  useEffect(() => {
    const justOpened = exportDialogOpen && !prevOpenRef.current;
    prevOpenRef.current = exportDialogOpen;
    if (
      justOpened &&
      isMultiColor &&
      (exportFileNameConfig.format === 'stl' || exportFileNameConfig.format === 'step')
    ) {
      setExportFileNameConfig({ ...exportFileNameConfig, format: '3mf' });
    }
  }, [exportDialogOpen, isMultiColor, exportFileNameConfig, setExportFileNameConfig]);

  const formatStates = useMemo(() => {
    if (!isMultiColor) return undefined;
    const stlReason = t('binDesigner.export.multiColor.formatDisabled', { format: 'STL' });
    const stepReason = t('binDesigner.export.multiColor.formatDisabled', { format: 'STEP' });
    return {
      stl: { disabled: true, reason: stlReason },
      step: { disabled: true, reason: stepReason },
    } as const;
  }, [isMultiColor, t]);

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
    // The hook owns error handling end-to-end (telemetry + Retry/Report
    // toast + captureException with rich bin context). We gate the success
    // toast and dialog close on the boolean result instead of try/catch —
    // resolution alone does not imply success since the hook returns false
    // on caught failures and on engine-warmup queueing.
    const succeeded = useSplitExport
      ? await downloadSplit(activeFormat, exportFileNameConfig, designName)
      : await downloadBin(activeFormat, exportFileNameConfig, designName);

    if (!succeeded) return;

    addToast({
      message: useSplitExport
        ? t('binDesigner.splitExport.success', { count: splitPieceCount })
        : t('binDesigner.exportSuccess', { format: activeFormat.toUpperCase() }),
      type: 'success',
      duration: 3000,
    });
    closeDialog();
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
  ]);

  let downloadLabel: string;
  if (isExportingBin) {
    downloadLabel = t('binDesigner.exporting');
  } else if (!engineReady) {
    // Surface engine warmup so users don't think the button is broken.
    // The hook will queue the click and replay it once the engine is ready.
    downloadLabel = t('binDesigner.export.engine.preparing');
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
      canExport={canExport && engineReady}
      isExporting={isExporting}
      exportProgress={
        isExportingBin
          ? {
              current: Math.round(exportFraction * 100),
              total: 100,
              label: t('binDesigner.exporting'),
            }
          : null
      }
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
      formatStates={formatStates}
      warningBanner={
        useSplitExport && isMultiColor
          ? { message: t('binDesigner.splitExport.colorLossWarning') }
          : null
      }
      extras={
        isMultiColor && activeFormat === '3mf' && !useSplitExport ? (
          <SlicerHandoffPreview
            featureColors={params.featureColors}
            activeZones={computeActiveZones(params)}
            zoneLabels={
              {
                body: t('binDesigner.colors.body'),
                'lip:frontLeft': `${t('binDesigner.colors.lip')} · ${t('binDesigner.colors.lip.frontLeft')}`,
                'lip:frontRight': `${t('binDesigner.colors.lip')} · ${t('binDesigner.colors.lip.frontRight')}`,
                'lip:backRight': `${t('binDesigner.colors.lip')} · ${t('binDesigner.colors.lip.backRight')}`,
                'lip:backLeft': `${t('binDesigner.colors.lip')} · ${t('binDesigner.colors.lip.backLeft')}`,
                labelTab: t('binDesigner.colors.labelTab'),
                base: t('binDesigner.colors.base'),
                scoop: t('binDesigner.colors.scoop'),
                dividers: t('binDesigner.colors.dividers'),
                text: t('binDesigner.colors.text'),
                lid: t('binDesigner.colors.lid'),
              } satisfies Record<ColorZone, string>
            }
          />
        ) : null
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
