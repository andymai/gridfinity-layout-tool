interface LoadingFallbackProps {
  /** Fill the full screen (for page-level fallbacks) or inline */
  variant?: 'fullscreen' | 'inline' | 'panel' | 'overlay';
  /** Optional label for screen readers */
  label?: string;
}

/**
 * Loading fallback component for Suspense boundaries.
 * Provides visual feedback while lazy-loaded chunks are loading.
 */
export function LoadingFallback({
  variant = 'fullscreen',
  label = 'Loading',
}: LoadingFallbackProps) {
  const spinner = (
    <div className="flex flex-col items-center gap-3" role="status" aria-label={label}>
      <svg
        className="w-6 h-6 text-accent animate-spin motion-reduce:animate-none"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-20"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="opacity-80"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );

  if (variant === 'fullscreen') {
    return <div className="h-screen flex items-center justify-center bg-surface">{spinner}</div>;
  }

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-dark animate-fade-in">
        {spinner}
      </div>
    );
  }

  if (variant === 'panel') {
    return <div className="flex-1 flex items-center justify-center py-12">{spinner}</div>;
  }

  // inline
  return <div className="flex items-center justify-center py-8">{spinner}</div>;
}
