import { useState, useCallback, useMemo } from 'react';
import type { LessonStep, ValidationRule } from '../lessons/types';
import type { SandboxBin } from './useSandboxState';

interface LessonProgressConfig {
  steps: LessonStep[];
  onStepComplete?: (stepIndex: number, step: LessonStep) => void;
  onLessonComplete?: () => void;
}

/**
 * Hook for managing lesson step progression and validation.
 */
export function useLessonProgress(config: LessonProgressConfig) {
  const { steps, onStepComplete, onLessonComplete } = config;

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSuccessMessage, setLastSuccessMessage] = useState<string | null>(null);

  // Current step
  const currentStep = useMemo(
    () => (currentStepIndex < steps.length ? steps[currentStepIndex] : null),
    [steps, currentStepIndex]
  );

  // Is lesson complete?
  const isLessonComplete = useMemo(
    () => completedSteps.size === steps.length,
    [completedSteps.size, steps.length]
  );

  /**
   * Validate a step's completion based on sandbox state.
   */
  const validateStep = useCallback(
    (
      stepIndex: number,
      bins: SandboxBin[],
      selectedBinId: string | null,
      previousBinCount: number
    ): boolean => {
      if (stepIndex >= steps.length) return false;
      const step = steps[stepIndex];
      const rule = step.validation;

      return evaluateValidationRule(rule, bins, selectedBinId, previousBinCount);
    },
    [steps]
  );

  /**
   * Check if current step is complete and advance if so.
   */
  const checkAndAdvance = useCallback(
    (bins: SandboxBin[], selectedBinId: string | null, previousBinCount: number): boolean => {
      if (currentStepIndex >= steps.length) return false;
      if (completedSteps.has(currentStepIndex)) return false;

      const isValid = validateStep(currentStepIndex, bins, selectedBinId, previousBinCount);

      if (isValid) {
        const step = steps[currentStepIndex];

        // Mark step as complete
        setCompletedSteps((prev) => new Set([...prev, currentStepIndex]));

        // Show success message
        setLastSuccessMessage(step.successMessage);
        setShowSuccess(true);

        // Notify callback
        onStepComplete?.(currentStepIndex, step);

        // Check if lesson is complete
        if (currentStepIndex === steps.length - 1) {
          onLessonComplete?.();
        }

        return true;
      }

      return false;
    },
    [currentStepIndex, steps, completedSteps, validateStep, onStepComplete, onLessonComplete]
  );

  /**
   * Move to next step (after success animation).
   */
  const advanceToNextStep = useCallback(() => {
    setShowSuccess(false);
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [currentStepIndex, steps.length]);

  /**
   * Go to a specific step (for navigation).
   */
  const goToStep = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < steps.length) {
        setShowSuccess(false);
        setCurrentStepIndex(stepIndex);
      }
    },
    [steps.length]
  );

  /**
   * Go to previous step.
   */
  const goToPreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setShowSuccess(false);
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  /**
   * Reset lesson progress.
   */
  const resetProgress = useCallback(() => {
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    setShowSuccess(false);
    setLastSuccessMessage(null);
  }, []);

  /**
   * Dismiss success overlay.
   */
  const dismissSuccess = useCallback(() => {
    setShowSuccess(false);
  }, []);

  return {
    // State
    currentStepIndex,
    currentStep,
    completedSteps,
    totalSteps: steps.length,
    showSuccess,
    lastSuccessMessage,
    isLessonComplete,

    // Progress info
    progressPercent: Math.round((completedSteps.size / steps.length) * 100),
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === steps.length - 1,
    isStepComplete: (index: number) => completedSteps.has(index),

    // Actions
    validateStep,
    checkAndAdvance,
    advanceToNextStep,
    goToStep,
    goToPreviousStep,
    resetProgress,
    dismissSuccess,
  };
}

/**
 * Evaluate a validation rule against the current sandbox state.
 */
function evaluateValidationRule(
  rule: ValidationRule,
  bins: SandboxBin[],
  selectedBinId: string | null,
  previousBinCount: number
): boolean {
  switch (rule.type) {
    case 'always':
      return true;

    case 'bin_count': {
      const params = rule.params as { min?: number; max?: number; exact?: number } | undefined;
      const count = bins.length;

      if (params?.exact !== undefined) {
        return count === params.exact;
      }
      if (params?.min !== undefined && count < params.min) {
        return false;
      }
      if (params?.max !== undefined && count > params.max) {
        return false;
      }
      // Default: at least one bin
      return count >= (params?.min ?? 1);
    }

    case 'bin_exists': {
      const params = rule.params as {
        width?: number;
        depth?: number;
        x?: number;
        y?: number;
        category?: string;
      } | undefined;

      return bins.some((bin) => {
        if (params?.width !== undefined && bin.width !== params.width) return false;
        if (params?.depth !== undefined && bin.depth !== params.depth) return false;
        if (params?.x !== undefined && bin.x !== params.x) return false;
        if (params?.y !== undefined && bin.y !== params.y) return false;
        if (params?.category !== undefined && bin.category !== params.category) return false;
        return true;
      });
    }

    case 'bin_selected':
      return selectedBinId !== null;

    case 'bin_resized': {
      // Check if any bin was resized (different from original size)
      const params = rule.params as {
        minWidth?: number;
        minDepth?: number;
        fromWidth?: number;
        fromDepth?: number;
      } | undefined;

      if (!selectedBinId) return false;
      const selectedBin = bins.find((b) => b.id === selectedBinId);
      if (!selectedBin) return false;

      // If specific size requirements
      if (params?.minWidth !== undefined && selectedBin.width < params.minWidth) return false;
      if (params?.minDepth !== undefined && selectedBin.depth < params.minDepth) return false;

      // If checking resize from specific size
      if (params?.fromWidth !== undefined && params?.fromDepth !== undefined) {
        return selectedBin.width !== params.fromWidth || selectedBin.depth !== params.fromDepth;
      }

      // Default: just check bin is selected (resize would have happened)
      return true;
    }

    case 'bin_deleted': {
      // Check if bin count decreased
      return bins.length < previousBinCount;
    }

    case 'category_changed': {
      // Check if selected bin has a specific category
      const params = rule.params as { category?: string } | undefined;

      if (!selectedBinId) return false;
      const selectedBin = bins.find((b) => b.id === selectedBinId);
      if (!selectedBin) return false;

      if (params?.category !== undefined) {
        return selectedBin.category === params.category;
      }

      // Default: any non-default category
      return selectedBin.category !== 'general';
    }

    default:
      return false;
  }
}

export type LessonProgressState = ReturnType<typeof useLessonProgress>;
