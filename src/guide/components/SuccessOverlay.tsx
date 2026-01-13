import { useEffect } from 'react';

interface SuccessOverlayProps {
  message: string;
  onDismiss: () => void;
  onAdvance: () => void;
  isLastStep?: boolean;
  autoAdvanceMs?: number;
}

/**
 * Success overlay shown when a step is completed.
 * Features a brief celebration animation and auto-advances.
 */
export function SuccessOverlay({
  message,
  onDismiss,
  onAdvance,
  isLastStep = false,
  autoAdvanceMs = 2000,
}: SuccessOverlayProps) {
  // Auto-advance after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      onAdvance();
    }, autoAdvanceMs);

    return () => clearTimeout(timer);
  }, [onAdvance, autoAdvanceMs]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
      onClick={onDismiss}
      role="dialog"
      aria-label="Step complete"
    >
      <div
        className="bg-surface-elevated p-6 rounded-xl shadow-xl max-w-sm mx-4 text-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success icon */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-success animate-check-draw"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Message */}
        <p className="text-lg text-content font-medium mb-2">{message}</p>

        {/* Action hint */}
        <p className="text-sm text-content-tertiary">
          {isLastStep ? 'Lesson complete!' : 'Moving to next step...'}
        </p>

        {/* Manual advance button */}
        <button
          onClick={onAdvance}
          className="mt-4 px-4 py-2 text-sm bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors"
        >
          {isLastStep ? 'Finish Lesson' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
