import { IconButton, MinusIcon, PlusIcon } from '@/design-system';

interface BulkIncrementControlProps {
  /** Display value (can include range like "3–5u" or single value like "4u") */
  displayValue: string;
  /** Called with -1 or +1 when step buttons are clicked */
  onStep: (delta: number) => void;
  /** Aria label prefix (e.g., "height for all bins" → "Decrease height for all bins") */
  ariaLabelPrefix: string;
  /** Whether decrease button is disabled */
  decreaseDisabled?: boolean;
  /** Whether increase button is disabled */
  increaseDisabled?: boolean;
  /** Platform variant affects button sizing */
  variant?: 'desktop' | 'mobile';
}

/**
 * Bulk increment/decrement control with +/- buttons flanking a value display.
 * Used for adjusting properties across multiple selected items.
 */
export function BulkIncrementControl({
  displayValue,
  onStep,
  ariaLabelPrefix,
  decreaseDisabled = false,
  increaseDisabled = false,
  variant = 'desktop',
}: BulkIncrementControlProps) {
  const isMobile = variant === 'mobile';
  const btnSize = isMobile ? 'lg' : 'md';
  const valueSize = isMobile ? 'text-xl' : 'text-lg';

  return (
    <div className="flex items-center gap-2">
      <IconButton
        variant="secondary"
        size={btnSize}
        touchTarget={false}
        className={isMobile ? undefined : 'h-10 w-10'}
        onClick={() => onStep(-1)}
        disabled={decreaseDisabled}
        aria-label={`Decrease ${ariaLabelPrefix}`}
      >
        <MinusIcon size="sm" />
      </IconButton>
      <span className={`flex-1 text-center font-semibold ${valueSize} text-content`}>
        {displayValue}
      </span>
      <IconButton
        variant="secondary"
        size={btnSize}
        touchTarget={false}
        className={isMobile ? undefined : 'h-10 w-10'}
        onClick={() => onStep(1)}
        disabled={increaseDisabled}
        aria-label={`Increase ${ariaLabelPrefix}`}
      >
        <PlusIcon size="sm" />
      </IconButton>
    </div>
  );
}
