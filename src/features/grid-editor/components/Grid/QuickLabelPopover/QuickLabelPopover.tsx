import { useState, useEffect, useRef, useCallback } from 'react';
import { useLayoutStore } from '@/core/store';
import { useSelectionStore } from '@/core/store/selection';
import { useMutations } from '@/shared/contexts';
import { CONSTRAINTS } from '@/core/constants';
import { mlTracking } from '@/shared/analytics/useMLTracking';
import { useTranslation } from '@/i18n';
import { batch } from '@/core/cqrs';
import { trackEvent } from '@/shared/analytics/posthog';

/**
 * Small popover that appears near a bin for quick label editing.
 * Triggered by L keyboard shortcut.
 */
export function QuickLabelPopover() {
  const quickLabelBinId = useSelectionStore((state) => state.quickLabelBinId);

  if (!quickLabelBinId) return null;

  // Use key to remount inner component when bin changes, resetting state
  return <QuickLabelPopoverInner key={quickLabelBinId} binId={quickLabelBinId} />;
}

function QuickLabelPopoverInner({ binId }: { binId: string }) {
  const t = useTranslation();
  const hideQuickLabel = useSelectionStore((state) => state.hideQuickLabel);
  const bins = useLayoutStore((state) => state.layout.bins);
  const { updateBin } = useMutations();

  const bin = bins.find((b) => b.id === binId);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initialize value from bin label (fresh on each mount due to key)
  const [value, setValue] = useState(bin?.label || '');

  const handleSave = useCallback(() => {
    if (bin && value !== (bin.label || '')) {
      const oldLabel = bin.label;
      const newLabel = value.trim() || undefined;
      batch(() => {
        updateBin(bin.id, { label: newLabel });
      });
      // Track label change for ML telemetry
      mlTracking.trackLabel(bin, oldLabel, newLabel);
      // Mark feature as used for cohort segmentation
      if (newLabel) {
        trackEvent('ui.featureUsed', { feature: 'labels' });
      }
    }
    hideQuickLabel();
  }, [bin, value, updateBin, hideQuickLabel]);

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleSave();
      }
    };

    // Delay adding listener to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      hideQuickLabel();
    }
  };

  const handleClear = () => {
    setValue('');
    inputRef.current?.focus();
  };

  if (!bin) return null;

  // Find the bin element to position the popover
  const binElement = document.querySelector(`[data-bin-id="${CSS.escape(binId)}"]`);
  if (!binElement) return null;

  const binRect = binElement.getBoundingClientRect();

  // Position popover above the bin, centered horizontally
  // Adjust if too close to top of viewport
  const spaceAbove = binRect.top;
  const positionBelow = spaceAbove < 100;

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.max(16, Math.min(binRect.left + binRect.width / 2, window.innerWidth - 16)),
    top: positionBelow ? binRect.bottom + 8 : binRect.top - 8,
    transform: positionBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
    zIndex: 100,
  };

  return (
    <>
      {/* Subtle backdrop for focus */}
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: 'var(--overlay-medium)' }}
        role="presentation"
        onClick={handleSave}
      />

      {/* Popover */}
      <div
        ref={popoverRef}
        style={popoverStyle}
        className="z-50 bg-surface-elevated border border-stroke-subtle rounded-xl shadow-xl animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-stroke-subtle bg-surface-secondary">
          <div className="text-xs font-medium text-content-secondary">
            {t('grid.labelFor')}
            {bin.width}×{bin.depth}
            {t('grid.bin')}
          </div>
        </div>

        {/* Input area */}
        <div className="p-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={CONSTRAINTS.LABEL_MAX_LENGTH}
              placeholder={t('gridEditor.quickLabel.placeholder')}
              className="input w-full px-3 py-2 pr-8 text-sm"
              style={{ minWidth: '200px' }}
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-content-tertiary hover:text-content hover:bg-surface-hover transition-colors"
                aria-label={t('common.clear')}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Keyboard hints */}
          <div className="flex items-center justify-center gap-3 mt-2 text-xs text-content-tertiary">
            <span>
              <kbd
                className="px-1.5 py-0.5 rounded font-mono bg-surface border border-stroke-subtle leading-none"
                style={{ fontSize: '10px' }}
              >
                Enter
              </kbd>
              <span className="ml-1">{t('common.save')}</span>
            </span>
            <span>
              <kbd
                className="px-1.5 py-0.5 rounded font-mono bg-surface border border-stroke-subtle leading-none"
                style={{ fontSize: '10px' }}
              >
                Esc
              </kbd>
              <span className="ml-1">{t('common.cancel')}</span>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
