/**
 * Editable mm padding stepper for the baseplate panel's spatial schematic.
 *
 * Renders in two orientations:
 * - `horizontal`: [−] [input] [+] with optional label above. Used for front/back edges.
 * - `vertical`:   [+] / [input] / [−] stacked, no visible label. Used for left/right edges
 *                 where the spatial schematic implies the meaning and width must stay narrow.
 *
 * Two stepping rates share a single onChange:
 * - Buttons step in {@link PADDING_BUTTON_STEP} (0.25mm) increments.
 * - Typed input snaps to {@link PADDING_INPUT_STEP} (0.01mm) and is silently clamped
 *   to [{@link PADDING_MIN}, {@link PADDING_MAX}].
 *
 * Keyboard: Enter commits, Escape reverts, Blur commits. NaN reverts silently.
 */

import {
  forwardRef,
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/design-system/cn';
import { MinusIcon, PlusIcon } from '@/design-system/Icon';
import { disabledStyles, focusRing, interactiveTransition } from '@/design-system/variants';
import { useTranslation } from '@/i18n';
import { formatMm, PADDING_BUTTON_STEP, PADDING_MAX, PADDING_MIN, roundMm } from './constants';

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

/**
 * Hook owning the deferred-commit input behavior. Local text is kept while focused
 * so users can freely clear/retype; commits happen on Blur, Enter, or external sync
 * once focus is released. Escape reverts to the external value.
 *
 * The skipBlurCommit ref prevents double-commit when Enter triggers blur (Enter
 * already committed) or when Escape blurs after a revert (we don't want Blur to
 * re-commit the reverted display).
 */
function useEditablePaddingInput(value: number, onChange: (v: number) => void) {
  const [localText, setLocalText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const skipBlurCommitRef = useRef(false);

  const displayValue = isFocused ? localText : formatMm(value);

  const commit = useCallback(
    (text: string) => {
      const parsed = parseFloat(text);
      if (Number.isNaN(parsed)) return;
      const clamped = Math.max(PADDING_MIN, Math.min(PADDING_MAX, parsed));
      // roundMm both snaps to 0.01 step and absorbs IEEE-754 noise.
      onChange(roundMm(clamped));
    },
    [onChange]
  );

  const onChangeInput = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setLocalText(e.target.value);
  }, []);

  const onFocus = useCallback(() => {
    setLocalText(formatMm(value));
    setIsFocused(true);
  }, [value]);

  const onBlur = useCallback(() => {
    if (!skipBlurCommitRef.current) {
      commit(localText);
    }
    skipBlurCommitRef.current = false;
    setIsFocused(false);
  }, [commit, localText]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(localText);
        skipBlurCommitRef.current = true;
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        setLocalText(formatMm(value));
        skipBlurCommitRef.current = true;
        e.currentTarget.blur();
      }
    },
    [commit, localText, value]
  );

  return {
    value: displayValue,
    onChange: onChangeInput,
    onFocus,
    onBlur,
    onKeyDown,
  };
}

const buttonBase = [
  'flex items-center justify-center',
  'border border-stroke-subtle bg-surface-elevated',
  'text-content-tertiary',
  'hover:bg-surface-hover hover:text-content',
  interactiveTransition,
  ...focusRing,
  ...disabledStyles,
];

const inputBase = [
  'bg-surface',
  'border border-stroke-subtle',
  'text-center text-xs tabular-nums text-content-secondary',
  'outline-none',
  interactiveTransition,
  ...focusRing,
  ...disabledStyles,
];

const iconClass = 'w-2.5 h-2.5';
const iconStrokeWidth = 2.5;

export const PaddingStepper = forwardRef<HTMLDivElement, PaddingStepperProps>(
  function PaddingStepper(
    { value, onChange, orientation, 'aria-label': ariaLabel, label, disabled, className },
    ref
  ) {
    const t = useTranslation();
    const inputId = useId();
    const inputProps = useEditablePaddingInput(value, onChange);

    const isDecreaseDisabled = disabled === true || value <= PADDING_MIN;
    const isIncreaseDisabled = disabled === true || value >= PADDING_MAX;

    // roundMm prevents IEEE-754 noise from accumulating across repeated +/- clicks
    // (e.g. 0.25 + 0.25 + ... drifting into values like 1.2500000000000002).
    const handleIncrement = useCallback(() => {
      onChange(roundMm(Math.min(PADDING_MAX, value + PADDING_BUTTON_STEP)));
    }, [onChange, value]);

    const handleDecrement = useCallback(() => {
      onChange(roundMm(Math.max(PADDING_MIN, value - PADDING_BUTTON_STEP)));
    }, [onChange, value]);

    const increaseLabel = t('baseplate.increasePadding', { label: ariaLabel });
    const decreaseLabel = t('baseplate.decreasePadding', { label: ariaLabel });

    if (orientation === 'vertical') {
      return (
        <div ref={ref} className={cn('flex flex-col items-center', className)}>
          <button
            type="button"
            onClick={handleIncrement}
            disabled={isIncreaseDisabled}
            className={cn(buttonBase, 'h-6 w-8 rounded-t-md border-b-0')}
            aria-label={increaseLabel}
          >
            <PlusIcon size="sm" className={iconClass} strokeWidth={iconStrokeWidth} />
          </button>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            className={cn(inputBase, 'h-6 w-8 px-0 py-0.5')}
            aria-label={ariaLabel}
            {...inputProps}
          />
          <button
            type="button"
            onClick={handleDecrement}
            disabled={isDecreaseDisabled}
            className={cn(buttonBase, 'h-6 w-8 rounded-b-md border-t-0')}
            aria-label={decreaseLabel}
          >
            <MinusIcon size="sm" className={iconClass} strokeWidth={iconStrokeWidth} />
          </button>
        </div>
      );
    }

    return (
      <div ref={ref} className={cn('flex w-fit flex-col items-center gap-0.5', className)}>
        {label !== undefined && (
          <label htmlFor={inputId} className="text-xs text-content-tertiary">
            {label}
          </label>
        )}
        <div className="inline-flex h-6 items-center">
          <button
            type="button"
            onClick={handleDecrement}
            disabled={isDecreaseDisabled}
            className={cn(buttonBase, 'h-6 rounded-l-md border-r-0 px-1')}
            aria-label={decreaseLabel}
          >
            <MinusIcon size="sm" className={iconClass} strokeWidth={iconStrokeWidth} />
          </button>
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            className={cn(inputBase, 'h-6 min-w-[40px] rounded-none border-x-0 px-0 py-0')}
            aria-label={ariaLabel}
            {...inputProps}
          />
          <button
            type="button"
            onClick={handleIncrement}
            disabled={isIncreaseDisabled}
            className={cn(buttonBase, 'h-6 rounded-r-md border-l-0 px-1')}
            aria-label={increaseLabel}
          >
            <PlusIcon size="sm" className={iconClass} strokeWidth={iconStrokeWidth} />
          </button>
        </div>
      </div>
    );
  }
);
