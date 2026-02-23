/* eslint-disable i18next/no-literal-string -- Catastrophic fallback; i18n may not be available */

import { clearAllAppData } from '@/core/storage';

/** Shown when IndexedDB initialization fails and the app cannot load saved data. */
export function InitErrorFallback({ error }: { error: Error }) {
  return (
    <div className="h-screen flex items-center justify-center bg-surface p-8" role="alert">
      <div className="max-w-md text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-error-muted flex items-center justify-center">
          <svg
            className="w-7 h-7 text-error"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-lg font-semibold mb-2 text-content">Unable to load app</h1>
        <p className="text-sm text-content-secondary mb-4">
          There was a problem loading your saved data. This is usually caused by corrupted storage.
          Try clearing your browser data for this site.
        </p>
        <pre className="text-left text-xs rounded-lg p-3 mb-4 overflow-auto max-h-24 text-error bg-surface-elevated border border-stroke-subtle">
          {error.message}
        </pre>
        <button
          onClick={() => {
            try {
              clearAllAppData();
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
          className="btn btn-primary"
        >
          Clear Data & Reload
        </button>
      </div>
    </div>
  );
}
