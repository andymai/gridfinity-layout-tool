import { forwardRef } from 'react';
import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../cn';
import { sizeText } from '../variants';

const fieldLabelVariants = cva(sizeText.sm, {
  variants: {
    tone: {
      tertiary: 'text-content-tertiary',
      secondary: ['text-content-secondary', 'font-medium'],
    },
  },
  defaultVariants: {
    tone: 'tertiary',
  },
});

type FieldLabelVariantProps = VariantProps<typeof fieldLabelVariants>;

export interface FieldProps {
  /**
   * Caption text.
   */
  label: string;

  /**
   * When the child is a real input/select/textarea, renders `<label htmlFor>`;
   * otherwise a `<span>` caption (segment groups, steppers — non-labelable composites).
   */
  htmlFor?: string;

  /**
   * Right-aligned readout in the caption row (live value + unit, e.g. "42mm").
   */
  trailing?: ReactNode;

  /**
   * Help/fit note below the control.
   */
  hint?: ReactNode;

  /**
   * Error note below the control. When `htmlFor` is given, the error line
   * gets id `${htmlFor}-error` for aria-describedby wiring on the control.
   */
  error?: string;

  /**
   * Caption emphasis.
   * @default 'tertiary'
   */
  labelTone?: NonNullable<FieldLabelVariantProps['tone']>;

  children: ReactNode;

  /**
   * Additional classes for the wrapper element.
   */
  className?: string;
}

/**
 * Caption-above-control field wrapper: label row (with optional trailing
 * readout), the control, and an optional hint or error line below.
 *
 * @example
 * <Field label="Width">
 *   <StepperControl value={width} onChange={setWidth} />
 * </Field>
 *
 * @example
 * // Labelable control with native association
 * <Field label="Pattern" htmlFor="pattern-select">
 *   <Select id="pattern-select" options={patterns} value={pattern} onChange={setPattern} />
 * </Field>
 *
 * @example
 * // Live value readout + fit note
 * <Field label="Compartment size" trailing="42mm" hint="≥ 40mm (+2mm)">
 *   <Slider value={size} onChange={setSize} aria-label="Compartment size" />
 * </Field>
 *
 * @example
 * // Error wiring
 * <Field label="Name" htmlFor="name-input" error="Name is required">
 *   <Input id="name-input" aria-describedby="name-input-error" />
 * </Field>
 */
export const Field = forwardRef<HTMLDivElement, FieldProps>(
  ({ label, htmlFor, trailing, hint, error, labelTone = 'tertiary', children, className }, ref) => {
    const labelClassName = fieldLabelVariants({ tone: labelTone });
    const errorId = htmlFor ? `${htmlFor}-error` : undefined;

    return (
      <div ref={ref} className={className}>
        <div className={cn('flex items-center justify-between', 'mb-1')}>
          {htmlFor ? (
            <label htmlFor={htmlFor} className={labelClassName}>
              {label}
            </label>
          ) : (
            <span className={labelClassName}>{label}</span>
          )}
          {trailing}
        </div>

        {children}

        {hint !== undefined && hint !== null && !error && (
          <div className={cn('mt-1', sizeText.sm, 'text-content-tertiary')}>{hint}</div>
        )}

        {error && (
          <div id={errorId} className={cn('mt-1', sizeText.sm, 'text-error')}>
            {error}
          </div>
        )}
      </div>
    );
  }
);

Field.displayName = 'Field';
