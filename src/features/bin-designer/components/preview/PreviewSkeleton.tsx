/**
 * Loading skeleton for the 3D preview.
 * Shows a pulsing placeholder while WASM initializes or mesh generates.
 * Error states include a retry button to recover from transient failures.
 */

import type { WasmStatus, GenerationStatus } from '@/features/bin-designer/types';

interface PreviewSkeletonProps {
  wasmStatus: WasmStatus;
  generationStatus: GenerationStatus;
  errorMessage?: string | null;
  onRetry?: () => void;
}

export function PreviewSkeleton({
  wasmStatus,
  generationStatus,
  errorMessage,
  onRetry,
}: PreviewSkeletonProps) {
  const getMessage = () => {
    if (wasmStatus === 'loading') return 'Initializing engine...';
    if (wasmStatus === 'error') return 'Engine failed to load';
    if (generationStatus === 'generating') return 'Generating mesh...';
    if (generationStatus === 'error') return 'Generation failed';
    return 'Loading preview...';
  };

  const getHelpText = () => {
    if (wasmStatus === 'error')
      return 'The WebAssembly engine could not be loaded. Check your connection and try again.';
    if (generationStatus === 'error') {
      return errorMessage
        ? `${errorMessage}. Try adjusting parameters or retry.`
        : 'Mesh generation encountered an error. Try adjusting parameters or retry.';
    }
    return null;
  };

  const isError = wasmStatus === 'error' || generationStatus === 'error';
  const helpText = getHelpText();

  return (
    <div
      className="flex h-full w-full items-center justify-center bg-surface"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={getMessage()}
    >
      <div className="text-center max-w-[240px]">
        <div
          className={`mx-auto mb-3 h-16 w-16 rounded-xl ${isError ? 'bg-red-500/10' : 'bg-surface-elevated animate-pulse motion-reduce:animate-none'} flex items-center justify-center`}
        >
          {isError ? (
            <svg
              className="h-8 w-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="h-8 w-8 text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
              />
            </svg>
          )}
        </div>
        <p className={`text-sm font-medium ${isError ? 'text-red-400' : 'text-content-tertiary'}`}>
          {getMessage()}
        </p>
        {helpText && <p className="mt-1 text-xs text-content-tertiary">{helpText}</p>}
        {isError && onRetry && (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-3 py-1.5 text-xs font-medium text-content-secondary shadow-sm transition-colors hover:bg-surface-hover hover:text-content"
            aria-label="Retry loading"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
