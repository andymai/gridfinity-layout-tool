interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  isStepComplete: (index: number) => boolean;
  onStepClick?: (index: number) => void;
}

/**
 * Step progress indicator with clickable dots.
 */
export function StepProgress({
  currentStep,
  totalSteps,
  isStepComplete,
  onStepClick,
}: StepProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, index) => {
        const isComplete = isStepComplete(index);
        const isCurrent = index === currentStep;
        const isClickable = onStepClick && (isComplete || index < currentStep);

        return (
          <button
            key={index}
            onClick={() => isClickable && onStepClick?.(index)}
            disabled={!isClickable}
            className={`
              relative w-3 h-3 rounded-full transition-all duration-200
              ${isComplete ? 'bg-success' : isCurrent ? 'bg-accent' : 'bg-stroke'}
              ${isClickable ? 'cursor-pointer hover:scale-125' : 'cursor-default'}
              ${isCurrent && !isComplete ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent/50' : ''}
            `}
            aria-label={`Step ${index + 1}${isComplete ? ' (complete)' : isCurrent ? ' (current)' : ''}`}
            title={`Step ${index + 1}`}
          >
            {/* Checkmark for completed steps */}
            {isComplete && (
              <svg
                className="absolute inset-0 w-3 h-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={4}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Progress bar variant for larger displays.
 */
export function StepProgressBar({
  currentStep,
  totalSteps,
  isStepComplete,
}: Omit<StepProgressProps, 'onStepClick'>) {
  const completedCount = Array.from({ length: totalSteps }, (_, i) => isStepComplete(i)).filter(
    Boolean
  ).length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-content-secondary">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="text-content-tertiary">{progressPercent}% complete</span>
      </div>

      <div className="h-2 bg-stroke rounded-full overflow-hidden">
        <div
          className="h-full bg-success transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}
