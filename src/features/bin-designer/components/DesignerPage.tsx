/**
 * Bin Designer page layout.
 *
 * Two-column layout: left panel (parameter controls, 320px) + main area (3D preview).
 * On mobile (<768px), the parameter panel is shown as a full-width bottom area.
 * The useGeneration hook auto-generates mesh when parameters change.
 */

import { ParameterPanel } from './ParameterPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { useGeneration } from '../hooks/useGeneration';

interface DesignerPageProps {
  onNavigateBack: () => void;
}

export function DesignerPage({ onNavigateBack }: DesignerPageProps) {
  // Initialize generation bridge - auto-generates mesh when params change
  useGeneration();

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onNavigateBack}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
          <div className="h-5 w-px bg-gray-300" />
          <h1 className="text-lg font-semibold text-gray-900">Bin Designer</h1>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Experimental
          </span>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left panel: Parameter controls (hidden on mobile, shown on md+) */}
        <div className="hidden w-80 flex-shrink-0 border-r border-gray-200 bg-white md:block">
          <ParameterPanel />
        </div>

        {/* Center area: 3D preview */}
        <div className="relative flex-1 overflow-hidden">
          <PreviewCanvas />
        </div>

        {/* Mobile: Bottom parameter panel (shown on mobile, hidden on md+) */}
        <div
          className="fixed inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto border-t border-gray-200 bg-white md:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <ParameterPanel />
        </div>
      </main>
    </div>
  );
}
