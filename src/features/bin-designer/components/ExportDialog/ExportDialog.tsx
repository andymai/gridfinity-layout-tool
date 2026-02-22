/**
 * Export dialog for the bin designer.
 *
 * Shows export format selector (STL / STEP / 3MF), editable file name with
 * style selection (Descriptive / Compact / Custom), print estimates, and
 * download buttons. Format and filename preferences are persisted per-design.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useSettingsStore } from '@/core/store';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { useSlicerOpen } from '@/features/bin-designer/hooks/useSlicerOpen';
import { formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import type { FileNameStyle, ExportFileFormat } from '@/features/bin-designer/types';
import type { SlicerSite } from '@/core/store/settings';
import { getSTLFileSize, estimate3MFFileSize } from '@/shared/generation/export';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';

/** File extension display for each format (split ZIP overrides STL) */
const FORMAT_EXTENSIONS: Record<ExportFileFormat, string> = {
  stl: '.stl',
  step: '.step',
  '3mf': '.3mf',
};

/** Ordered format options for the selector */
const FORMAT_OPTIONS: readonly ExportFileFormat[] = ['stl', 'step', '3mf'] as const;

/** Display labels for each format (file format names are universal acronyms) */
const FORMAT_LABELS: Record<ExportFileFormat, string> = { stl: 'STL', step: 'STEP', '3mf': '3MF' };

export function ExportDialog() {
  const t = useTranslation();
  const { printSettings, defaultPrintBedSize, slicerSites } = useSettingsStore(
    useShallow((s) => ({
      printSettings: s.settings.printSettings,
      defaultPrintBedSize: s.settings.defaultPrintBedSize,
      slicerSites: s.settings.slicerSites,
    }))
  );

  const enabledSlicers = useMemo(() => slicerSites.filter((s) => s.enabled), [slicerSites]);
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
    canExportDividers,
    estimates,
    isExporting,
    downloadBin,
    downloadDividersSTL,
    needsSplit,
    splitPieceCount,
    downloadSplitSTL,
  } = useExport();
  const { isOpening, openingSlicerId, openInSlicer } = useSlicerOpen();
  const [splitEnabled, setSplitEnabled] = useState(true);
  const addToast = useToastStore((s) => s.addToast);

  const closeDialog = useCallback(() => setExportDialogOpen(false), [setExportDialogOpen]);
  const dialogRef = useFocusTrap({
    active: exportDialogOpen,
    onEscape: closeDialog,
  });

  const customInputRef = useRef<HTMLInputElement>(null);

  // Resolve format with backward-compatible default
  const activeFormat: ExportFileFormat = exportFileNameConfig.format ?? 'stl';

  // Split export is only available for STL format
  const showSplitBanner = needsSplit && activeFormat === 'stl';
  const useSplitExport = showSplitBanner && splitEnabled;

  // Focus the custom input when switching to custom mode
  useEffect(() => {
    if (exportFileNameConfig.style === 'custom' && customInputRef.current) {
      customInputRef.current.focus();
      customInputRef.current.select();
    }
  }, [exportFileNameConfig.style]);

  const fileName = useMemo(
    () => generateFileName(params, activeFormat, exportFileNameConfig, designName),
    [params, activeFormat, exportFileNameConfig, designName]
  );

  // The display name (without extension) for the input field
  const fileNameWithoutExt = useMemo(() => {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  }, [fileName]);

  const handleStyleChange = useCallback(
    (style: FileNameStyle) => {
      if (style === 'custom' && exportFileNameConfig.customName === '') {
        // Pre-fill custom name with current auto-generated name (without extension)
        setExportFileNameConfig({ ...exportFileNameConfig, style, customName: fileNameWithoutExt });
      } else {
        setExportFileNameConfig({ ...exportFileNameConfig, style });
      }
    },
    [exportFileNameConfig, setExportFileNameConfig, fileNameWithoutExt]
  );

  const handleFormatChange = useCallback(
    (format: ExportFileFormat) => {
      setExportFileNameConfig({ ...exportFileNameConfig, format });
    },
    [exportFileNameConfig, setExportFileNameConfig]
  );

  const handleCustomNameChange = useCallback(
    (value: string) => {
      setExportFileNameConfig({ ...exportFileNameConfig, customName: value });
    },
    [exportFileNameConfig, setExportFileNameConfig]
  );

  if (!exportDialogOpen) return null;

  // Dynamic file size based on selected format
  const fileSizeLabel = getFileSizeLabel(activeFormat, triangleCount);

  // File extension shown in the filename preview
  const displayExtension = useSplitExport ? '.zip' : FORMAT_EXTENSIONS[activeFormat];

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDialog();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') closeDialog();
      }}
    >
      <div
        className="mx-4 w-full max-w-md max-h-[85vh] overflow-y-auto rounded-xl bg-surface-elevated p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 id="export-dialog-title" className="text-lg font-semibold text-content">
            {t('common.export')}
          </h2>
          <button
            onClick={() => setExportDialogOpen(false)}
            className="rounded-md p-1 text-content-tertiary hover:bg-surface-hover hover:text-content-secondary"
            aria-label={t('common.close')}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 3D Model Section */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-content">
            {t('binDesigner.threeDModel')}
          </h3>
          <p className="mb-4 text-xs text-content-secondary">
            {t('binDesigner.threeDModelDescription')}
          </p>

          {/* Format Selector */}
          <FormatSelector
            activeFormat={activeFormat}
            onChange={handleFormatChange}
            formatLabel={t('binDesigner.format')}
            labels={FORMAT_LABELS}
          />

          {/* File Name */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-content-secondary">
              {t('binDesigner.fileName')}
            </label>
            <div className="flex items-center rounded-md border border-stroke-subtle bg-surface">
              {exportFileNameConfig.style === 'custom' ? (
                <input
                  ref={customInputRef}
                  type="text"
                  value={exportFileNameConfig.customName}
                  onChange={(e) => handleCustomNameChange(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-content outline-none"
                  placeholder={t('binDesigner.filenamePlaceholder')}
                  aria-label={t('binDesigner.customFileName')}
                  maxLength={128}
                />
              ) : (
                <span
                  className="flex-1 cursor-text truncate px-3 py-2 text-sm text-content"
                  onClick={() => handleStyleChange('custom')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleStyleChange('custom');
                  }}
                  onFocus={() => handleStyleChange('custom')}
                  role="textbox"
                  tabIndex={0}
                  aria-readonly="true"
                  aria-label={t('binDesigner.customFileName')}
                >
                  {fileNameWithoutExt}
                </span>
              )}
              <span className="shrink-0 border-l border-stroke-subtle px-2 py-2 text-sm text-content-tertiary">
                {displayExtension}
              </span>
            </div>
            <div className="mt-2 flex gap-2">
              <NameStyleButton
                active={exportFileNameConfig.style === 'descriptive'}
                onClick={() => handleStyleChange('descriptive')}
                label="Descriptive"
              />
              <NameStyleButton
                active={exportFileNameConfig.style === 'compact'}
                onClick={() => handleStyleChange('compact')}
                label="Compact"
              />
              <NameStyleButton
                active={exportFileNameConfig.style === 'custom'}
                onClick={() => handleStyleChange('custom')}
                label="Custom"
              />
            </div>
          </div>

          {/* Split Export Banner (STL only) */}
          {showSplitBanner && (
            <div className="mb-4 rounded-lg border border-warning bg-warning-muted p-3">
              <p className="mb-2 text-xs text-warning">
                {t('binDesigner.splitExport.exceedsPrintBed', {
                  size: defaultPrintBedSize,
                  count: splitPieceCount,
                })}
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={splitEnabled}
                  onChange={(e) => setSplitEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-warning text-warning focus:ring-warning"
                />
                <span className="text-xs font-medium text-warning">
                  {t('binDesigner.splitExport.enableSplit')}
                </span>
              </label>
            </div>
          )}

          {/* Print Estimates */}
          <div className="mb-5 rounded-lg border border-stroke-subtle bg-surface p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
              {t('binDesigner.printEstimatesPla')}
            </h3>
            <div className="grid grid-cols-2 gap-y-1.5 text-sm">
              <EstimateRow label="Filament" value={formatFilament(estimates.metersFilament)} />
              <EstimateRow label="Weight" value={`${estimates.gramsFilament}g`} />
              <EstimateRow label="Time" value={formatPrintTime(estimates.printTimeMinutes)} />
              <EstimateRow label="Cost" value={`$${estimates.costUSD.toFixed(2)}`} />
              <EstimateRow label="Triangles" value={triangleCount.toLocaleString()} />
              <EstimateRow label="File Size" value={fileSizeLabel} />
            </div>
            <p className="mt-2 text-[10px] text-content-disabled">
              {t('binDesigner.printEstimatesDisclaimer', {
                nozzle: printSettings.nozzleSizeMm,
                infill: printSettings.infillPercent,
                layerHeight: printSettings.layerHeightMm,
              })}
            </p>
          </div>

          {/* Primary Download Button */}
          <button
            onClick={async () => {
              try {
                if (useSplitExport) {
                  await downloadSplitSTL(exportFileNameConfig, designName);
                  addToast({
                    message: t('binDesigner.splitExport.success', { count: splitPieceCount }),
                    type: 'success',
                    duration: 3000,
                  });
                } else {
                  await downloadBin(activeFormat, exportFileNameConfig, designName);
                  addToast({
                    message: t('binDesigner.exportSuccess', {
                      format: activeFormat.toUpperCase(),
                    }),
                    type: 'success',
                    duration: 3000,
                  });
                }
                closeDialog();
              } catch {
                addToast({
                  message: t('binDesigner.exportFailed'),
                  type: 'error',
                  duration: 5000,
                });
              }
            }}
            disabled={!canExport || isExporting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-info px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-content-disabled"
          >
            {isExporting && <ExportSpinner />}
            {isExporting
              ? t('binDesigner.exporting')
              : useSplitExport
                ? t('binDesigner.splitExport.downloadSplitSTL')
                : t('binDesigner.downloadFormat', { format: activeFormat.toUpperCase() })}
          </button>

          {/* Download Dividers STL Button (slotted bins only, STL format) */}
          {canExportDividers && activeFormat === 'stl' && (
            <button
              onClick={async () => {
                try {
                  await downloadDividersSTL(exportFileNameConfig, designName);
                  addToast({
                    message: t('binDesigner.exportSuccess', { format: 'STL' }),
                    type: 'success',
                    duration: 3000,
                  });
                } catch {
                  addToast({
                    message: t('binDesigner.exportFailed'),
                    type: 'error',
                    duration: 5000,
                  });
                }
              }}
              disabled={isExporting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-info bg-transparent px-4 py-2.5 text-sm font-medium text-info transition-colors hover:bg-info-muted disabled:cursor-not-allowed disabled:border-stroke-subtle disabled:text-content-disabled"
            >
              {t('binDesigner.downloadDividersSTL')}
            </button>
          )}

          {!canExport && (
            <p className="mt-2 text-center text-xs text-warning">
              {t('binDesigner.generateAMeshFirstToEnableExport')}
            </p>
          )}
        </div>

        {/* Open in Slicer Section */}
        {enabledSlicers.length > 0 && (
          <div className="mt-5 border-t border-stroke-subtle pt-5">
            <h3 className="mb-3 text-sm font-semibold text-content">
              {t('binDesigner.openInSlicer')}
            </h3>
            <div className="flex flex-wrap gap-2">
              {enabledSlicers.map((slicer) => (
                <SlicerButton
                  key={slicer.id}
                  slicer={slicer}
                  disabled={!canExport || isExporting || isOpening}
                  isOpening={openingSlicerId === slicer.id}
                  onClick={() => openInSlicer(slicer)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute format-specific file size label for the estimates panel */
function getFileSizeLabel(format: ExportFileFormat, triangleCount: number): string {
  if (format === 'step') {
    // STEP is BREP data — file size depends on geometry complexity, not triangle count
    return '—';
  }

  const bytes =
    format === '3mf' ? estimate3MFFileSize(triangleCount) : getSTLFileSize(triangleCount);

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Accessible format radio group with roving tabindex and arrow key navigation */
function FormatSelector({
  activeFormat,
  onChange,
  formatLabel,
  labels,
}: {
  activeFormat: ExportFileFormat;
  onChange: (format: ExportFileFormat) => void;
  formatLabel: string;
  labels: Record<ExportFileFormat, string>;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = FORMAT_OPTIONS.indexOf(activeFormat);
      let nextIndex = currentIndex;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % FORMAT_OPTIONS.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = FORMAT_OPTIONS.length - 1;
      } else {
        return;
      }

      onChange(FORMAT_OPTIONS[nextIndex]);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[nextIndex]?.focus();
    },
    [activeFormat, onChange]
  );

  return (
    <div className="mb-4">
      <label className="mb-2 block text-sm font-medium text-content-secondary">{formatLabel}</label>
      <div
        ref={groupRef}
        className="flex gap-2"
        role="radiogroup"
        aria-label={formatLabel}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {FORMAT_OPTIONS.map((fmt) => {
          const isActive = fmt === activeFormat;
          const focusIndex = isActive ? 0 : -1;
          return (
            <button
              key={fmt}
              type="button"
              role="radio"
              tabIndex={focusIndex}
              aria-checked={isActive}
              onClick={() => onChange(fmt)}
              className={`rounded-md px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                isActive
                  ? 'bg-accent-muted text-accent'
                  : 'bg-surface text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {labels[fmt]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NameStyleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? 'bg-accent-muted text-accent'
          : 'bg-surface text-content-secondary hover:bg-surface-hover'
      }`}
    >
      {label}
    </button>
  );
}

function EstimateRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-content-tertiary">{label}</span>
      <span className="font-medium text-content">{value}</span>
    </>
  );
}

function ExportSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin motion-reduce:animate-none"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Button for a single slicer in the "Open in Slicer" section */
function SlicerButton({
  slicer,
  disabled,
  isOpening,
  onClick,
}: {
  slicer: SlicerSite;
  disabled: boolean;
  isOpening: boolean;
  onClick: () => void;
}) {
  const t = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 rounded-md border border-stroke-subtle bg-surface px-3 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:text-content-disabled"
      aria-label={`${t('binDesigner.openInSlicer')}: ${slicer.name}`}
    >
      {isOpening ? (
        <>
          <ExportSpinner />
          {t('slicerOpen.opening')}
        </>
      ) : (
        slicer.name
      )}
    </button>
  );
}
