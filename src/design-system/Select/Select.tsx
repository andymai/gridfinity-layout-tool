import { forwardRef, useId } from 'react';
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
    'pr-10', // Space for chevron
    'cursor-pointer',
    interactiveTransition,
    'hover:border-stroke-strong',
    ...focusRing,
    ...disabledStyles,
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
      },
      fullWidth: {
        true: 'w-full',
      },
      hasColorSwatch: {
        true: 'pl-10', // Space for color swatch
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

type SelectVariantProps = Omit<VariantProps<typeof selectVariants>, 'hasColorSwatch' | 'error'>;

export interface SelectOption {
  /**
   * Unique value for this option.
   */
  value: string;

  /**
   * Display label for this option.
   */
  label: string;

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
   * Error state styling.
   */
  error?: boolean;

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
 * // Basic select
 * <Select
 *   value={sortOrder}
 *   onChange={e => setSortOrder(e.target.value)}
 *   options={[
 *     { value: 'name', label: 'Name' },
 *     { value: 'date', label: 'Date' },
 *   ]}
 *   aria-label="Sort by"
 * />
 *
 * @example
 * // With placeholder
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
 *   onChange={e => setSelectedCategory(e.target.value)}
 *   options={categories}
 *   colorSwatch={getCategoryColor(selectedCategory)}
 * />
 *
 * @example
 * // Full width
 * <Select
 *   fullWidth
 *   value={value}
 *   onChange={handleChange}
 *   options={options}
 * />
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      options,
      placeholder,
      colorSwatch,
      size = 'md',
      fullWidth,
      error,
      className,
      id: providedId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId ?? generatedId;
    const hasColorSwatch = colorSwatch !== undefined;

    const iconSize = {
      sm: 'w-4 h-4',
      md: 'w-4 h-4',
      lg: 'w-5 h-5',
    }[size ?? 'md'];

    return (
      <div className={selectWrapperVariants({ fullWidth })}>
        {/* Color swatch indicator */}
        {hasColorSwatch && (
          <div
            className={cn(
              'absolute left-3 top-1/2 -translate-y-1/2',
              'w-4 h-4 rounded',
              'pointer-events-none',
              colorSwatch ? '' : 'bg-surface-hover border border-stroke-subtle'
            )}
            style={colorSwatch ? { backgroundColor: colorSwatch } : undefined}
            aria-hidden="true"
          />
        )}

        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={error || undefined}
          className={cn(selectVariants({ size, fullWidth, hasColorSwatch, error }), className)}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Chevron indicator */}
        <ChevronDownIcon
          size="sm"
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2',
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
