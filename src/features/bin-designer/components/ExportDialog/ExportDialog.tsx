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
import { zoneLabel } from '@/features/bin-designer/utils/zoneLabels';
import { SlicerHandoffPreview } from './SlicerHandoffPreview';
import { formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import {
  hasSeenPublishNudge,
  markPublishNudgeSeen,
} from '@/features/bin-designer/utils/publishNudge';
import { useCommunityPublishEntry } from '@/features/bin-designer/hooks/useCommunityPublish';
import { loadDesign } from '@/features/bin-designer/storage/DesignerStorage';
import { designId } from '@/core/types';
import { isOk } from '@/core/result';
import { getSTLFileSize, estimate3MFFileSize } from '@/shared/generation/export';
import { hasMeshImprints } from '@/shared/generation/meshAsset';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';
import {
  ExportDialog as SharedExportDialog,
  ExportSupportPrompt,
  recordExportAndShouldPromptSupport,
} from '@/shared/components/ExportDialog';
import type { ExportFileFormat } from '@/features/bin-designer/types';

/** File extension display for each format (split ZIP overrides STL) */
/** Longer than the routine 3s export toast: this one carries an action. */
const PUBLISH_NUDGE_DURATION_MS = 10000;

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
  const { publishVisible, canPublish, openPublish } = useCommunityPublishEntry();
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
  const [justExported, setJustExported] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const closeDialog = useCallback(() => {
    setJustExported(false);
    setExportDialogOpen(false);
  }, [setExportDialogOpen]);

  const activeFormat: ExportFileFormat = exportFileNameConfig.format ?? 'stl';
  const useSplitExport = needsSplit && splitEnabled;

  // A design is multi-color when the per-design toggle is on AND its currently
  // active zones do not all share the body color. STL and STEP silently drop
  // this color data, so we steer the user toward 3MF.
  const isMultiColor = useMemo(() => {
    if (!params.featureColors.enabled) return false;
    return !isSingleColor(params.featureColors, computeActiveZones(params));
  }, [params]);

  // A mesh imprint is carved out of the tessellated mesh, after the BREP solid
  // exists, so there is no solid that describes the design and `binExporter`
  // refuses STEP outright. Left selectable it reads as an ordinary option and
  // fails at download with an error toast and a filed issue (#3449).
  const hasImprints = useMemo(() => hasMeshImprints(params), [params]);

  // Auto-switch away from a format this design cannot produce, on the open
  // transition only — tracked by a ref so we don't fight the user while they
  // are inside the dialog (they may deliberately land on a disabled format to
  // read why). Multi-color prefers 3MF, which is the format that carries the
  // colors; an imprint only rules out STEP, so STL is the smaller move.
  const prevOpenRef = useRef(exportDialogOpen);
  useEffect(() => {
    const justOpened = exportDialogOpen && !prevOpenRef.current;
    prevOpenRef.current = exportDialogOpen;
    // Re-opening the dialog always returns to the form, never a stale success view.
    if (!justOpened) return;
    setJustExported(false);
    const format = exportFileNameConfig.format;
    if (isMultiColor && (format === 'stl' || format === 'step')) {
      setExportFileNameConfig({ ...exportFileNameConfig, format: '3mf' });
    } else if (hasImprints && format === 'step') {
      setExportFileNameConfig({ ...exportFileNameConfig, format: 'stl' });
    }
  }, [exportDialogOpen, isMultiColor, hasImprints, exportFileNameConfig, setExportFileNameConfig]);

  const formatStates = useMemo(() => {
    if (!isMultiColor && !hasImprints) return undefined;
    // Both conditions disable STEP; multi-color's reason wins because it also
    // disables STL, so the two chips read as one consistent explanation.
    const states: Partial<Record<ExportFileFormat, { disabled: boolean; reason: string }>> = {};
    if (hasImprints) {
      states.step = { disabled: true, reason: t('binDesigner.export.meshImprint.stepDisabled') };
    }
    if (isMultiColor) {
      states.stl = {
        disabled: true,
        reason: t('binDesigner.export.multiColor.formatDisabled', { format: 'STL' }),
      };
      states.step = {
        disabled: true,
        reason: t('binDesigner.export.multiColor.formatDisabled', { format: 'STEP' }),
      };
    }
    return states;
  }, [isMultiColor, hasImprints, t]);

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

  // Offered after the export rather than beside it: an export is the moment a
  // design is finished enough to be worth sharing. Skipped entirely when the
  // support prompt takes the success view — two asks on one action is one ask
  // too many — and never shown for a design that is already published.
  const offerPublish = useCallback(async () => {
    if (!publishVisible || !canPublish || hasSeenPublishNudge()) return;
    const activeId = useDesignerStore.getState().currentDesignId;
    if (activeId === null) return;
    const saved = await loadDesign(designId(activeId));
    if (isOk(saved) && saved.value.publishedId) return;

    markPublishNudgeSeen();
    addToast({
      message: t('community.publishNudge.message'),
      type: 'info',
      duration: PUBLISH_NUDGE_DURATION_MS,
      action: { label: t('community.publishNudge.action'), onClick: openPublish },
    });
  }, [publishVisible, canPublish, addToast, openPublish, t]);

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

    // Split exports always surface their piece count, support view or not.
    if (useSplitExport) {
      addToast({
        message: t('binDesigner.splitExport.success', { count: splitPieceCount }),
        type: 'success',
        duration: 3000,
      });
    }

    // The support view is reserved for returning makers (2nd+ export), at most
    // once per cooldown; everyone else just gets the low-friction auto-close.
    if (recordExportAndShouldPromptSupport()) {
      setJustExported(true);
      return;
    }

    if (!useSplitExport) {
      addToast({ message: t('export.complete'), type: 'success', duration: 3000 });
    }
    closeDialog();
    void offerPublish();
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
    offerPublish,
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
        needsSplit
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
            zoneLabel={(zone) => zoneLabel(zone, t, params.featureColors.lip.bands)}
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
      exported={justExported}
      successContent={
        <ExportSupportPrompt
          fileName={`${fileName.replace(/\.[^/.]+$/, '')}${displayExtension}`}
          onDone={closeDialog}
          source="bin_designer_export"
        />
      }
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
