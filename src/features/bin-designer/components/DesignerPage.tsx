/**
 * Bin Designer page shell.
 *
 * Top-level component for the /designer route. Displays a placeholder
 * layout that will be populated with parameter panel and 3D preview
 * in subsequent PRs.
 */


interface DesignerPageProps {
  onNavigateBack: () => void;
}

export function DesignerPage({ onNavigateBack }: DesignerPageProps) {
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

      {/* Main content area - to be populated in subsequent PRs */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left panel placeholder (parameter panel) */}
        <div className="hidden w-80 flex-shrink-0 border-r border-gray-200 bg-white p-4 md:block">
          <p className="text-sm text-gray-500">Parameter panel coming soon...</p>
        </div>

        {/* Center area (3D preview) */}
        <div className="flex flex-1 items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="mx-auto mb-4 h-24 w-24 rounded-xl bg-gray-200 p-6">
              <svg
                className="h-full w-full text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-700">3D Preview</h2>
            <p className="mt-1 text-sm text-gray-500">
              Parametric bin preview will appear here
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
