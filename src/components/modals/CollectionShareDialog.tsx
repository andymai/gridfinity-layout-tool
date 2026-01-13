/**
 * Dialog for inviting others to a collection.
 * Shows the collection link prominently and allows easy copying.
 */

import { useState, useRef, useEffect } from 'react';

interface CollectionShareDialogProps {
  isOpen: boolean;
  collectionName: string;
  shareUrl: string;
  onClose: () => void;
  onCopy: () => Promise<boolean>;
}

// Wrapper that only mounts the content when open (resets state each time)
export function CollectionShareDialog(props: CollectionShareDialogProps) {
  if (!props.isOpen) return null;
  return <CollectionShareDialogContent {...props} />;
}

function CollectionShareDialogContent({
  collectionName,
  shareUrl,
  onClose,
  onCopy,
}: CollectionShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

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

  // Focus the input when dialog opens
  useEffect(() => {
    if (urlInputRef.current) {
      urlInputRef.current.select();
    }
  }, []);

  const handleCopy = async () => {
    const success = await onCopy();
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-dialog-title"
    >
      <div
        className="bg-surface-elevated rounded-lg p-6 max-w-lg w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 id="share-dialog-title" className="text-lg font-bold text-content">
              Invite Others
            </h2>
            <p className="text-sm text-content-secondary mt-1">
              {collectionName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-content-tertiary hover:text-content transition-colors p-1"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-content-secondary mb-4">
          Send this link to invite others. They can join and edit layouts together with you.
        </p>

        {/* URL Input */}
        <div className="flex gap-2 mb-4">
          <input
            ref={urlInputRef}
            type="text"
            value={shareUrl}
            readOnly
            onClick={() => urlInputRef.current?.select()}
            className="flex-1 bg-surface text-content p-3 rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label="Collection share URL"
          />
          <button
            onClick={handleCopy}
            className={`px-4 py-2 rounded font-medium transition-colors ${
              copied
                ? 'bg-green-600 text-white'
                : 'bg-accent text-white hover:bg-accent-hover'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Tips */}
        <div className="bg-surface rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2 text-xs text-content-secondary">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Collections expire after 30 days of inactivity</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-content-secondary">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Anyone with the link can view and edit - don't share publicly</span>
          </div>
        </div>

        {/* Close Button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-md bg-surface hover:bg-surface-hover text-content transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
