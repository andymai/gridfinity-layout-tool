/**
 * Single-select segment buttons in an even grid, for option sets that overflow
 * a SegmentedControl's one row. A wrapped SegmentedControl breaks its joined
 * pill into ragged fragments; equal grid cells keep every option the same
 * shape and the rows aligned.
 *
 * Carries the same radio semantics as SegmentedControl (radiogroup, roving
 * tabindex, arrow keys move the selection) so swapping one for the other is
 * invisible to assistive tech and tests.
 */

import type { KeyboardEvent } from 'react';
import { Button } from '@/design-system';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { cn } from '@/design-system/cn';

export interface SegmentGridOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly disabled?: boolean;
  readonly title?: string;
}

interface SegmentGridProps<T extends string> {
  readonly 'aria-label': string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly SegmentGridOption<T>[];
  readonly columns?: 2 | 3;
}

export function SegmentGrid<T extends string>({
  'aria-label': ariaLabel,
  value,
  onChange,
  options,
  columns = 2,
}: SegmentGridProps<T>) {
  const enabled = options.filter((o) => !o.disabled);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0 || enabled.length === 0) return;
    event.preventDefault();
    const index = Math.max(
      0,
      enabled.findIndex((o) => o.value === value)
    );
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(SEGMENT_GROUP_CLASS, 'grid', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant="ghost"
            touchTarget={false}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            title={option.title}
            onKeyDown={handleKeyDown}
            onClick={() => onChange(option.value)}
            className={getSegmentClass(selected)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
