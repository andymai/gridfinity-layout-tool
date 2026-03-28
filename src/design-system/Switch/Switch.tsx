import { forwardRef, useId, useState, useRef, useImperativeHandle } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';

const trackVariants = cva(
  ['relative', 'inline-flex items-center', 'rounded-full', 'transition-colors duration-200'],
  {
    variants: {
      size: {
        sm: 'h-5 w-9',
        md: 'h-6 w-11',
        lg: 'h-7 w-12',
      },
      checked: {
        true: 'bg-accent',
        false: 'bg-surface-secondary border border-stroke',
      },
    },
    defaultVariants: {
      size: 'md',
      checked: false,
    },
  }
);

const thumbVariants = cva(
  ['inline-block', 'rounded-full', 'bg-white', 'shadow', 'transition-transform duration-200'],
  {
    variants: {
      size: {
        sm: 'h-3.5 w-3.5',
        md: 'h-5 w-5',
        lg: 'h-5 w-5',
      },
      checked: {
        true: '',
        false: 'translate-x-0.5',
      },
    },
    compoundVariants: [
      { size: 'sm', checked: true, class: 'translate-x-[18px]' },
      { size: 'md', checked: true, class: 'translate-x-5' },
      { size: 'lg', checked: true, class: 'translate-x-6' },
    ],
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

type SwitchVariantProps = Omit<VariantProps<typeof trackVariants>, 'checked'>;

export interface SwitchProps extends SwitchVariantProps {
  /** Whether the switch is on (controlled mode). */
  checked?: boolean;

  /** Whether the switch starts on (uncontrolled mode). */
  defaultChecked?: boolean;

  /** Called when the switch value changes. */
  onChange?: (checked: boolean) => void;

  /** Accessible label for screen readers. Required when there's no visible label. */
  'aria-label'?: string;

  /** Visible label text displayed next to the switch. */
  label?: string;

  /** Whether the switch is disabled. */
  disabled?: boolean;

  /** Input name for form submission. */
  name?: string;

  /** Additional CSS classes for the container. */
  className?: string;
}

/**
 * Toggle switch with consistent styling and full accessibility support.
 *
 * Uses a hidden native checkbox with role="switch" for proper semantics.
 * Supports controlled mode (with `checked` + `onChange`) and uncontrolled
 * mode (with `defaultChecked`).
 *
 * @example
 * // Controlled switch
 * <Switch
 *   checked={isEnabled}
 *   onChange={setIsEnabled}
 *   label="Enable feature"
 * />
 *
 * @example
 * // Uncontrolled switch
 * <Switch defaultChecked name="notifications" label="Notifications" />
 *
 * @example
 * // Icon-only switch with aria-label
 * <Switch checked={isDark} onChange={setIsDark} aria-label="Dark mode" />
 */
export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  (
    {
      checked,
      defaultChecked,
      onChange,
      'aria-label': ariaLabel,
      label,
      disabled = false,
      size = 'md',
      name,
      className,
    },
    forwardedRef
  ) => {
    const id = useId();
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement);

    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);
    const isChecked = isControlled ? checked : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalChecked(e.target.checked);
      }
      onChange?.(e.target.checked);
    };

    return (
      <label
        htmlFor={id}
        className={cn(
          'inline-flex items-center gap-2',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
          className
        )}
      >
        {/* Hidden native checkbox for form integration and accessibility */}
        <input
          ref={inputRef}
          type="checkbox"
          role="switch"
          id={id}
          name={name}
          checked={isControlled ? checked : undefined}
          defaultChecked={isControlled ? undefined : defaultChecked}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
          className="sr-only peer"
        />

        {/* Visual track + thumb */}
        <div
          className={cn(
            trackVariants({ size, checked: isChecked }),
            'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent'
          )}
          aria-hidden="true"
        >
          <span className={thumbVariants({ size, checked: isChecked })} />
        </div>

        {/* Optional visible label */}
        {label && <span className={labelVariants({ size, checked: isChecked })}>{label}</span>}
      </label>
    );
  }
);

Switch.displayName = 'Switch';
