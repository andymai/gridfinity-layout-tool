/**
 * Loading skeleton for the 3D preview.
 * Shows a pulsing placeholder while WASM initializes or mesh generates.
 */

import type { WasmStatus, GenerationStatus } from '@/features/bin-designer/types';

interface PreviewSkeletonProps {
  wasmStatus: WasmStatus;
  generationStatus: GenerationStatus;
}

export function PreviewSkeleton({ wasmStatus, generationStatus }: PreviewSkeletonProps) {
  const getMessage = () => {
    if (wasmStatus === 'loading') return 'Initializing engine...';
    if (wasmStatus === 'error') return 'Engine failed to load';
    if (generationStatus === 'generating') return 'Generating mesh...';
    if (generationStatus === 'error') return 'Generation failed';
    return 'Loading preview...';
  };

  const isError = wasmStatus === 'error' || generationStatus === 'error';

  return (
    <div className="flex h-full w-full items-center justify-center bg-surface" role="status" aria-live="polite" aria-label={getMessage()}>
      <div className="text-center">
        <div className={`mx-auto mb-3 h-16 w-16 rounded-xl ${isError ? 'bg-red-500/10' : 'bg-surface-elevated animate-pulse'} flex items-center justify-center`}>
          {isError ? (
            <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          )}
        </div>
        <p className={`text-sm ${isError ? 'text-red-400' : 'text-content-tertiary'}`}>
          {getMessage()}
        </p>
      </div>
    </div>
  );
}
