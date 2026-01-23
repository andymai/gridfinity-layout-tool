/**
 * Export cart dialog for batch STL download.
 *
 * Shows queued designs with thumbnails and estimates.
 * Triggers batch generation + ZIP download with progress.
 */

import { useState, useCallback, useRef } from 'react';
import { useCartStore } from '@/features/bin-designer/store/cart';
import { batchExport } from '@/features/bin-designer/utils/batchExport';
import { estimatePrint } from '@/features/bin-designer/utils/printEstimates';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import type { BatchProgress } from '@/features/bin-designer/utils/batchExport';
import type { CartItem } from '@/features/bin-designer/types';

interface CartDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Renders a modal dialog for reviewing carted designs and exporting them as a ZIP.
 *
 * Shows cart items with per-item estimates, aggregated totals (filament, time, cost),
 * and controls to remove items or clear the cart. Provides a "Download ZIP" action
 * that performs a batch export with real-time progress updates and an option to cancel;
 * successful export triggers a client-side ZIP download and any generation failures are reported.
 *
 * @param open - Whether the dialog is visible
 * @param onClose - Callback invoked when the dialog should be closed
 * @returns The dialog element when `open` is true, otherwise `null`
 */
export function CartDialog({ open, onClose }: CartDialogProps) {
  const items = useCartStore((s) => s.items);
  const removeFromCart = useCartStore((s) => s.removeFromCart);
  const clearCart = useCartStore((s) => s.clearCart);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dialogRef = useFocusTrap<HTMLDivElement>({
    active: open,
    onEscape: onClose,
  });

  const handleExport = useCallback(async () => {
    if (items.length === 0) return;

    setExporting(true);
    setError(null);
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await batchExport(
        items,
        (p) => setProgress(p),
        controller.signal
      );

      // Trigger download
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `gridfinity-bins-${items.length}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      if (result.failed.length > 0) {
        setError(`${result.failed.length} design(s) failed to generate and were skipped.`);
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'Export cancelled') {
        // User cancelled — no error display
      } else {
        setError(e instanceof Error ? e.message : 'Export failed');
      }
    } finally {
      setExporting(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [items]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  if (!open) return null;

  const totals = items.reduce(
    (acc, item) => {
      const est = estimatePrint(item.params);
      return {
        filament: acc.filament + est.gramsFilament,
        time: acc.time + est.printTimeMinutes,
        cost: acc.cost + est.costUSD,
      };
    },
    { filament: 0, time: 0, cost: 0 }
  );

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="mx-4 flex w-full max-w-lg flex-col rounded-lg border border-stroke-subtle bg-surface shadow-xl"
        style={{ maxHeight: '80vh' }}
        role="dialog"
        aria-label="Export cart"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stroke-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-content">Export Cart</h2>
            <span className="rounded-full bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent">
              {items.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-content-secondary hover:bg-surface-hover hover:text-content"
            aria-label="Close"
            disabled={exporting}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {items.length === 0 ? (
            <div className="py-8 text-center">
              <svg className="mx-auto mb-3 h-12 w-12 text-content-disabled" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm font-medium text-content-secondary">Cart is empty</p>
              <p className="mt-1 text-xs text-content-tertiary">
                Use the &ldquo;Add to Cart&rdquo; button to queue designs for batch export.
              </p>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Cart items">
              {items.map((item) => (
                <CartItemRow
                  key={item.id}
                  item={item}
                  onRemove={() => removeFromCart(item.id)}
                  disabled={exporting}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer with totals and export button */}
        {items.length > 0 && (
          <div className="border-t border-stroke-subtle px-5 py-4">
            {/* Estimates summary */}
            <div className="mb-3 flex gap-4 text-xs text-content-secondary">
              <span>{totals.filament.toFixed(1)}g filament</span>
              <span>{formatTime(totals.time)}</span>
              <span>${totals.cost.toFixed(2)}</span>
            </div>

            {/* Progress bar */}
            {exporting && progress && (
              <div className="mb-3 space-y-1">
                <div className="flex justify-between text-xs text-content-secondary">
                  <span>
                    {progress.phase === 'generating'
                      ? `Generating: ${progress.currentName}`
                      : 'Packaging ZIP...'}
                  </span>
                  <span>{progress.current + 1}/{progress.total}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${((progress.current + 1) / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={clearCart}
                disabled={exporting}
                className="text-xs text-content-secondary hover:text-content disabled:opacity-50"
              >
                Clear cart
              </button>
              <div className="flex gap-2">
                {exporting ? (
                  <button
                    onClick={handleCancel}
                    className="rounded-md px-4 py-2 text-sm font-medium text-content-secondary hover:bg-surface-hover"
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    onClick={handleExport}
                    className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download ZIP
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Render a list row for a cart item showing thumbnail, name, dimensions, style, filament estimate, and a remove action.
 *
 * @param item - The cart item to display
 * @param onRemove - Callback invoked when the remove button is clicked
 * @param disabled - If `true`, disables the remove button and applies disabled styling
 * @returns A list item element containing the item's thumbnail, info, and remove button
 */
function CartItemRow({
  item,
  onRemove,
  disabled,
}: {
  item: CartItem;
  onRemove: () => void;
  disabled: boolean;
}) {
  const estimates = estimatePrint(item.params);
  const dims = `${item.params.width}×${item.params.depth}×${item.params.height}`;

  return (
    <li className="group flex items-center gap-3 rounded-md border border-stroke-subtle bg-surface-secondary p-2.5">
      {/* Thumbnail */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-surface">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg className="h-5 w-5 text-content-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-content">{item.name}</div>
        <div className="flex gap-3 text-[10px] text-content-tertiary">
          <span>{dims}</span>
          <span>{item.params.style}</span>
          <span>{estimates.gramsFilament.toFixed(1)}g</span>
        </div>
      </div>

      {/* Remove button — always visible on touch, hover/focus on desktop */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="rounded p-1.5 text-content-tertiary transition-opacity hover:bg-surface-hover hover:text-content sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 disabled:opacity-50"
        aria-label={`Remove ${item.name} from cart`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </li>
  );
}

/**
 * Format a duration in minutes into a short human-readable string.
 *
 * @returns A short string representing the duration: `Xmin` when less than 60 minutes, `Hh Mmin` when hours and remaining minutes are present, or `Hh` when minutes are zero.
 */
function formatTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}