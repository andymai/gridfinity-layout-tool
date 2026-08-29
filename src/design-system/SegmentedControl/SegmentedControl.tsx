import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';

// Panel sections hosting this control sit inside overflow-hidden animation
// wrappers (Collapsible, StickyGroupHeader), so a row too wide for its column
// would be silently cut off rather than scrolled. Segments that overflow are
// re-laid into balanced equal-width rows; `flex-wrap` remains only as the
// no-JS / pre-measurement baseline so content is never clipped.
const groupVariants = cva(['relative rounded-lg bg-surface p-0.5', 'border border-stroke'], {
  variants: {
    layout: {
      row: 'inline-flex flex-wrap gap-y-0.5',
      grid: 'flex w-full flex-col gap-y-0.5',
    },
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
        sm: ['text-label', 'px-2', 'py-0.5'],
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

// Sub-pixel slack: offsetWidth rounds to integers, so an exact fit can read
// one pixel over and needlessly collapse to the grid.
const EPSILON = 1;

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

// The number of balanced compositions is C(rowCount, remainder), which is
// combinatorial for pathological option counts; the cap keeps a resize tick
// bounded while still covering every arrangement of realistic controls.
const MAX_COMPOSITIONS = 64;

function* balancedCompositions(rowCount: number, cellCount: number): Generator<number[]> {
  const base = Math.floor(cellCount / rowCount);
  const extra = cellCount % rowCount;
  if (extra === 0) {
    yield Array.from({ length: rowCount }, () => base);
    return;
  }

  const extraRows = Array.from({ length: extra }, (_, i) => i);
  for (let yielded = 0; yielded < MAX_COMPOSITIONS; yielded++) {
    const sizes = Array.from({ length: rowCount }, () => base);
    for (const row of extraRows) sizes[row] += 1;
    yield sizes;

    let cursor = extra - 1;
    while (cursor >= 0 && extraRows[cursor] === rowCount - extra + cursor) cursor--;
    if (cursor < 0) return;
    extraRows[cursor] += 1;
    for (let next = cursor + 1; next < extra; next++) extraRows[next] = extraRows[next - 1] + 1;
  }
}

function rowsFit(cellWidths: number[], sizes: number[], availableInner: number): boolean {
  let start = 0;
  for (const size of sizes) {
    let widest = 0;
    for (let index = start; index < start + size; index++) {
      widest = Math.max(widest, cellWidths[index]);
    }
    // Cells in a row are equal-width (flex-1), so the row needs the widest
    // cell's width times its cell count.
    if (widest * size > availableInner + EPSILON) return false;
    start += size;
  }
  return true;
}

/**
 * Balanced grid layout for segments that overflow a single line: the fewest
 * rows that fit, cells split as evenly as possible across them (order
 * preserved, every distribution of the remainder tried). Falls back to one
 * cell per row when nothing narrower fits.
 */
export function computeRowSizes(cellWidths: number[], availableInner: number): number[] {
  const count = cellWidths.length;
  for (let rowCount = 2; rowCount < count; rowCount++) {
    for (const sizes of balancedCompositions(rowCount, count)) {
      if (rowsFit(cellWidths, sizes, availableInner)) return sizes;
    }
  }
  return Array.from({ length: count }, () => 1);
}

function partitionRows<Item>(items: Item[], sizes: number[]): Item[][] {
  const rows: Item[][] = [];
  let start = 0;
  for (const size of sizes) {
    rows.push(items.slice(start, start + size));
    start += size;
  }
  return rows;
}

function sameSizes(a: number[] | null, b: number[] | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.length === b.length && a.every((size, index) => size === b[index]);
}

function contentWidth(root: HTMLElement): number {
  const styles = window.getComputedStyle(root);
  const paddingX =
    (Number.parseFloat(styles.paddingLeft) || 0) + (Number.parseFloat(styles.paddingRight) || 0);
  return root.clientWidth - paddingX;
}

/**
 * Accessible single-select segmented control. Renders a radiogroup of
 * joined segments with roving tabindex and full arrow-key navigation
 * (ArrowLeft/Right/Up/Down cycle, Home/End jump, disabled segments skipped).
 *
 * When the segments are too wide for the available space, the control
 * re-lays them into a balanced grid of equal-width cells (fewest rows that
 * fit, options split as evenly as possible) instead of ragged-wrapping.
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
  const probeRef = useRef<HTMLDivElement>(null);
  const [rowSizes, setRowSizes] = useState<number[] | null>(null);

  const sync = useCallback(() => {
    const root = groupRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;
    // An inline-flex box is clamped to its containing block, and in grid mode
    // the root is w-full — so in every mode the root's width IS the available
    // width whenever the probe (segments at natural size) exceeds it.
    const next =
      probe.offsetWidth <= root.offsetWidth + EPSILON
        ? null
        : computeRowSizes(
            Array.from(probe.children, (cell) => (cell as HTMLElement).offsetWidth),
            contentWidth(root)
          );
    setRowSizes((previous) => (sameSizes(previous, next) ? previous : next));
  }, []);

  useLayoutEffect(sync);

  useLayoutEffect(() => {
    const root = groupRef.current;
    const probe = probeRef.current;
    if (!root || !probe) return;
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [sync]);

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

  const renderSegment = (option: SegmentedControlOption<T>, stretch: boolean): ReactNode => {
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
        className={cn(
          segmentVariants({ size, activeStyle, active: isSelected, fullWidth: stretch })
        )}
      >
        {option.label}
      </button>
    );
  };

  const cellTotal = rowSizes?.reduce((sum, rowSize) => sum + rowSize, 0);
  const gridSizes = rowSizes !== null && cellTotal === options.length ? rowSizes : null;

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        groupVariants({ layout: gridSizes === null ? 'row' : 'grid', fullWidth }),
        className
      )}
    >
      {/* The zero-size overflow-hidden wrapper keeps the probe's natural width
          out of ancestor scrollable-overflow, so a scrollable panel never gains
          a horizontal scrollbar from the invisible measurement content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0 h-0 w-0 overflow-hidden"
      >
        <div
          ref={probeRef}
          data-measure=""
          className="inline-flex w-max border border-transparent p-0.5 whitespace-nowrap"
        >
          {options.map((option) => (
            <span
              key={option.value}
              className={cn(segmentVariants({ size, activeStyle, active: false }))}
            >
              {option.label}
            </span>
          ))}
        </div>
      </div>
      {gridSizes === null
        ? options.map((option) => renderSegment(option, fullWidth))
        : partitionRows(options, gridSizes).map((row, rowIndex) => (
            <div key={rowIndex} className="flex w-full">
              {row.map((option) => renderSegment(option, true))}
            </div>
          ))}
    </div>
  );
}
