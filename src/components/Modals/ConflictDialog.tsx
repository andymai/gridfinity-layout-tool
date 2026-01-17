/**
 * Conflict Resolution Dialog
 *
 * Displayed when a sync conflict is detected - another user has modified
 * the same layout while the current user was editing. User must choose
 * how to resolve the conflict before continuing.
 */

import { useState, useEffect, useRef, useMemo } from 'react';

export type ConflictResolution = 'keep-mine' | 'use-theirs' | 'save-both';

interface ConflictDialogProps {
  isOpen: boolean;
  layoutName: string;
  serverModifiedAt: number;
  onResolve: (resolution: ConflictResolution) => void;
  onCancel: () => void;
}

/**
 * Format a timestamp as relative time (e.g., "2 minutes ago").
 * Extracted as a pure function to avoid Date.now() calls during render.
 */
function formatRelativeTime(timestamp: number, now: number): string {
  const diff = now - timestamp;

  if (diff < 60000) {
    return 'just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }
}

// Wrapper that only mounts inner component when open
export function ConflictDialog({ isOpen, ...props }: ConflictDialogProps) {
  if (!isOpen) return null;
  return <ConflictDialogContent {...props} />;
}

function ConflictDialogContent({
  layoutName,
  serverModifiedAt,
  onResolve,
  onCancel,
}: Omit<ConflictDialogProps, 'isOpen'>) {
  const [selectedOption, setSelectedOption] = useState<ConflictResolution>('save-both');
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLInputElement>(null);

  // Capture current time once on mount using lazy initializer
  // This avoids Date.now() being called during render
  const [mountTime] = useState(() => Date.now());

  // Format the server modification time (computed once)
  const formattedTime = useMemo(
    () => formatRelativeTime(serverModifiedAt, mountTime),
    [serverModifiedAt, mountTime]
  );

  useEffect(() => {
    // Focus first option when dialog opens
    firstOptionRef.current?.focus();

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    // Focus trap
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTab);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTab);
    };
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onResolve(selectedOption);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in bg-overlay-dark"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-description"
        className="max-w-lg w-full mx-4 animate-scale-in bg-surface-secondary border border-stroke rounded-[var(--radius-xl)] p-[var(--space-2xl)]"
        style={{ boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with warning icon */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-full bg-warning-muted">
            <svg
              className="w-6 h-6 text-warning"
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
          <h2 id="conflict-title" className="text-xl font-semibold text-content">
            Conflict Detected
          </h2>
        </div>

        {/* Description */}
        <p id="conflict-description" className="mb-6 text-sm text-content-secondary leading-relaxed">
          <strong className="text-content">"{layoutName}"</strong> was modified by someone else{' '}
          <span className="text-content-tertiary">({formattedTime})</span> while you
          were editing. Choose how to resolve this conflict.
        </p>

        {/* Resolution options */}
        <form onSubmit={handleSubmit}>
          <fieldset className="space-y-3 mb-6">
            <legend className="sr-only">Choose how to resolve the conflict</legend>

            {/* Save both option (recommended) */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedOption === 'save-both'
                  ? 'border-accent bg-accent/5'
                  : 'border-stroke hover:border-stroke-strong'
              }`}
            >
              <input
                ref={firstOptionRef}
                type="radio"
                name="resolution"
                value="save-both"
                checked={selectedOption === 'save-both'}
                onChange={() => setSelectedOption('save-both')}
                className="mt-0.5 w-4 h-4 text-accent focus:ring-accent"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-content">Save both versions</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-content-tertiary mt-1">
                  Their changes stay, yours saved as "{layoutName} ({new Date().toLocaleDateString()})"
                </p>
              </div>
            </label>

            {/* Keep mine option */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedOption === 'keep-mine'
                  ? 'border-accent bg-accent/5'
                  : 'border-stroke hover:border-stroke-strong'
              }`}
            >
              <input
                type="radio"
                name="resolution"
                value="keep-mine"
                checked={selectedOption === 'keep-mine'}
                onChange={() => setSelectedOption('keep-mine')}
                className="mt-0.5 w-4 h-4 text-accent focus:ring-accent"
              />
              <div className="flex-1">
                <span className="font-medium text-content">Keep my changes</span>
                <p className="text-xs text-content-tertiary mt-1">
                  <span className="text-warning">Warning:</span> This will overwrite the other person's changes
                </p>
              </div>
            </label>

            {/* Use theirs option */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                selectedOption === 'use-theirs'
                  ? 'border-accent bg-accent/5'
                  : 'border-stroke hover:border-stroke-strong'
              }`}
            >
              <input
                type="radio"
                name="resolution"
                value="use-theirs"
                checked={selectedOption === 'use-theirs'}
                onChange={() => setSelectedOption('use-theirs')}
                className="mt-0.5 w-4 h-4 text-accent focus:ring-accent"
              />
              <div className="flex-1">
                <span className="font-medium text-content">Use their changes</span>
                <p className="text-xs text-content-tertiary mt-1">
                  Your changes will be discarded
                </p>
              </div>
            </label>
          </fieldset>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Resolve Conflict
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
