import { useState } from 'react';
import type { LessonStep } from '../lessons/types';

interface StepInstructionsProps {
  step: LessonStep;
  stepNumber: number;
  totalSteps: number;
  isComplete: boolean;
}

/**
 * Displays the current step's instructions, detail, and tip.
 */
export function StepInstructions({
  step,
  stepNumber,
  totalSteps,
  isComplete,
}: StepInstructionsProps) {
  const [tipExpanded, setTipExpanded] = useState(false);

  return (
    <div className="space-y-4">
      {/* Step counter */}
      <div className="text-sm text-content-secondary">
        Step {stepNumber} of {totalSteps}
      </div>

      {/* Main instruction */}
      <div className="space-y-2">
        <h3
          className={`text-lg font-semibold transition-colors ${
            isComplete ? 'text-success' : 'text-content'
          }`}
        >
          {isComplete && (
            <span className="inline-block mr-2">
              <svg
                className="w-5 h-5 inline text-success"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          {step.instruction}
        </h3>

        {/* Additional detail */}
        {step.detail && (
          <p className="text-content-secondary">{step.detail}</p>
        )}
      </div>

      {/* Pro tip (collapsible) */}
      {step.tip && (
        <div className="mt-4">
          <button
            onClick={() => setTipExpanded(!tipExpanded)}
            className="flex items-center gap-2 text-sm text-content-tertiary hover:text-content-secondary transition-colors"
          >
            <span className="text-amber-500">💡</span>
            <span>Pro tip</span>
            <svg
              className={`w-4 h-4 transition-transform ${tipExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {tipExpanded && (
            <div className="mt-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-content-secondary">
              {step.tip}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
