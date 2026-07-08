import { forwardRef, useId, useState, useEffect, useRef, useImperativeHandle } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { focusRing, disabledStyles } from '../variants';

const checkboxVariants = cva(
  [
    'relative',
    'inline-flex items-center',
    'rounded',
    'border-2',
    'transition-colors duration-100',
    'cursor-pointer',
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'w-3.5 h-3.5',
        md: 'w-4 h-4',
        lg: 'w-6 h-6',
      },
      checked: {
        true: 'bg-accent border-accent',
        false: 'bg-surface border-stroke hover:border-stroke-strong',
      },
      indeterminate: {
        true: 'bg-accent border-accent',
      },
    },
    defaultVariants: {
      size: 'md',
      checked: false,
    },
  }
);

const labelVariants = cva(['select-none', 'transition-colors duration-100'], {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-xs',
      lg: 'text-sm',
    },
    checked: {
      true: 'text-content',
      false: 'text-content-secondary',
    },
  },
  defaultVariants: {
    size: 'md',
    checked: false,
  },
});

type CheckboxVariantProps = Omit<
  VariantProps<typeof checkboxVariants>,
  'checked' | 'indeterminate'
>;

export interface CheckboxProps extends CheckboxVariantProps {
  /**
   * Whether the checkbox is checked (controlled mode).
   */
  checked?: boolean;

  /**
   * Whether the checkbox starts checked (uncontrolled mode).
   */
  defaultChecked?: boolean;

  /**
   * Called when the checkbox value changes.
   * If omitted, the checkbox is display-only (for use inside clickable parents).
   */
  onChange?: (checked: boolean) => void;

  /**
   * Display an indeterminate state (for "select all" patterns).
   * Takes precedence over checked for display purposes.
   */
  indeterminate?: boolean;

  /**
   * Accessible label for screen readers.
   * Required when there's no visible label.
   */
  'aria-label'?: string;

  /**
   * Visible label text displayed next to the checkbox.
   */
  label?: string;

  /**
   * Whether the checkbox is disabled.
   */
  disabled?: boolean;

  /**
   * Input name for form submission.
   */
  name?: string;

  /**
   * Input value for form submission.
   */
  value?: string;

  /**
   * Additional CSS classes for the container.
   */
  className?: string;
}

/**
 * Checkbox with consistent styling and full accessibility support.
 *
 * Supports controlled mode (with `checked` + `onChange`), uncontrolled mode
 * (with `defaultChecked`), or display-only mode (without `onChange`).
 *
 * @example
 * // Controlled checkbox
 * <Checkbox
 *   checked={isEnabled}
 *   onChange={setIsEnabled}
 *   label="Enable notifications"
 * />
 *
 * @example
 * // Uncontrolled checkbox in a form
 * <Checkbox
 *   defaultChecked
 *   name="remember"
 *   label="Remember me"
 * />
 *
 * @example
 * // Indeterminate state (select all)
 * <Checkbox
 *   indeterminate={someSelected}
 *   checked={allSelected}
 *   onChange={toggleAll}
 *   label="Select all"
 * />
 *
 * @example
 * // Display-only inside a clickable row
 * <Checkbox checked={isSelected} />
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      indeterminate = false,
      'aria-label': ariaLabel,
      label,
      disabled = false,
      size = 'md',
      name,
      value,
      className,
    },
    forwardedRef
  ) => {
    const generatedId = useId();
    const id = name ?? generatedId;
    const inputRef = useRef<HTMLInputElement>(null);

    // Forward ref while keeping local ref for indeterminate sync
    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    // Track internal state for uncontrolled mode
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);

    const isDisplayOnly = !onChange && checked !== undefined;
    const isChecked = isControlled ? checked : internalChecked;

    // Sync indeterminate property to DOM (not controllable via attribute)
    useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = indeterminate;
      }
    }, [indeterminate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalChecked(e.target.checked);
      }
      onChange?.(e.target.checked);
    };

    // Icon sizing based on checkbox size
    const iconClass = {
      sm: 'w-2.5 h-2.5',
      md: 'w-3 h-3',
      lg: 'w-4 h-4',
    }[size ?? 'md'];

    // Shared check/indeterminate icon. Rendered inside the visual box; only
    // visible when the box should show a mark.
    const showMark = isChecked || indeterminate;
    const markIcon = showMark ? (
      <svg
        className={cn('absolute inset-0 m-auto text-white', iconClass)}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={3}
      >
        {indeterminate ? (
          <line x1="5" y1="12" x2="19" y2="12" />
        ) : (
          <polyline points="5 13 10 17 19 7" />
        )}
      </svg>
    ) : null;

    // Display-only mode: render just the visual with aria-hidden
    if (isDisplayOnly) {
      return (
        <div className={cn('inline-flex items-center gap-2', className)} aria-hidden="true">
          <div
            className={cn(
              checkboxVariants({ size, checked: isChecked, indeterminate }),
              'cursor-default'
            )}
          >
            {markIcon}
          </div>
          {label && <span className={labelVariants({ size, checked: isChecked })}>{label}</span>}
        </div>
      );
    }

    return (
      <label
        htmlFor={id}
        className={cn(
          // `relative` contains the sr-only (position:absolute) input below so it
          // can't resolve its containing block to the ICB and leak its static
          // position into the document scroll height inside static scroll containers.
          'relative inline-flex items-center gap-2',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className
        )}
      >
        {/* Hidden native checkbox for form integration and accessibility */}
        <input
          ref={inputRef}
          type="checkbox"
          id={id}
          name={name}
          value={value}
          checked={isControlled ? checked : undefined}
          defaultChecked={isControlled ? undefined : defaultChecked}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-checked={indeterminate ? 'mixed' : undefined}
          className="sr-only peer"
        />

        {/* Visual checkbox */}
        <div
          className={cn(
            checkboxVariants({
              size,
              checked: isChecked,
              indeterminate,
            }),
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[-2px] peer-focus-visible:outline-accent'
          )}
          aria-hidden="true"
        >
          {markIcon}
        </div>

        {/* Optional visible label */}
        {label && <span className={labelVariants({ size, checked: isChecked })}>{label}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';
