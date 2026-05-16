/**
 * Shared export dialog for downloading 3D model files.
 *
 * Props-driven component used by both the bin designer and baseplate generator.
 * Renders format selector, editable filename with style switcher, optional
 * split export banner, optional print estimates, progress bar, and download
 * button(s).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Dialog } from '@/design-system/Dialog';
import { ProgressBar } from '@/design-system/ProgressBar';
import { useTranslation } from '@/i18n';
import type { ExportFileFormat, ExportFileNameConfig, FileNameStyle } from '@/shared/types/bin';

/** Ordered format options for the selector */
const FORMAT_OPTIONS: readonly ExportFileFormat[] = ['3mf', 'stl', 'step'] as const;

/** Display labels for each format (universal acronyms — not translated) */
const FORMAT_LABELS: Record<ExportFileFormat, string> = {
  stl: 'STL',
  step: 'STEP',
  '3mf': '3MF',
};

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;

  /** Active export format */
  activeFormat: ExportFileFormat;

  /** Filename configuration */
  fileNameConfig: ExportFileNameConfig;
  onFileNameConfigChange: (config: ExportFileNameConfig) => void;
  /** Resolved filename including extension (e.g. 'gridfinity-baseplate-8x6.stl'). Extension is stripped for display; use displayExtension for the suffix badge. */
  fileName: string;
  /** Display extension, e.g. '.stl' or '.zip' */
  displayExtension: string;

  /** Whether download is possible */
  canExport: boolean;
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Trigger the primary download */
  onDownload: () => void;
  /** Override download button label */
  downloadLabel?: string;

  /** Optional progress for multi-piece exports */
  exportProgress?: { current: number; total: number } | null;

  /** Optional split export banner */
  splitBanner?: {
    message: string;
    checkboxLabel: string;
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
  } | null;

  /** Optional vertical-stack control (3MF only — STL/STEP have no instancing). */
  stackOptions?: {
    label: string;
    description?: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
  } | null;

  /**
   * Per-format availability. Disabled formats render greyed-out with the
   * supplied reason as a tooltip and are skipped during arrow-key navigation.
   * Callers gate via this when a format would silently drop data they care
   * about (e.g. STL for a multi-color bin).
   */
  formatStates?: Partial<Record<ExportFileFormat, { disabled?: boolean; reason?: string }>>;

  /** Optional print estimates */
  estimates?: readonly { label: string; value: string }[] | null;
  estimatesTitle?: string;
  estimatesDisclaimer?: string;

  /** Optional secondary download button (e.g. dividers) */
  secondaryDownload?: {
    label: string;
    isExporting: boolean;
    onClick: () => void;
    visible: boolean;
  } | null;

  /** Warning when no mesh is available */
  noMeshWarning?: string | null;

  /** Section header text */
  sectionTitle?: string;
  /** Section description text */
  sectionDescription?: string;
}

export function ExportDialog({
  open,
  onClose,
  activeFormat,
  fileNameConfig,
  onFileNameConfigChange,
  fileName,
  displayExtension,
  canExport,
  isExporting,
  onDownload,
  downloadLabel,
  exportProgress,
  splitBanner,
  stackOptions,
  formatStates,
  estimates,
  estimatesTitle,
  estimatesDisclaimer,
  secondaryDownload,
  noMeshWarning,
  sectionTitle,
  sectionDescription,
}: ExportDialogProps) {
  const t = useTranslation();
  const customInputRef = useRef<HTMLInputElement>(null);

  // The display name (without extension) for the input field
  const fileNameWithoutExt = useMemo(() => {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  }, [fileName]);

  const handleStyleChange = useCallback(
    (style: FileNameStyle) => {
      if (style === 'custom' && fileNameConfig.customName === '') {
        onFileNameConfigChange({ ...fileNameConfig, style, customName: fileNameWithoutExt });
      } else {
        onFileNameConfigChange({ ...fileNameConfig, style });
      }
    },
    [fileNameConfig, onFileNameConfigChange, fileNameWithoutExt]
  );

  const handleFormatChange = useCallback(
    (format: ExportFileFormat) => {
      onFileNameConfigChange({ ...fileNameConfig, format });
    },
    [fileNameConfig, onFileNameConfigChange]
  );

  const handleCustomNameChange = useCallback(
    (value: string) => {
      onFileNameConfigChange({ ...fileNameConfig, customName: value });
    },
    [fileNameConfig, onFileNameConfigChange]
  );

  // Focus custom input when switching to custom mode
  useEffect(() => {
    if (fileNameConfig.style === 'custom' && customInputRef.current) {
      customInputRef.current.focus();
      customInputRef.current.select();
    }
  }, [fileNameConfig.style]);

  const progressPercent =
    exportProgress && exportProgress.total > 0
      ? Math.round((exportProgress.current / exportProgress.total) * 100)
      : undefined;

  const resolvedDownloadLabel =
    downloadLabel ??
    (isExporting
      ? t('export.exporting')
      : t('export.downloadFormat', { format: activeFormat.toUpperCase() }));

  return (
    <Dialog.Root open={open} onClose={onClose} size="md">
      <Dialog.Header title={t('common.export')} />
      <Dialog.Body>
        <div className="pb-2">
          {/* Section Title */}
          {sectionTitle && (
            <>
              <h3 className="mb-1 text-sm font-semibold text-content">{sectionTitle}</h3>
              {sectionDescription && (
                <p className="mb-4 text-xs text-content-secondary">{sectionDescription}</p>
              )}
            </>
          )}

          {/* Format Selector */}
          <FormatSelector
            activeFormat={activeFormat}
            onChange={handleFormatChange}
            formatLabel={t('export.format')}
            formatStates={formatStates}
          />

          {/* File Name */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-content-secondary">
              {t('export.fileName')}
            </label>
            <div className="flex items-center rounded-md border border-stroke-subtle bg-surface">
              {fileNameConfig.style === 'custom' ? (
                <input
                  ref={customInputRef}
                  type="text"
                  value={fileNameConfig.customName}
                  onChange={(e) => handleCustomNameChange(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-content outline-none"
                  placeholder={t('export.filenamePlaceholder')}
                  aria-label={t('export.customFileName')}
                  maxLength={128}
                />
              ) : (
                <span
                  className="flex-1 cursor-text truncate px-3 py-2 text-sm text-content"
                  onClick={() => handleStyleChange('custom')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleStyleChange('custom');
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={t('export.customFileName')}
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
                active={fileNameConfig.style === 'descriptive'}
                onClick={() => handleStyleChange('descriptive')}
                label={t('export.nameStyle.descriptive')}
              />
              <NameStyleButton
                active={fileNameConfig.style === 'compact'}
                onClick={() => handleStyleChange('compact')}
                label={t('export.nameStyle.compact')}
              />
              <NameStyleButton
                active={fileNameConfig.style === 'custom'}
                onClick={() => handleStyleChange('custom')}
                label={t('export.nameStyle.custom')}
              />
            </div>
          </div>

          {/* Split Export Banner */}
          {splitBanner && (
            <div className="mb-4 rounded-lg border border-warning bg-warning-muted p-3">
              <p className="mb-2 text-xs text-warning">{splitBanner.message}</p>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={splitBanner.checked}
                  onChange={(e) => splitBanner.onCheckedChange(e.target.checked)}
                  className="h-4 w-4 rounded border-warning text-warning focus:ring-warning"
                />
                <span className="text-xs font-medium text-warning">
                  {splitBanner.checkboxLabel}
                </span>
              </label>
            </div>
          )}

          {/* Vertical Stacking */}
          {stackOptions && (
            <div className="mb-4">
              <label
                htmlFor="export-stack-copies"
                className="mb-2 block text-sm font-medium text-content-secondary"
              >
                {stackOptions.label}
              </label>
              <input
                id="export-stack-copies"
                type="number"
                min={stackOptions.min}
                max={stackOptions.max}
                step={1}
                value={stackOptions.value}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  if (Number.isFinite(next)) {
                    stackOptions.onChange(
                      Math.max(stackOptions.min, Math.min(stackOptions.max, next))
                    );
                  }
                }}
                className="w-24 rounded-md border border-stroke-subtle bg-surface px-3 py-2 text-sm text-content outline-none focus:border-stroke"
              />
              {stackOptions.description && (
                <p className="mt-1 text-xs text-content-secondary">{stackOptions.description}</p>
              )}
            </div>
          )}

          {/* Export Progress */}
          {exportProgress && (
            <div className="mb-4">
              <div className="mb-1.5 text-xs text-content-secondary">
                {t('export.progressLabel', {
                  current: exportProgress.current,
                  total: exportProgress.total,
                })}
              </div>
              <ProgressBar
                value={progressPercent}
                size="sm"
                label={t('export.progressLabel', {
                  current: exportProgress.current,
                  total: exportProgress.total,
                })}
              />
            </div>
          )}

          {/* Print Estimates */}
          {estimates && estimates.length > 0 && (
            <div className="mb-5 rounded-lg border border-stroke-subtle bg-surface p-3">
              {estimatesTitle && (
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
                  {estimatesTitle}
                </h3>
              )}
              <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                {estimates.map((est) => (
                  <EstimateRow key={est.label} label={est.label} value={est.value} />
                ))}
              </div>
              {estimatesDisclaimer && (
                <p className="mt-2 text-[10px] text-content-disabled">{estimatesDisclaimer}</p>
              )}
            </div>
          )}

          {/* Primary Download Button */}
          <button
            onClick={onDownload}
            disabled={!canExport || isExporting}
            aria-busy={isExporting || undefined}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-info px-4 py-2.5 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-content-disabled"
          >
            {isExporting && !exportProgress && <ExportSpinner />}
            {resolvedDownloadLabel}
          </button>

          {/* Secondary Download Button */}
          {secondaryDownload?.visible && (
            <button
              onClick={secondaryDownload.onClick}
              disabled={isExporting || secondaryDownload.isExporting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-info bg-transparent px-4 py-2.5 text-sm font-medium text-info transition-colors hover:bg-info-muted disabled:cursor-not-allowed disabled:border-stroke-subtle disabled:text-content-disabled"
            >
              {secondaryDownload.isExporting && <ExportSpinner />}
              {secondaryDownload.label}
            </button>
          )}

          {/* No mesh warning */}
          {noMeshWarning && !canExport && (
            <p className="mt-2 text-center text-xs text-warning">{noMeshWarning}</p>
          )}
        </div>
      </Dialog.Body>
    </Dialog.Root>
  );
}
function FormatSelector({
  activeFormat,
  onChange,
  formatLabel,
  formatStates,
}: {
  activeFormat: ExportFileFormat;
  onChange: (format: ExportFileFormat) => void;
  formatLabel: string;
  formatStates?: Partial<Record<ExportFileFormat, { disabled?: boolean; reason?: string }>>;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const isDisabled = useCallback(
    (fmt: ExportFileFormat) => formatStates?.[fmt]?.disabled === true,
    [formatStates]
  );

  // Pick the next enabled index when arrow-stepping. Returns currentIndex if
  // no other format is enabled (no-op rather than focus-trap escape).
  const findNextEnabled = useCallback(
    (from: number, dir: 1 | -1): number => {
      for (let i = 1; i <= FORMAT_OPTIONS.length; i++) {
        const idx = (from + dir * i + FORMAT_OPTIONS.length) % FORMAT_OPTIONS.length;
        if (!isDisabled(FORMAT_OPTIONS[idx])) return idx;
      }
      return from;
    },
    [isDisabled]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = FORMAT_OPTIONS.indexOf(activeFormat);
      let nextIndex: number;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        nextIndex = findNextEnabled(currentIndex, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        nextIndex = findNextEnabled(currentIndex, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = findNextEnabled(-1, 1);
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = findNextEnabled(FORMAT_OPTIONS.length, -1);
      } else {
        return;
      }

      if (nextIndex === currentIndex) return;
      onChange(FORMAT_OPTIONS[nextIndex]);
      const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons?.[nextIndex]?.focus();
    },
    [activeFormat, onChange, findNextEnabled]
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
          const disabled = isDisabled(fmt);
          const reason = formatStates?.[fmt]?.reason;
          return (
            <button
              key={fmt}
              type="button"
              role="radio"
              tabIndex={isActive ? 0 : -1}
              aria-checked={isActive}
              aria-disabled={disabled || undefined}
              onClick={() => {
                if (!disabled) onChange(fmt);
              }}
              title={disabled ? reason : undefined}
              className={`rounded-md px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                disabled
                  ? 'cursor-not-allowed bg-surface text-content-disabled opacity-50'
                  : isActive
                    ? 'bg-accent-muted text-accent'
                    : 'bg-surface text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {FORMAT_LABELS[fmt]}
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
