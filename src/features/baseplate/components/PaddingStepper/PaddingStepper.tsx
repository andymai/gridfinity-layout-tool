/**
 * Editable mm padding stepper for the baseplate panel's spatial schematic.
 *
 * A thin wrapper over the design-system {@link Stepper}, adding padding-specific
 * behavior: buttons step in {@link PADDING_BUTTON_STEP} (0.25mm), typed values
 * are clamped to [{@link PADDING_MIN}, {@link PADDING_MAX}] and snapped to 0.01mm
 * via {@link roundMm} (which also absorbs IEEE-754 noise from repeated clicks).
 *
 * Renders in two orientations:
 * - `horizontal`: [−] [input] [+] with optional label above. Used for front/back edges.
 * - `vertical`:   [+] / [input] / [−] stacked, no visible label. Used for left/right edges
 *                 where the spatial schematic implies the meaning and width must stay narrow.
 */

import { forwardRef, useId } from 'react';
import { cn } from '@/design-system/cn';
import { Stepper } from '@/design-system/Stepper';
import { useTranslation } from '@/i18n';
import { PADDING_BUTTON_STEP, PADDING_MAX, PADDING_MIN, roundMm } from './constants';

interface PaddingStepperProps {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly orientation: 'horizontal' | 'vertical';
  readonly 'aria-label': string;
  /** Optional visible label rendered above the stepper (horizontal only). */
  readonly label?: string;
  readonly disabled?: boolean;
  readonly className?: string;
}

export const PaddingStepper = forwardRef<HTMLDivElement, PaddingStepperProps>(
  function PaddingStepper(
    { value, onChange, orientation, 'aria-label': ariaLabel, label, disabled, className },
    ref
  ) {
    const t = useTranslation();
    const inputId = useId();

    const stepper = (
      <Stepper
        id={inputId}
        size={orientation === 'vertical' ? 'sm' : 'md'}
        orientation={orientation}
        value={value}
        onChange={(v) => onChange(roundMm(v))}
        onStep={(delta) =>
          onChange(
            roundMm(
              Math.max(PADDING_MIN, Math.min(PADDING_MAX, value + delta * PADDING_BUTTON_STEP))
            )
          )
        }
        min={PADDING_MIN}
        max={PADDING_MAX}
        step={PADDING_BUTTON_STEP}
        inputDecimals={2}
        disabled={disabled}
        aria-label={ariaLabel}
        increaseLabel={t('baseplate.increasePadding', { label: ariaLabel })}
        decreaseLabel={t('baseplate.decreasePadding', { label: ariaLabel })}
      />
    );

    // Label sits above the stepper in both orientations so every edge (back,
    // front, left, right) is labeled consistently.
    return (
      <div ref={ref} className={cn('flex w-fit flex-col items-center gap-0.5', className)}>
        {label !== undefined && (
          <label htmlFor={inputId} className="text-xs text-content-tertiary">
            {label}
          </label>
        )}
        {stepper}
      </div>
    );
  }
);
