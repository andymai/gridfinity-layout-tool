/**
 * Single-select segment buttons in an even grid, for option sets that overflow
 * a SegmentedControl's one row. A wrapped SegmentedControl breaks its joined
 * pill into ragged fragments; equal grid cells keep every option the same
 * shape and the rows aligned.
 *
 * Carries the same radio semantics as SegmentedControl (radiogroup, roving
 * tabindex, arrow keys and Home/End move selection and focus) so swapping one
 * for the other is invisible to assistive tech and tests. Re-picking the
 * current option is a no-op: consumers wire straight into store actions that
 * push history entries, so a redundant onChange is a redundant undo step.
 */

import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/design-system';
import { getSegmentClass } from '@/shared/components/segmentedControlClasses';
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
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>());
  const enabled = options.filter((o) => !o.disabled);

  const pick = (next: T) => {
    if (next === value) return;
    onChange(next);
    buttonRefs.current.get(next)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (enabled.length === 0) return;
    const index = Math.max(
      0,
      enabled.findIndex((o) => o.value === value)
    );
    let next: T;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = enabled[(index + 1) % enabled.length].value;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = enabled[(index - 1 + enabled.length) % enabled.length].value;
        break;
      case 'Home':
        next = enabled[0].value;
        break;
      case 'End':
        next = enabled[enabled.length - 1].value;
        break;
      default:
        return;
    }
    event.preventDefault();
    pick(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'grid gap-0.5 rounded-lg border border-stroke-subtle bg-surface p-0.5',
        columns === 3 ? 'grid-cols-3' : 'grid-cols-2'
      )}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el);
              else buttonRefs.current.delete(option.value);
            }}
            type="button"
            variant="ghost"
            touchTarget={false}
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            title={option.title}
            onKeyDown={handleKeyDown}
            onClick={() => pick(option.value)}
            className={getSegmentClass(selected)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
