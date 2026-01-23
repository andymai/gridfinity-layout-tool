/**
 * Bin Designer page layout.
 *
 * Two-column layout: left panel (parameter controls, 320px) + main area (3D preview).
 * On mobile (<768px), the parameter panel is shown as a full-width bottom area.
 * The useGeneration hook auto-generates mesh when parameters change.
 */

import { ParameterPanel } from '@/features/bin-designer/components/ParameterPanel';
import { PreviewCanvas } from '@/features/bin-designer/components/PreviewCanvas';
import { ExportDialog } from '@/features/bin-designer/components/ExportDialog';
import { useGeneration } from '@/features/bin-designer/hooks/useGeneration';
import { useDesignerStore } from '@/features/bin-designer/store/designer';

interface DesignerPageProps {
  onNavigateBack: () => void;
}

export function DesignerPage({ onNavigateBack }: DesignerPageProps) {
  // Initialize generation bridge - auto-generates mesh when params change
  useGeneration();

  const canExport = useDesignerStore(
    (s) => s.generation.mesh !== null &&
      s.generation.mesh.error === null &&
      s.generation.mesh.vertices !== null &&
      s.generation.mesh.normals !== null
  );
  const setExportDialogOpen = useDesignerStore((s) => s.setExportDialogOpen);

  return (
    <div className="flex h-screen flex-col bg-surface">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-stroke-subtle bg-surface-secondary px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-content-secondary hover:bg-surface-hover hover:text-content"
            aria-label="Back to Layout Planner"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <div className="h-5 w-px bg-stroke-subtle" />
          <h1 className="text-lg font-semibold text-content">Bin Designer</h1>
          <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
            Experimental
          </span>
        </div>
        <button
          onClick={() => setExportDialogOpen(true)}
          disabled={!canExport}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-surface-elevated disabled:text-content-disabled"
          aria-label="Export bin as STL"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export
        </button>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left panel: Parameter controls (hidden on mobile, shown on md+) */}
        <div className="hidden w-80 flex-shrink-0 overflow-hidden border-r border-stroke-subtle bg-surface-secondary md:block">
          <ParameterPanel />
        </div>

        {/* Center area: 3D preview */}
        <div className="relative flex-1 overflow-hidden">
          <PreviewCanvas />
        </div>

        {/* Mobile: Bottom parameter panel (shown on mobile, hidden on md+) */}
        <div
          className="fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto border-t border-stroke-subtle bg-surface-secondary md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <ParameterPanel />
        </div>
      </main>

      {/* Export modal */}
      <ExportDialog />
    </div>
  );
}

