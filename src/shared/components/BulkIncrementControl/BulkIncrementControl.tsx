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

  // Button sizing for mobile vs desktop
  const btnSize = isMobile ? 'w-12 h-12' : 'w-10 h-10';
  const btnMinSize = isMobile ? 'min-w-[48px] min-h-[48px]' : 'min-w-[40px] min-h-[40px]';
  const valueSize = isMobile ? 'text-xl' : 'text-lg';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onStep(-1)}
        disabled={decreaseDisabled}
        className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
        aria-label={`Decrease ${ariaLabelPrefix}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <span className={`flex-1 text-center font-semibold ${valueSize} text-content`}>
        {displayValue}
      </span>
      <button
        type="button"
        onClick={() => onStep(1)}
        disabled={increaseDisabled}
        className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
        aria-label={`Increase ${ariaLabelPrefix}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
