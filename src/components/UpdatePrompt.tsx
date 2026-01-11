import { useState, useCallback } from 'react';
import type { PWAUpdateState } from '../hooks/usePWAUpdate';

interface UpdatePromptProps {
  pwaState: PWAUpdateState;
}

/**
 * A dismissible banner that prompts users to update when a new version is available.
 * Gives users control over when to apply the update, preventing disruptive auto-reloads.
 */
export function UpdatePrompt({ pwaState }: UpdatePromptProps) {
  const { needsUpdate, applyUpdate, dismissUpdate } = pwaState;
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = useCallback(async () => {
    setIsUpdating(true);
    await applyUpdate();
    // Page will reload, no need to reset state
  }, [applyUpdate]);

  if (!needsUpdate) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-accent/95 text-on-dark backdrop-blur-sm border-t border-accent-hover shadow-lg"
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Update icon */}
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span className="text-sm font-medium truncate">
            A new version is available
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismissUpdate}
            className="px-3 py-1.5 text-sm rounded-md text-on-dark/80 hover:text-on-dark hover:bg-white/10 transition-colors"
            disabled={isUpdating}
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-white text-accent hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Updating...' : 'Update now'}
          </button>
        </div>
      </div>
    </div>
  );
}
