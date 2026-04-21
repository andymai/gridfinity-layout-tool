import { useCallback, useEffect, useRef, useState } from 'react';

/** Format mm for display: minimum needed decimals, no trailing zeros. */
function formatMm(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return String(rounded);
}

interface EditableDimensionsProps {
  /** Total width in mm (grid + padding) when hasPadding, or grid-only mm otherwise. */
  readonly widthMm: number;
  /** Total depth in mm (grid + padding) when hasPadding, or grid-only mm otherwise. */
  readonly depthMm: number;
  /** Minimum allowed mm value (derived from GRID_MIN * gridUnitMm). */
  readonly minMm: number;
  /** Maximum allowed mm value (derived from GRID_MAX * gridUnitMm + max padding headroom). */
  readonly maxMm: number;
  /** Called when the user commits new mm values. */
  readonly onCommit: (widthMm: number, depthMm: number) => void;
  /** Extra CSS classes for the outer wrapper. */
  readonly className?: string;
  /** Visual weight. 'primary' (default) matches the section headline; 'secondary' is a smaller/lighter companion to another primary value. */
  readonly variant?: 'primary' | 'secondary';
  /** Accessible label for the editable region. */
  readonly 'aria-label': string;
  /** Accessible label for the width input. */
  readonly widthLabel: string;
  /** Accessible label for the depth input. */
  readonly depthLabel: string;
}

/**
 * Click-to-edit inline display for baseplate mm dimensions.
 *
 * At rest: shows "{width} × {depth} mm" as styled text.
 * On click: swaps to two number inputs for direct mm entry.
 * Commits on Enter or blur; cancels on Escape.
 */
export function EditableDimensions({
  widthMm,
  depthMm,
  minMm,
  maxMm,
  onCommit,
  className,
  variant = 'primary',
  'aria-label': ariaLabel,
  widthLabel,
  depthLabel,
}: EditableDimensionsProps) {
  const restClass =
    variant === 'secondary'
      ? 'text-xs tabular-nums text-content-secondary'
      : 'text-sm font-semibold tabular-nums text-content';
  const separatorClass =
    variant === 'secondary' ? 'text-xs text-content-tertiary' : 'text-sm text-content-secondary';
  const suffixClass =
    variant === 'secondary'
      ? 'text-xs text-content-secondary'
      : 'text-sm font-semibold text-content';
  const inputClass =
    variant === 'secondary'
      ? 'w-14 rounded border border-accent bg-surface px-1 py-0.5 text-center text-xs tabular-nums text-content outline-none ring-1 ring-accent'
      : 'w-14 rounded border border-accent bg-surface px-1 py-0.5 text-center text-sm font-semibold tabular-nums text-content outline-none ring-1 ring-accent';
  const [editing, setEditing] = useState(false);
  const [localWidth, setLocalWidth] = useState('');
  const [localDepth, setLocalDepth] = useState('');
  const widthRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // When entering edit mode, seed inputs with current rounded values
  const enterEditMode = useCallback(() => {
    setLocalWidth(formatMm(widthMm));
    setLocalDepth(formatMm(depthMm));
    setEditing(true);
  }, [widthMm, depthMm]);

  // Focus width input when edit mode activates
  useEffect(() => {
    if (editing) {
      widthRef.current?.select();
    }
  }, [editing]);

  const clamp = useCallback((v: number) => Math.max(minMm, Math.min(maxMm, v)), [minMm, maxMm]);

  const commit = useCallback(() => {
    const w = parseFloat(localWidth);
    const d = parseFloat(localDepth);
    if (!Number.isNaN(w) && !Number.isNaN(d)) {
      onCommit(clamp(w), clamp(d));
    }
    setEditing(false);
  }, [localWidth, localDepth, clamp, onCommit]);

  const cancel = useCallback(() => {
    setEditing(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel]
  );

  // Commit when focus leaves the container entirely
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // relatedTarget is the element receiving focus — if it's still inside our
      // container, the user is tabbing between width/depth inputs, so don't commit yet.
      if (containerRef.current?.contains(e.relatedTarget as Node)) {
        return;
      }
      commit();
    },
    [commit]
  );

  if (editing) {
    return (
      <div
        ref={containerRef}
        className={`inline-flex items-baseline gap-1 ${className ?? ''}`}
        onBlur={handleBlur}
        role="group"
        aria-label={ariaLabel}
      >
        <input
          ref={widthRef}
          type="number"
          inputMode="decimal"
          step={0.1}
          value={localWidth}
          onChange={(e) => setLocalWidth(e.target.value)}
          onKeyDown={handleKeyDown}
          min={minMm}
          max={maxMm}
          className={inputClass}
          aria-label={widthLabel}
        />
        <span className={separatorClass}>&times;</span>
        <input
          type="number"
          inputMode="decimal"
          step={0.1}
          value={localDepth}
          onChange={(e) => setLocalDepth(e.target.value)}
          onKeyDown={handleKeyDown}
          min={minMm}
          max={maxMm}
          className={inputClass}
          aria-label={depthLabel}
        />
        <span className={suffixClass}>mm</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={enterEditMode}
      className={`cursor-pointer decoration-content-tertiary underline-offset-2 hover:underline ${restClass} ${className ?? ''}`}
      aria-label={ariaLabel}
    >
      {formatMm(widthMm)} &times; {formatMm(depthMm)} mm
    </button>
  );
}
