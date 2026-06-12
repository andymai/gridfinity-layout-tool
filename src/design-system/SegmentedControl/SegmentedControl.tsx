import { useCallback, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';

const groupVariants = cva(['inline-flex rounded-lg bg-surface p-0.5', 'border border-stroke'], {
  variants: {
    fullWidth: {
      true: 'flex w-full',
    },
  },
});

const segmentVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'rounded-md font-medium whitespace-nowrap',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: ['text-[11px]', 'px-2', 'py-0.5'],
        md: ['text-xs', 'px-2.5', 'py-1.5'],
      },
      activeStyle: {
        subtle: '',
        accent: '',
      },
      active: {
        true: '',
        false: 'text-content-tertiary hover:bg-surface-hover hover:text-content-secondary',
      },
      fullWidth: {
        true: 'flex-1',
      },
    },
    compoundVariants: [
      {
        active: true,
        activeStyle: 'subtle',
        class: 'bg-surface-elevated text-content shadow-sm',
      },
      {
        active: true,
        activeStyle: 'accent',
        class: 'bg-accent text-on-accent',
      },
    ],
    defaultVariants: {
      size: 'md',
      activeStyle: 'subtle',
    },
  }
);

export interface SegmentedControlOption<T extends string> {
  value: T;

  /**
   * Visible content: text, icon node, or icon+label.
   */
  label: ReactNode;

  /**
   * Accessible name for the segment. Required when label is icon-only.
   */
  'aria-label'?: string;

  /**
   * Tooltip shown on hover.
   */
  title?: string;

  /**
   * Disables this segment; keyboard navigation skips it.
   */
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  /**
   * Options to render as segments, in order.
   */
  options: SegmentedControlOption<T>[];

  /**
   * Currently selected value.
   */
  value: T;

  /**
   * Called with the newly selected value. Not called when the
   * selected segment is clicked again.
   */
  onChange: (value: T) => void;

  /**
   * Accessible label for the radiogroup.
   */
  'aria-label': string;

  /**
   * Segment density. 'sm' is compact for dense desktop groups;
   * 'md' is touch-friendly.
   * @default 'md'
   */
  size?: 'sm' | 'md';

  /**
   * Active segment treatment: 'subtle' raised neutral pill or
   * 'accent' filled pill.
   * @default 'subtle'
   */
  activeStyle?: 'subtle' | 'accent';

  /**
   * Stretch the group and give every segment equal width.
   * @default false
   */
  fullWidth?: boolean;

  className?: string;
}

function stepEnabledIndex<T extends string>(
  options: SegmentedControlOption<T>[],
  from: number,
  direction: 1 | -1
): number {
  const length = options.length;
  for (let step = 1; step <= length; step++) {
    const index = (((from + direction * step) % length) + length) % length;
    if (!options[index].disabled) return index;
  }
  return from;
}

function lastEnabledIndex<T extends string>(options: SegmentedControlOption<T>[]): number {
  for (let index = options.length - 1; index >= 0; index--) {
    if (!options[index].disabled) return index;
  }
  return -1;
}

/**
 * Accessible single-select segmented control. Renders a radiogroup of
 * joined segments with roving tabindex and full arrow-key navigation
 * (ArrowLeft/Right/Up/Down cycle, Home/End jump, disabled segments skipped).
 *
 * @example
 * // Text segments
 * <SegmentedControl
 *   aria-label="View mode"
 *   options={[
 *     { value: 'list', label: 'List' },
 *     { value: 'grid', label: 'Grid' },
 *   ]}
 *   value={mode}
 *   onChange={setMode}
 * />
 *
 * @example
 * // Icon-only segments (per-option aria-label required)
 * <SegmentedControl
 *   aria-label="Preview mode"
 *   activeStyle="accent"
 *   options={[
 *     { value: 'assembled', label: <CubeIcon />, 'aria-label': 'Assembled' },
 *     { value: 'exploded', label: <LayersIcon />, 'aria-label': 'Exploded' },
 *   ]}
 *   value={previewMode}
 *   onChange={setPreviewMode}
 * />
 *
 * @example
 * // Compact, equal-width segments
 * <SegmentedControl
 *   aria-label="Divider mode"
 *   size="sm"
 *   fullWidth
 *   options={[
 *     { value: 'count', label: 'By count' },
 *     { value: 'size', label: 'By size' },
 *   ]}
 *   value={dividerMode}
 *   onChange={setDividerMode}
 * />
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  size = 'md',
  activeStyle = 'subtle',
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);

  const selectIndex = useCallback(
    (index: number) => {
      const option = options[index];
      if (option.disabled || option.value === value) return;
      onChange(option.value);
      const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios?.[index]?.focus();
    },
    [options, value, onChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (options.length === 0) return;
      const currentIndex = options.findIndex((option) => option.value === value);
      let nextIndex: number;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIndex = stepEnabledIndex(options, currentIndex, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIndex = stepEnabledIndex(options, currentIndex, -1);
      } else if (e.key === 'Home') {
        nextIndex = options.findIndex((option) => !option.disabled);
      } else if (e.key === 'End') {
        nextIndex = lastEnabledIndex(options);
      } else {
        return;
      }

      e.preventDefault();
      if (nextIndex >= 0) selectIndex(nextIndex);
    },
    [options, value, selectIndex]
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(groupVariants({ fullWidth }), className)}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option['aria-label']}
            title={option.title}
            disabled={option.disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => {
              if (!isSelected) onChange(option.value);
            }}
            className={cn(segmentVariants({ size, activeStyle, active: isSelected, fullWidth }))}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
