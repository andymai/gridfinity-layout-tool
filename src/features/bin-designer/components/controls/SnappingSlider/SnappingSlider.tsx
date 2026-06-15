/**
 * Slider control that snaps to discrete preset values with magnetic behavior.
 *
 * Features:
 * - Magnetic snap: thumb gets pulled to nearest preset when close
 * - Tick marks below track (labels shown only for key values to reduce crowding)
 * - Help text that updates based on current selection
 * - Optional default value marker
 * - Touch-friendly with adequate target sizes
 */

import { useId, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { Button } from '@/design-system';
import { SliderThumb } from '@/design-system/Slider';

export interface SnappingSliderOption {
  /** The numeric value */
  value: number;
  /** Description shown below slider when this value is selected */
  description: string;
}

interface SnappingSliderProps {
  /** Display label */
  label: string;
  /** Current value */
  value: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Available options with descriptions */
  options: readonly SnappingSliderOption[];
  /** Default value to highlight with a marker */
  defaultValue?: number;
  /** Unit suffix (e.g., 'mm') */
  unit?: string;
  /** Whether the control is disabled */
  disabled?: boolean;
  /** Optional tip shown below the description */
  tip?: string;
}

/** Values that should always show labels (key waypoints) */
const KEY_VALUES = new Set([0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.6]);

export function SnappingSlider({
  label,
  value,
  onChange,
  options,
  defaultValue,
  unit = 'mm',
  disabled = false,
  tip,
}: SnappingSliderProps) {
  const t = useTranslation();
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);

  // Track dragging state for smooth feedback
  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(value);

  // Sort options to ensure correct positioning and keyboard navigation
  const values = useMemo(() => [...options].map((o) => o.value).sort((a, b) => a - b), [options]);
  const min = values[0] ?? 0;
  const max = values[values.length - 1] ?? 0;
  const range = max - min;

  // Find nearest option to a given value
  const findNearest = useCallback(
    (target: number): number => {
      let nearest = values[0];
      let minDist = Math.abs(target - nearest);
      for (const v of values) {
        const dist = Math.abs(target - v);
        if (dist < minDist) {
          minDist = dist;
          nearest = v;
        }
      }
      return nearest;
    },
    [values]
  );

  // Get description for current value (or drag preview)
  const displayValue = isDragging ? findNearest(dragValue) : value;
  const currentDescription = useMemo(() => {
    const option = options.find((o) => Math.abs(o.value - displayValue) < 0.001);
    return option?.description ?? '';
  }, [options, displayValue]);

  // Calculate position percentage for a value (guard against empty options)
  const getPosition = useCallback(
    (v: number): number => {
      return range === 0 ? 0 : ((v - min) / range) * 100;
    },
    [min, range]
  );

  // The visual position - follows drag smoothly, snaps when not dragging
  const thumbPosition = isDragging ? dragValue : value;

  // Convert pointer position to value
  const pointerToValue = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return value;
      const rect = trackRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return min + percent * range;
    },
    [min, range, value]
  );

  // Handle pointer down - start dragging
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rawValue = pointerToValue(e.clientX);
      setDragValue(rawValue);
      setIsDragging(true);
    },
    [disabled, pointerToValue]
  );

  // Handle pointer move - update drag position
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const rawValue = pointerToValue(e.clientX);
      setDragValue(rawValue);
    },
    [isDragging, pointerToValue]
  );

  // Handle pointer up - snap and commit
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      const nearest = findNearest(dragValue);
      onChange(nearest);
      setIsDragging(false);
    },
    [isDragging, dragValue, findNearest, onChange]
  );

  // Handle keyboard on hidden input for accessibility
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      const currentIndex = values.findIndex((v) => Math.abs(v - value) < 0.001);
      let newIndex: number;

      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = Math.min(currentIndex + 1, values.length - 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = Math.max(currentIndex - 1, 0);
      } else if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = values.length - 1;
      } else {
        return;
      }

      if (newIndex !== currentIndex) {
        onChange(values[newIndex]);
      }
    },
    [disabled, values, value, onChange]
  );

  // Handle tick click
  const handleTickClick = useCallback(
    (tickValue: number) => {
      if (!disabled) {
        onChange(tickValue);
      }
    },
    [disabled, onChange]
  );

  const descriptionId = `${id}-description`;

  return (
    <div className={disabled ? 'opacity-50' : ''}>
      {/* Label row with prominent value */}
      <div className="mb-3 flex items-center justify-between">
        <label htmlFor={id} className="text-xs text-content-secondary">
          {label}
        </label>
        <span
          className={`rounded px-2 py-0.5 text-sm font-semibold tabular-nums transition-colors ${
            isDragging ? 'bg-accent/20 text-accent' : 'bg-surface-secondary text-content'
          }`}
        >
          {displayValue} {unit}
        </span>
      </div>

      {/* Slider track with tick marks - px-3 accounts for thumb overflow at edges */}
      <div className="relative px-3">
        {/* Draggable track area - uses pointer events for responsive dragging */}
        <div
          ref={trackRef}
          className="relative h-8 cursor-pointer touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="slider"
          aria-valuenow={displayValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label={label}
          tabIndex={-1}
        >
          {/* Track background */}
          <div className="absolute top-1/2 left-0 right-0 h-2 -translate-y-1/2 rounded-full bg-stroke-subtle" />

          {/* Filled portion - follows drag instantly */}
          <div
            className="absolute top-1/2 left-0 h-2 -translate-y-1/2 rounded-full bg-accent"
            style={{ width: `${getPosition(thumbPosition)}%` }}
          />

          {/* Tick marks at snap points */}
          {options.map((option) => {
            const isActive = Math.abs(option.value - value) < 0.001;
            const isBehindThumb = option.value <= thumbPosition;
            // Ticks on the filled track need to contrast with accent color
            /* eslint-disable i18next/no-literal-string -- CSS class names, not user-facing text */
            const tickColor = isActive
              ? 'bg-accent'
              : isBehindThumb
                ? 'bg-surface'
                : 'bg-content-secondary';
            /* eslint-enable i18next/no-literal-string */
            return (
              <div
                key={option.value}
                className={`absolute top-1/2 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  isActive ? 'h-4' : 'h-3'
                } ${tickColor}`}
                style={{ left: `${getPosition(option.value)}%` }}
              />
            );
          })}

          {/* Default value marker (subtle ring) */}
          {defaultValue !== undefined && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-content-tertiary opacity-40"
              style={{ left: `${getPosition(defaultValue)}%` }}
              title={t('snappingSlider.default')}
            />
          )}

          {/* Hidden input for keyboard accessibility */}
          <input
            id={id}
            type="range"
            value={value}
            onChange={() => {}} // Handled by pointer events
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={0.01}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
            aria-valuetext={`${displayValue} ${unit}`}
            aria-describedby={descriptionId}
            tabIndex={0}
          />

          {/* Visual thumb - larger for touch, follows drag smoothly */}
          <SliderThumb
            dragging={isDragging}
            className="top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${getPosition(thumbPosition)}%` }}
          />
        </div>

        {/* Tick labels below track - only key values shown */}
        <div className="relative mt-1 h-9">
          {options.map((option) => {
            const isActive = Math.abs(option.value - value) < 0.001;
            const showLabel = KEY_VALUES.has(option.value) || isActive;
            if (!showLabel) return null;
            return (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                onClick={() => handleTickClick(option.value)}
                disabled={disabled}
                className={`absolute -translate-x-1/2 min-h-[36px] flex items-end pb-0.5 rounded-none px-0 hover:bg-transparent text-[11px] tabular-nums transition-colors ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:text-content'
                } ${isActive ? 'font-semibold text-accent' : 'text-content-tertiary'}`}
                style={{ left: `${getPosition(option.value)}%` }}
                aria-label={t('snappingSlider.select', { value: option.value, unit })}
              >
                {option.value}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Help text */}
      <p id={descriptionId} className="mt-2 text-xs text-content-secondary" aria-live="polite">
        {currentDescription}
      </p>

      {/* Optional tip */}
      {tip && <p className="mt-1 text-[10px] text-content-tertiary italic">{tip}</p>}
    </div>
  );
}
