import { forwardRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';
import { Checkbox } from '../Checkbox';

const checkboxRowVariants = cva(
  [
    'flex items-center justify-between gap-2',
    'p-1.5 -mx-1.5 rounded-md',
    'hover:bg-surface-hover',
    'cursor-pointer select-none',
    interactiveTransition,
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      indent: {
        true: 'ml-4 border-l border-stroke-subtle pl-3',
      },
    },
    defaultVariants: {
      indent: false,
    },
  }
);

const labelVariants = cva(['text-sm', 'transition-colors duration-100'], {
  variants: {
    checked: {
      true: 'text-content',
      false: 'text-content-tertiary',
    },
  },
  defaultVariants: {
    checked: false,
  },
});

export interface CheckboxRowProps {
  /**
   * Visible label text for the row.
   */
  label: string;

  /**
   * Whether the row is checked.
   */
  checked: boolean;

  /**
   * Called with the next checked state when the row is toggled.
   */
  onChange: (checked: boolean) => void;

  /**
   * Trailing slot rendered before the checkbox: count Badge, etc.
   */
  trailing?: ReactNode;

  /**
   * Whether the row is disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * Nested sub-option indent with a left guide border.
   * @default false
   */
  indent?: boolean;

  /**
   * Additional CSS classes for the row container.
   */
  className?: string;
}

/**
 * Full-row checkbox: the entire row is the interactive checkbox, with a
 * hover surface, optional trailing slot, and a display-only Checkbox visual.
 *
 * @example
 * <CheckboxRow
 *   label="Include labels"
 *   checked={includeLabels}
 *   onChange={setIncludeLabels}
 * />
 *
 * @example
 * // With a trailing count badge
 * <CheckboxRow
 *   label="Layer 1"
 *   checked={selected}
 *   onChange={setSelected}
 *   trailing={<Badge>12</Badge>}
 * />
 *
 * @example
 * // Nested sub-option
 * <CheckboxRow indent label="Bin notes" checked={withNotes} onChange={setWithNotes} />
 */
export const CheckboxRow = forwardRef<HTMLDivElement, CheckboxRowProps>(
  ({ label, checked, onChange, trailing, disabled = false, indent = false, className }, ref) => {
    const toggle = () => {
      if (disabled) {
        return;
      }
      onChange(!checked);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle();
      }
    };

    return (
      <div
        ref={ref}
        role="checkbox"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : 0}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        className={cn(checkboxRowVariants({ indent }), className)}
      >
        <span className={labelVariants({ checked })}>{label}</span>
        <span className="flex items-center gap-2">
          {trailing}
          <Checkbox checked={checked} />
        </span>
      </div>
    );
  }
);

CheckboxRow.displayName = 'CheckboxRow';
