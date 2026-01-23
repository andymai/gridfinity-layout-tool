/**
 * Share dialog for bin designer configurations.
 *
 * Two modes:
 * - Share: Creates a shareable URL for the current design
 * - Load: Loads a shared design from a URL or ID
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { useDesignerSharing } from '@/features/bin-designer/hooks/useDesignerSharing';
import { migrateParams } from '@/features/bin-designer/constants/defaults';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { useToastStore } from '@/core/store/toast';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal dialog that lets the user create a permanent share link for the current bin design or load a design from a share URL/ID.
 *
 * @param open - Controls whether the dialog is visible.
 * @param onClose - Callback invoked to close the dialog.
 * @returns A React element rendering the share dialog when `open` is true, or `null` when closed.
 */
export function ShareDialog({ open, onClose }: ShareDialogProps) {
  const params = useDesignerStore((s) => s.params);
  const setParams = useDesignerStore((s) => s.setParams);
  const { status, shareUrl, error, share, loadShared, reset } = useDesignerSharing();

  const [loadInput, setLoadInput] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      reset();
      setLoadInput('');
      setCopied(false);
    }
  }, [open, reset]);

  const addToast = useToastStore((s) => s.addToast);

  const handleShare = useCallback(() => {
    share(params);
  }, [share, params]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      addToast({ message: 'Share link copied to clipboard', type: 'success', duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text
      inputRef.current?.select();
    }
  }, [shareUrl, addToast]);

  const handleLoad = useCallback(async () => {
    const input = loadInput.trim();
    if (!input) return;

    // Extract ID from URL or use as-is
    const id = extractShareId(input);
    if (!id) return;

    const loadedParams = await loadShared(id);
    if (loadedParams) {
      setParams(migrateParams(loadedParams));
      addToast({ message: 'Shared design loaded', type: 'success', duration: 3000 });
      onClose();
    }
  }, [loadInput, loadShared, setParams, onClose, addToast]);

  if (!open) return null;

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="mx-4 w-full max-w-md rounded-lg border border-stroke-subtle bg-surface p-6 shadow-xl"
        role="dialog"
        aria-label="Share design"
        aria-modal="true"
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-content">Share Design</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Share section */}
        <div className="space-y-3">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-content">Create Share Link</h3>
            <p className="text-xs text-content-secondary">
              Generate a link anyone can use to load this bin configuration.
            </p>

            {status === 'idle' && (
              <button
                onClick={handleShare}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Create Share Link
              </button>
            )}

            {status === 'sharing' && (
              <div className="flex items-center justify-center gap-2 rounded-md bg-surface-secondary py-2 text-sm text-content-secondary">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating link...
              </div>
            )}

            {status === 'success' && shareUrl && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 rounded-md border border-stroke-subtle bg-surface-secondary px-3 py-2 text-xs text-content"
                    aria-label="Share URL"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-md bg-surface-secondary px-3 py-2 text-xs font-medium text-content transition-colors hover:bg-surface-hover"
                  >
                    {copied ? (
                      <>
                        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-content-tertiary">
                  This link is permanent. Anyone with the link can load this design.
                </p>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-stroke-subtle" />
            <span className="text-[10px] text-content-tertiary">or</span>
            <div className="h-px flex-1 bg-stroke-subtle" />
          </div>

          {/* Load section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-content">Load Shared Design</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={loadInput}
                onChange={(e) => setLoadInput(e.target.value)}
                placeholder="Paste share URL or ID"
                className="flex-1 rounded-md border border-stroke-subtle bg-surface-secondary px-3 py-2 text-xs text-content placeholder:text-content-tertiary focus:border-accent focus:outline-none"
                aria-label="Share URL or ID"
                onKeyDown={(e) => { if (e.key === 'Enter') handleLoad(); }}
              />
              <button
                onClick={handleLoad}
                disabled={!loadInput.trim() || status === 'loading'}
                className="rounded-md bg-surface-secondary px-3 py-2 text-xs font-medium text-content transition-colors hover:bg-surface-hover disabled:opacity-50"
              >
                {status === 'loading' ? 'Loading...' : 'Load'}
              </button>
            </div>
          </div>

          {/* Error display */}
          {status === 'error' && error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Derives a share identifier from a URL or a raw input string.
 *
 * Tries to extract an ID from known URL path patterns (`/d/{id}`, `/l/{id}`, `/share/{id}`).
 * If the input is not a URL, validates common raw ID formats (UUID, `prefix-xxxxxxx`, or a 12‑character alphanumeric token).
 *
 * @param input - A URL or raw share identifier provided by the user
 * @returns The extracted or validated share ID, the input trimmed when non-empty, or `null` if no ID can be derived
 */
function extractShareId(input: string): string | null {
  // Try to parse as URL first
  try {
    const url = new URL(input);
    // Match /d/{id} or /l/{id} patterns
    const match = url.pathname.match(/^\/[dl]\/(.+)$/);
    if (match) return match[1];
    // Match /share/{id}
    const shareMatch = url.pathname.match(/^\/share\/(.+)$/);
    if (shareMatch) return shareMatch[1];
  } catch {
    // Not a URL, treat as raw ID
  }

  // Validate as a raw share ID (UUID or base36)
  const trimmed = input.trim();
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9]+-[a-z0-9]{7}$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z0-9]{12}$/.test(trimmed)) return trimmed;

  return trimmed.length > 0 ? trimmed : null;
}