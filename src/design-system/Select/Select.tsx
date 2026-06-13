import { forwardRef, useId, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { ChevronDownIcon } from '../Icon';
import { focusRing, disabledStyles, interactiveTransition } from '../variants';

const selectWrapperVariants = cva(['relative', 'inline-flex'], {
  variants: {
    fullWidth: {
      true: 'w-full',
    },
  },
});

const selectVariants = cva(
  [
    'appearance-none',
    'bg-surface',
    'text-content',
    'border border-stroke',
    'rounded-md',
    'pr-8', // Space for chevron
    'cursor-pointer',
    interactiveTransition,
    'hover:border-stroke-strong',
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'h-7 px-1.5 text-xs',
        md: 'py-2 px-3 text-sm',
        lg: 'h-12 px-5 text-base',
      },
      fullWidth: {
        true: 'w-full',
      },
      hasStartAdornment: {
        true: 'pl-8', // Space for a leading swatch or icon
      },
      error: {
        true: 'border-error focus:border-error',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

type SelectVariantProps = Omit<VariantProps<typeof selectVariants>, 'hasStartAdornment' | 'error'>;

export interface SelectOption {
  /**
   * Unique value for this option.
   */
  id: string;

  /**
   * Display label for this option.
   */
  name: string;

  /**
   * Optional suffix displayed after the name (e.g., unit indicator).
   */
  suffix?: string;

  /**
   * Whether this option is disabled.
   */
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>, SelectVariantProps {
  /**
   * List of options to display.
   */
  options: SelectOption[];

  /**
   * Placeholder shown when no value is selected.
   */
  placeholder?: string;

  /**
   * Color swatch displayed at the start.
   * - String: Shows a colored square with that color
   * - null: Shows a "mixed" indicator (gray square)
   * - undefined: No swatch shown
   */
  colorSwatch?: string | null;

  /**
   * Icon or node displayed at the start of the select.
   * Use for non-color adornments (e.g. a preview glyph). Ignored when
   * `colorSwatch` is set — the swatch takes the start slot.
   */
  leftIcon?: ReactNode;

  /**
   * Error state styling.
   */
  error?: boolean;

  /**
   * Convenience callback that receives the new value string directly.
   * Alternative to using `onChange` with `e.target.value`.
   */
  onValueChange?: (value: string) => void;

  /**
   * Accessible label for screen readers.
   * Required when there's no visible label.
   */
  'aria-label'?: string;
}

/**
 * Native select dropdown with consistent styling.
 *
 * Uses the native `<select>` element for best accessibility and mobile experience.
 *
 * @example
 * // Basic select with onValueChange
 * <Select
 *   value={sortOrder}
 *   onValueChange={setSortOrder}
 *   options={[
 *     { id: 'name', name: 'Name' },
 *     { id: 'date', name: 'Date' },
 *   ]}
 *   aria-label="Sort by"
 * />
 *
 * @example
 * // With placeholder (native onChange also supported)
 * <Select
 *   value={category}
 *   onChange={e => setCategory(e.target.value)}
 *   options={categories}
 *   placeholder="Select a category"
 * />
 *
 * @example
 * // With color swatch (for category selection)
 * <Select
 *   value={selectedCategory}
 *   onValueChange={setSelectedCategory}
 *   options={categories}
 *   colorSwatch={getCategoryColor(selectedCategory)}
 * />
 *
 * @example
 * // With a custom leading icon (non-color adornment)
 * <Select
 *   value={pattern}
 *   onValueChange={setPattern}
 *   options={patterns}
 *   leftIcon={<HoneycombIcon className="w-4 h-4" />}
 * />
 *
 * @example
 * // Full width
 * <Select
 *   fullWidth
 *   value={value}
 *   onValueChange={handleChange}
 *   options={options}
 * />
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      placeholder,
      colorSwatch,
      leftIcon,
      size = 'md',
      fullWidth,
      error,
      onValueChange,
      className,
      id: providedId,
      disabled,
      onChange: onChangeProp,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const hasColorSwatch = colorSwatch !== undefined;
    const hasStartAdornment = hasColorSwatch || Boolean(leftIcon);

    const iconSize = {
      sm: 'w-3 h-3',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    }[size ?? 'md'];

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChangeProp?.(e);
      onValueChange?.(e.target.value);
    };

    return (
      <div className={selectWrapperVariants({ fullWidth })}>
        {/* Start adornment: color swatch takes precedence over a custom icon */}
        {hasStartAdornment && (
          <div
            className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none"
            aria-hidden="true"
          >
            {hasColorSwatch ? (
              <span
                className={cn(
                  'w-4 h-4 rounded',
                  colorSwatch ? '' : 'bg-surface-hover border border-stroke-subtle'
                )}
                style={colorSwatch ? { backgroundColor: colorSwatch } : undefined}
              />
            ) : (
              leftIcon
            )}
          </div>
        )}

        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(selectVariants({ size, fullWidth, hasStartAdornment, error }), className)}
          onChange={handleChange}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.id} value={option.id} disabled={option.disabled}>
              {option.name}
              {option.suffix ? ` ${option.suffix}` : ''}
            </option>
          ))}
        </select>

        {/* Chevron indicator */}
        <ChevronDownIcon
          size="sm"
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2',
            'text-content-tertiary',
            'pointer-events-none',
            iconSize
          )}
          aria-hidden="true"
        />
      </div>
    );
  }
);

Select.displayName = 'Select';
