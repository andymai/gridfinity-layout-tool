/**
 * Modal for creating a new collection.
 * Optionally adds the current layout as the first layout in the collection.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '../../store/layout';
import { useCollectionStore } from '../../store/collection';
import { useToastStore } from '../../store/toast';
import { useUIStore } from '../../store/ui';
import { setCollectionURL, generateCollectionURL } from '../../utils/url';
import { copyToClipboard } from '../../utils/storage';
import { getCollectionErrorMessage } from '../../api/collection';

interface CreateCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Wrapper that only mounts inner component when open
// This ensures fresh state on each open without needing useEffect to reset
export function CreateCollectionModal({ isOpen, onClose }: CreateCollectionModalProps) {
  if (!isOpen) return null;
  return <CreateCollectionModalContent onClose={onClose} />;
}

function CreateCollectionModalContent({ onClose }: { onClose: () => void }) {
  const layout = useLayoutStore((state) => state.layout);

  // Initialize with layout name (fresh state on each mount)
  const [name, setName] = useState(`${layout.name} Collection`);
  const [includeCurrentLayout, setIncludeCurrentLayout] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { createNewCollection } = useCollectionStore(
    useShallow((state) => ({
      createNewCollection: state.createNewCollection,
    }))
  );
  const addToast = useToastStore((state) => state.addToast);
  const announceToScreenReader = useUIStore((state) => state.announceToScreenReader);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
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

      const trimmedName = name.trim();
      if (!trimmedName) {
        setError('Please enter a collection name');
        return;
      }

      if (trimmedName.length > 64) {
        setError('Name must be 64 characters or less');
        return;
      }

      setIsCreating(true);
      const result = await createNewCollection(
        trimmedName,
        includeCurrentLayout ? layout : undefined
      );

      if (result.success) {
        // Update URL to collection
        setCollectionURL(result.data.id, false, false);

        // Copy link to clipboard
        const url = generateCollectionURL(result.data.id);
        await copyToClipboard(url);

        addToast(`Collection created! Link copied to clipboard.`, 'success');
        announceToScreenReader(`Collection ${trimmedName} created. Share link copied to clipboard.`);
        onClose();
      } else {
        setIsCreating(false);
        setError(getCollectionErrorMessage(result.error));
      }
    },
    [name, includeCurrentLayout, layout, createNewCollection, addToast, announceToScreenReader, onClose]
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
        aria-labelledby="create-collection-title"
        className="bg-surface-elevated rounded-lg p-6 max-w-md w-full mx-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 id="create-collection-title" className="text-xl font-bold text-content">
            Create Collection
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
          Create a shared collection to work on layouts together in real-time.
          No account needed - just share the link!
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* Collection Name */}
          <div className="mb-4">
            <label htmlFor="collection-name" className="block text-sm font-medium text-content mb-1">
              Collection Name
            </label>
            <input
              ref={inputRef}
              id="collection-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workshop Drawers"
              maxLength={64}
              className="w-full px-3 py-2 rounded-md bg-surface border border-stroke text-content placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-accent"
              disabled={isCreating}
            />
            {error && (
              <p className="mt-1 text-sm text-error" role="alert">
                {error}
              </p>
            )}
          </div>

          {/* Include Current Layout Option */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCurrentLayout}
                onChange={(e) => setIncludeCurrentLayout(e.target.checked)}
                className="w-4 h-4 rounded border-stroke text-accent focus:ring-accent"
                disabled={isCreating}
              />
              <span className="text-sm text-content">
                Add current layout ({layout.name}) to collection
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-md text-content-secondary hover:text-content hover:bg-surface transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isCreating ? (
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
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Create & Copy Link
                </>
              )}
            </button>
          </div>
        </form>

        {/* Info */}
        <div className="mt-4 pt-4 border-t border-stroke">
          <div className="flex items-start gap-2 text-xs text-content-tertiary">
            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>
              Collections expire after 2 years of inactivity. Anyone with the link
              can view and edit layouts. Changes sync automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
