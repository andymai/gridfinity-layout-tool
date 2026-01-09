import { useState, useEffect, useRef, useCallback } from 'react';
import { useUIStore, useLayoutStore, useUndoableAction } from '../../store';
import { CONSTRAINTS } from '../../constants';

/**
 * Small popover that appears near a bin for quick label editing.
 * Triggered by L keyboard shortcut.
 */
export function QuickLabelPopover() {
  const quickLabelBinId = useUIStore(state => state.quickLabelBinId);

  if (!quickLabelBinId) return null;

  // Use key to remount inner component when bin changes, resetting state
  return <QuickLabelPopoverInner key={quickLabelBinId} binId={quickLabelBinId} />;
}

function QuickLabelPopoverInner({ binId }: { binId: string }) {
  const hideQuickLabel = useUIStore(state => state.hideQuickLabel);
  const bins = useLayoutStore(state => state.layout.bins);
  const updateBin = useLayoutStore(state => state.updateBin);
  const { execute } = useUndoableAction();

  const bin = bins.find(b => b.id === binId);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Initialize value from bin label (fresh on each mount due to key)
  const [value, setValue] = useState(bin?.label || '');

  // Save handler
  const handleSave = useCallback(() => {
    if (bin && value !== (bin.label || '')) {
      execute(() => {
        updateBin(bin.id, { label: value.trim() || undefined });
      });
    }
    hideQuickLabel();
  }, [bin, value, execute, updateBin, hideQuickLabel]);

  // Focus input when popover mounts
  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, []);

  // Handle click outside to close
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

  if (!bin) return null;

  // Find the bin element to position the popover
  const binElement = document.querySelector(`[data-bin-id="${binId}"]`);
  if (!binElement) return null;

  const binRect = binElement.getBoundingClientRect();

  // Position popover above the bin, centered horizontally
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    left: binRect.left + binRect.width / 2,
    top: binRect.top - 8,
    transform: 'translate(-50%, -100%)',
    zIndex: 100,
  };

  return (
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-surface-elevated border border-stroke rounded-lg shadow-xl p-3 animate-scale-in"
    >
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={CONSTRAINTS.LABEL_MAX_LENGTH}
          placeholder="Enter label..."
          className="input px-3 py-1.5 text-sm"
          style={{ minWidth: '180px' }}
        />
      </div>
      <div className="text-xs text-content-tertiary mt-2 text-center">
        Enter to save · Esc to cancel
      </div>
    </div>
  );
}
