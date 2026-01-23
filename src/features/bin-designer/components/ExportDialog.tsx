/**
 * Export dialog for the bin designer.
 *
 * Shows export format options, file name preview, print estimates,
 * and a download button. Only STL is available in Alpha; others
 * are shown as "coming soon" placeholders.
 */

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { formatPrintTime, formatFilament } from '@/features/bin-designer/utils/printEstimates';
import type { FileNameStyle } from '@/features/bin-designer/utils/fileNaming';
import { generateFileName } from '@/features/bin-designer/utils/fileNaming';
import { getSTLFileSize } from '@/features/generation/export/stlExporter';

export function ExportDialog() {
  const { exportDialogOpen, params, triangleCount } = useDesignerStore(
    useShallow((state) => ({
      exportDialogOpen: state.ui.exportDialogOpen,
      params: state.params,
      triangleCount: state.generation.mesh?.vertices
        ? state.generation.mesh.vertices.length / 9
        : 0,
    }))
  );
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);

  const { canExport, estimates, isExporting, downloadSTL } = useExport();
  const [nameStyle, setNameStyle] = useState<FileNameStyle>('descriptive');

  if (!exportDialogOpen) return null;

  const fileName = generateFileName(params, 'stl', nameStyle);
  const fileSizeBytes = getSTLFileSize(triangleCount);
  const fileSizeLabel = fileSizeBytes < 1024
    ? `${fileSizeBytes} B`
    : `${Math.round(fileSizeBytes / 1024)} KB`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) setExportDialogOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="mx-4 w-full max-w-md rounded-xl bg-surface-elevated p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 id="export-dialog-title" className="text-lg font-semibold text-content">
            Export Bin
          </h2>
          <button
            onClick={() => setExportDialogOpen(false)}
            className="rounded-md p-1 text-content-tertiary hover:bg-surface-hover hover:text-content-secondary"
            aria-label="Close export dialog"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Format Selection */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-content-secondary">Format</label>
          <div className="grid grid-cols-3 gap-2">
            <FormatOption label="STL" active description="Binary STL mesh" />
            <FormatOption label="STEP" disabled description="Coming soon" />
            <FormatOption label="3MF" disabled description="Coming soon" />
          </div>
        </div>

        {/* File Name */}
        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-content-secondary">File Name</label>
          <div className="rounded-md border border-stroke-subtle bg-surface px-3 py-2">
            <code className="break-all text-sm text-content">{fileName}</code>
          </div>
          <div className="mt-2 flex gap-2">
            <NameStyleButton
              active={nameStyle === 'descriptive'}
              onClick={() => setNameStyle('descriptive')}
              label="Descriptive"
            />
            <NameStyleButton
              active={nameStyle === 'compact'}
              onClick={() => setNameStyle('compact')}
              label="Compact"
            />
          </div>
        </div>

        {/* Print Estimates */}
        <div className="mb-5 rounded-lg border border-stroke-subtle bg-surface p-3">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-tertiary">
            Print Estimates (PLA)
          </h3>
          <div className="grid grid-cols-2 gap-y-1.5 text-sm">
            <EstimateRow label="Filament" value={formatFilament(estimates.metersFilament)} />
            <EstimateRow label="Weight" value={`${estimates.gramsFilament}g`} />
            <EstimateRow label="Time" value={formatPrintTime(estimates.printTimeMinutes)} />
            <EstimateRow label="Cost" value={`$${estimates.costUSD.toFixed(2)}`} />
            <EstimateRow label="Triangles" value={triangleCount.toLocaleString()} />
            <EstimateRow label="File Size" value={fileSizeLabel} />
          </div>
        </div>

        {/* Download Button */}
        <button
          onClick={() => downloadSTL(nameStyle)}
          disabled={!canExport || isExporting}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-content-disabled"
        >
          {isExporting ? 'Exporting…' : 'Download STL'}
        </button>

        {!canExport && (
          <p className="mt-2 text-center text-xs text-warning">
            Generate a mesh first to enable export
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormatOption({
  label,
  active,
  disabled,
  description,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  description: string;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center ${
        active
          ? 'border-accent bg-accent-muted text-accent'
          : disabled
            ? 'cursor-not-allowed border-stroke-subtle bg-surface text-content-disabled'
            : 'border-stroke-subtle text-content-secondary'
      }`}
    >
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs">{description}</div>
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
