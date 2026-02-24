/**
 * Visual padding distribution control for one axis.
 *
 * Shows a drawer dimension input, remainder info, and a draggable bar
 * that distributes padding between start/end sides. Three quick-align
 * buttons let users snap to start/center/end.
 */

import { useCallback, useRef, useState } from 'react';
import { Stepper } from '@/design-system/Stepper';
import { useTranslation } from '@/i18n';

interface PaddingDistributionControlProps {
  readonly axis: 'width' | 'depth';
  readonly drawerMm: number;
  readonly gridMm: number;
  readonly ratio: number;
  readonly onDrawerMmChange: (value: number) => void;
  readonly onRatioChange: (value: number) => void;
}

/** Snap ratio to center when within this mm of midpoint */
const CENTER_SNAP_MM = 1;

export function PaddingDistributionControl({
  axis,
  drawerMm,
  gridMm,
  ratio,
  onDrawerMmChange,
  onRatioChange,
}: PaddingDistributionControlProps) {
  const t = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const remainderMm = drawerMm - gridMm;
  const hasRemainder = remainderMm > 0;
  const drawerTooSmall = remainderMm < 0;
  const disabled = !hasRemainder;

  const startMm = hasRemainder ? Math.round(remainderMm * ratio * 10) / 10 : 0;
  const endMm = hasRemainder ? Math.round(remainderMm * (1 - ratio) * 10) / 10 : 0;

  const label = axis === 'width' ? t('baseplate.drawerWidth') : t('baseplate.drawerDepth');

  /** Convert a ratio, snapping to center when close */
  const snapRatio = useCallback(
    (raw: number): number => {
      const clamped = Math.max(0, Math.min(1, raw));
      if (!hasRemainder) return 0.5;
      // Snap to center when within CENTER_SNAP_MM of midpoint
      const mmFromCenter = Math.abs(clamped - 0.5) * remainderMm;
      if (mmFromCenter < CENTER_SNAP_MM) return 0.5;
      // Snap to 0.1mm precision
      const step = remainderMm > 0 ? 0.1 / remainderMm : 0.01;
      return Math.round(clamped / step) * step;
    },
    [hasRemainder, remainderMm]
  );

  /** Convert a pointer X position to a padding ratio.
   * The bar represents the full drawer: [startPad | grid | endPad].
   * Dragging centers the grid under the cursor. */
  const pctToRatio = useCallback(
    (pct: number): number => {
      // startPad = pct * drawerMm - gridMm/2 (center grid under cursor)
      // ratio = startPad / remainder
      if (remainderMm <= 0) return 0.5;
      return (pct * drawerMm - gridMm / 2) / remainderMm;
    },
    [drawerMm, gridMm, remainderMm]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setIsDragging(true);

      if (trackRef.current) {
        const rect = trackRef.current.getBoundingClientRect();
        const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        onRatioChange(snapRatio(pctToRatio(pct)));
      }
    },
    [disabled, pctToRatio, snapRatio, onRatioChange]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || disabled || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onRatioChange(snapRatio(pctToRatio(pct)));
    },
    [isDragging, disabled, pctToRatio, snapRatio, onRatioChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      setIsDragging(false);
    },
    [isDragging]
  );

  // Proportional widths for the visual bar (as percentages)
  const totalMm = Math.max(drawerMm, gridMm);
  const startPct = hasRemainder ? (startMm / totalMm) * 100 : 0;
  const gridPct = (gridMm / totalMm) * 100;
  const endPct = hasRemainder ? (endMm / totalMm) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label + Stepper row */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-content-secondary">{label}</span>
        <Stepper
          size="sm"
          value={drawerMm}
          onChange={onDrawerMmChange}
          onStep={(delta) => onDrawerMmChange(Math.max(0, drawerMm + delta))}
          min={0}
          max={999}
          step={1}
          aria-label={label}
        />
      </div>

      {/* Info line */}
      <div className="text-[11px] text-content-tertiary">
        {drawerTooSmall ? (
          <span className="text-warning">{t('baseplate.drawerTooSmall')}</span>
        ) : hasRemainder ? (
          <>
            {t('baseplate.gridUses', { gridMm: Math.round(gridMm) })}
            {' — '}
            {t('baseplate.remaining', { remainderMm: remainderMm.toFixed(1) })}
          </>
        ) : (
          t('baseplate.noRemaining')
        )}
      </div>

      {/* Visual distribution bar */}
      {hasRemainder && (
        <div
          ref={trackRef}
          className={`relative flex h-6 cursor-${disabled ? 'not-allowed' : 'ew-resize'} touch-none overflow-hidden rounded`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} distribution`}
          tabIndex={disabled ? -1 : 0}
        >
          {/* Start padding zone */}
          <div
            className="flex items-center justify-center bg-accent/20 text-[9px] tabular-nums text-accent transition-all"
            style={{ width: `${startPct}%`, minWidth: startPct > 0 ? '16px' : 0 }}
          >
            {startMm > 0 && startPct > 8 ? startMm.toFixed(1) : ''}
          </div>

          {/* Grid zone */}
          <div
            className="flex items-center justify-center border-x border-stroke bg-surface-elevated text-[9px] tabular-nums text-content-tertiary"
            style={{ width: `${gridPct}%` }}
          >
            {Math.round(gridMm)}mm
          </div>

          {/* End padding zone */}
          <div
            className="flex items-center justify-center bg-accent/20 text-[9px] tabular-nums text-accent transition-all"
            style={{ width: `${endPct}%`, minWidth: endPct > 0 ? '16px' : 0 }}
          >
            {endMm > 0 && endPct > 8 ? endMm.toFixed(1) : ''}
          </div>
        </div>
      )}

      {/* Quick-align buttons */}
      {hasRemainder && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onRatioChange(0)}
            disabled={disabled}
            className={`flex-1 rounded px-1 py-0.5 text-[10px] transition-colors ${
              ratio === 0
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-elevated text-content-tertiary hover:text-content'
            } disabled:opacity-30`}
            aria-label={t('baseplate.alignStart')}
          >
            {/* Left-align icon */}
            <svg className="mx-auto h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" />
              <rect x="4" y="4" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onRatioChange(0.5)}
            disabled={disabled}
            className={`flex-1 rounded px-1 py-0.5 text-[10px] transition-colors ${
              ratio === 0.5
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-elevated text-content-tertiary hover:text-content'
            } disabled:opacity-30`}
            aria-label={t('baseplate.alignCenter')}
          >
            {/* Center-align icon */}
            <svg className="mx-auto h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="5.25" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" />
              <rect x="2" y="4" width="8" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onRatioChange(1)}
            disabled={disabled}
            className={`flex-1 rounded px-1 py-0.5 text-[10px] transition-colors ${
              ratio === 1
                ? 'bg-accent/20 text-accent'
                : 'bg-surface-elevated text-content-tertiary hover:text-content'
            } disabled:opacity-30`}
            aria-label={t('baseplate.alignEnd')}
          >
            {/* Right-align icon */}
            <svg className="mx-auto h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="9.5" y="2" width="1.5" height="8" rx="0.5" fill="currentColor" />
              <rect x="2" y="4" width="6" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
