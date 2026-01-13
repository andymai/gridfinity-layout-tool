/**
 * Modal for joining an existing collection via URL or ID.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCollectionRouting } from '../../hooks/useCollectionRouting';

interface JoinCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Extract collection ID from a URL or plain ID.
 * Accepts:
 * - Full URL: https://example.com/c/abc123def456
 * - Path: /c/abc123def456
 * - Plain ID: abc123def456
 */
function extractCollectionId(input: string): string | null {
  const trimmed = input.trim();

  // Try to match full URL or path
  const urlMatch = trimmed.match(/\/c\/([a-zA-Z0-9]{12})(?:\/view)?(?:\?.*)?$/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Check if it's a plain 12-char alphanumeric ID
  if (/^[a-zA-Z0-9]{12}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// Wrapper that only mounts inner component when open
// This ensures fresh state on each open without needing useEffect to reset
export function JoinCollectionModal({ isOpen, onClose }: JoinCollectionModalProps) {
  if (!isOpen) return null;
  return <JoinCollectionModalContent onClose={onClose} />;
}

function JoinCollectionModalContent({ onClose }: { onClose: () => void }) {
  // Fresh state on each mount (no reset effect needed)
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { navigateToCollection } = useCollectionRouting();

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const collectionId = extractCollectionId(input);
      if (!collectionId) {
        setError('Please enter a valid collection URL or ID');
        return;
      }

      setIsJoining(true);
      const success = await navigateToCollection(collectionId);

      if (success) {
        onClose();
      } else {
        setIsJoining(false);
        // Error toast is shown by navigateToCollection, but we can show inline error too
        setError('Collection not found. Check the URL and try again.');
      }
    },
    [input, navigateToCollection, onClose]
  );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="join-collection-title"
        className="bg-surface-elevated rounded-lg p-6 max-w-md w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 id="join-collection-title" className="text-xl font-bold text-content">
            Join Collection
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-content-secondary hover:text-content transition-colors rounded hover:bg-surface"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-content-secondary mb-4">
          Enter a collection URL or ID to join and work on layouts together.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="collection-input" className="block text-sm font-medium text-content mb-1">
              Collection URL or ID
            </label>
            <input
              ref={inputRef}
              id="collection-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://...../c/abc123def456 or abc123def456"
              className="w-full px-3 py-2 rounded-md bg-surface border border-stroke text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={isJoining}
              autoComplete="off"
            />
            {error && (
              <p className="mt-1 text-sm text-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md text-content-secondary hover:text-content hover:bg-surface transition-colors"
              disabled={isJoining}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isJoining}
              className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isJoining ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Joining...
                </>
              ) : (
                'Join Collection'
              )}
            </button>
          </div>
        </form>

        {/* Help Text */}
        <div className="mt-4 pt-4 border-t border-stroke">
          <p className="text-xs text-content-tertiary">
            Collections let you share layouts without needing accounts.
            Anyone with the link can view and edit layouts in the collection.
          </p>
        </div>
      </div>
    </div>
  );
}
