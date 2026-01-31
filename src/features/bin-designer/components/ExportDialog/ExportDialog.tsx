/**
 * Export dialog for the bin designer.
 *
 * Shows export format options, editable file name with style selection
 * (Descriptive / Compact / Custom), print estimates, and a download button.
 * The filename preference is persisted per-design via the designer store.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { downloadDesignAsFile } from '@/features/bin-designer/utils/designJson';
import type { FileNameStyle } from '@/features/bin-designer/types';
import { getSTLFileSize } from '@/shared/generation/export';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useToastStore } from '@/core/store/toast';
import { useTranslation } from '@/i18n';

export function ExportDialog() {
  const t = useTranslation();
  const { exportDialogOpen, params, triangleCount, designName, exportFileNameConfig } =
    useDesignerStore(
      useShallow((state) => ({
        exportDialogOpen: state.ui.exportDialogOpen,
        params: state.params,
        triangleCount: state.generation.mesh?.vertices
          ? state.generation.mesh.vertices.length / 9
          : 0,
        designName: state.designName,
        exportFileNameConfig: state.exportFileNameConfig,
      }))
    );
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);
  const setExportFileNameConfig = useDesignerStore((s) => s.setExportFileNameConfig);

  const { canExport, estimates, isExporting, downloadSTL } = useExport();
  const addToast = useToastStore((s) => s.addToast);

  const closeDialog = useCallback(() => setExportDialogOpen(false), [setExportDialogOpen]);
  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: exportDialogOpen,
    onEscape: closeDialog,
  });

  const customInputRef = useRef<HTMLInputElement>(null);

  // Focus the custom input when switching to custom mode
  useEffect(() => {
    if (exportFileNameConfig.style === 'custom' && customInputRef.current) {
      customInputRef.current.focus();
      customInputRef.current.select();
    }
  }, [exportFileNameConfig.style]);

  const fileName = useMemo(
    () => generateFileName(params, 'stl', exportFileNameConfig, designName),
    [params, exportFileNameConfig, designName]
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
        setExportFileNameConfig({ style, customName: fileNameWithoutExt });
      } else {
        setExportFileNameConfig({ ...exportFileNameConfig, style });
      }
    },
    [exportFileNameConfig, setExportFileNameConfig, fileNameWithoutExt]
  );

  const handleCustomNameChange = useCallback(
    (value: string) => {
      setExportFileNameConfig({ ...exportFileNameConfig, customName: value });
    },
    [exportFileNameConfig, setExportFileNameConfig]
  );

  if (!exportDialogOpen) return null;

  const fileSizeBytes = getSTLFileSize(triangleCount);
  const fileSizeLabel =
    fileSizeBytes < 1024 ? `${fileSizeBytes} B` : `${Math.round(fileSizeBytes / 1024)} KB`;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDialog();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="mx-4 w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-2xl">
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

        {/* Section 1: Design File (.json) */}
        <div className="mb-5">
          {/* eslint-disable i18next/no-literal-string */}
          <h3 className="mb-1 text-sm font-semibold text-content">
            {t('binDesigner.designFile')} (.json)
          </h3>
          {/* eslint-enable i18next/no-literal-string */}
          <p className="mb-3 text-xs text-content-secondary">
            {t('binDesigner.designFileDescription')}
          </p>
          <button
            onClick={() => {
              downloadDesignAsFile(designName, params);
              addToast({
                message: t('binDesigner.downloadDesignJson') + ' ✓',
                type: 'success',
                duration: 2000,
              });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stroke-subtle bg-surface px-4 py-2.5 text-sm font-medium text-content transition-colors hover:bg-surface-hover"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            {t('binDesigner.downloadJSON')}
          </button>
        </div>

        {/* Visual Divider */}
        <div className="mb-5 border-t border-stroke-subtle" />

        {/* Section 2: 3D Model (.stl) */}
        <div>
          {/* eslint-disable i18next/no-literal-string */}
          <h3 className="mb-1 text-sm font-semibold text-content">
            {t('binDesigner.threeDModel')} (.stl)
          </h3>
          {/* eslint-enable i18next/no-literal-string */}
          <p className="mb-4 text-xs text-content-secondary">
            {t('binDesigner.threeDModelDescription')}
          </p>

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
                <span className="flex-1 truncate px-3 py-2 text-sm text-content">
                  {fileNameWithoutExt}
                </span>
              )}
              {/* eslint-disable-next-line i18next/no-literal-string */}
              <span className="shrink-0 border-l border-stroke-subtle px-2 py-2 text-sm text-content-tertiary">
                .stl
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
              Approximate values based on 15% infill, 0.2mm layers. Actual results depend on slicer
              settings.
            </p>
          </div>

          {/* Download STL Button */}
          <button
            onClick={async () => {
              try {
                await downloadSTL(exportFileNameConfig, designName);
                addToast({
                  message: t('binDesigner.stlExportedSuccessfully'),
                  type: 'success',
                  duration: 3000,
                });
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
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-content-disabled"
          >
            {isExporting && (
              <svg
                className="h-4 w-4 animate-spin motion-reduce:animate-none"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {isExporting ? t('binDesigner.exporting') : t('binDesigner.downloadSTL')}
          </button>

          {!canExport && (
            <p className="mt-2 text-center text-xs text-warning">
              {t('binDesigner.generateAMeshFirstToEnableExport')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

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
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
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
