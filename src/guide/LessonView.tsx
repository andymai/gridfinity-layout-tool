import { useCallback, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lesson } from './lessons/types';
import { useSandboxState } from './hooks/useSandboxState';
import type { SandboxBin } from './hooks/useSandboxState';
import { useLessonProgress } from './hooks/useLessonProgress';
import { useGuideProgress } from './hooks/useGuideProgress';
import { SandboxGrid } from './components/SandboxGrid';
import { StepInstructions } from './components/StepInstructions';
import { StepProgress, StepProgressBar } from './components/StepProgress';
import { SuccessOverlay } from './components/SuccessOverlay';

interface LessonViewProps {
  lesson: Lesson;
}

/**
 * Individual lesson view with sandbox and step instructions.
 */
export function LessonView({ lesson }: LessonViewProps) {
  const navigate = useNavigate();
  const { markComplete } = useGuideProgress();

  // Track previous bin count for deletion validation
  const previousBinCountRef = useRef(lesson.sandbox.initialBins?.length ?? 0);

  // Initialize sandbox with lesson config
  const sandbox = useSandboxState({
    width: lesson.sandbox.width,
    depth: lesson.sandbox.depth,
    initialBins: (lesson.sandbox.initialBins ?? []).map((bin, index) => ({
      id: `initial-${index}`,
      x: bin.x,
      y: bin.y,
      width: bin.width,
      depth: bin.depth,
      category: bin.category || 'general',
      label: bin.label,
    })),
    categories: lesson.sandbox.categories,
  });

  // Lesson progress management
  const progress = useLessonProgress({
    steps: lesson.steps,
    onStepComplete: (_stepIndex, _step) => {
      // Could add analytics here
    },
    onLessonComplete: () => {
      markComplete(lesson.id);
    },
  });

  // Handle sandbox state changes for step validation
  const handleStateChange = useCallback(
    (bins: SandboxBin[], selectedBinId: string | null) => {
      const advanced = progress.checkAndAdvance(bins, selectedBinId, previousBinCountRef.current);

      // Update previous bin count for next check
      if (!advanced) {
        previousBinCountRef.current = bins.length;
      }
    },
    [progress]
  );

  // Reset lesson
  const handleReset = useCallback(() => {
    sandbox.resetBins();
    progress.resetProgress();
    previousBinCountRef.current = lesson.sandbox.initialBins?.length ?? 0;
  }, [sandbox, progress, lesson.sandbox.initialBins?.length]);

  // Handle lesson completion navigation
  const handleFinish = useCallback(() => {
    navigate('/guide');
  }, [navigate]);

  // Advance after success overlay
  const handleAdvance = useCallback(() => {
    if (progress.isLastStep && progress.isLessonComplete) {
      handleFinish();
    } else {
      progress.advanceToNextStep();
    }
  }, [progress, handleFinish]);

  // Update ref when bins change
  useEffect(() => {
    previousBinCountRef.current = sandbox.bins.length;
  }, [sandbox.bins.length]);

  // Get highlight cells for current step
  const highlightCells =
    progress.currentStep?.highlight?.type === 'cell' || progress.currentStep?.highlight?.type === 'area'
      ? progress.currentStep.highlight.cells || []
      : [];

  return (
    <div className="space-y-6" data-testid="lesson-view">
      {/* Back link */}
      <div>
        <Link
          to="/guide"
          className="inline-flex items-center gap-1 text-sm text-content-secondary hover:text-content transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Lessons
        </Link>
      </div>

      {/* Lesson header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">{lesson.icon}</span>
            <h2 className="text-2xl font-bold text-content">{lesson.title}</h2>
          </div>
          <p className="text-content-secondary">{lesson.tagline}</p>
        </div>

        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm text-content-secondary hover:text-content hover:bg-surface-secondary rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Progress bar */}
      <StepProgressBar
        currentStep={progress.currentStepIndex}
        totalSteps={progress.totalSteps}
        isStepComplete={progress.isStepComplete}
      />

      {/* Main content: sandbox and instructions */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sandbox container */}
        <div className="relative">
          <div className="bg-surface-secondary rounded-xl p-4 flex items-center justify-center">
            <SandboxGrid
              state={sandbox}
              cellSize={36}
              gap={2}
              canDraw={lesson.sandbox.features.canDraw}
              canDrag={lesson.sandbox.features.canDrag}
              canResize={lesson.sandbox.features.canResize}
              canDelete={lesson.sandbox.features.canDelete}
              highlightCells={highlightCells}
              onBinCreated={() => handleStateChange(sandbox.bins, sandbox.selectedBinId)}
              onBinSelected={(id) => handleStateChange(sandbox.bins, id)}
              onBinDeleted={() => handleStateChange(sandbox.bins, sandbox.selectedBinId)}
            />
          </div>

          {/* Success overlay */}
          {progress.showSuccess && progress.lastSuccessMessage && (
            <SuccessOverlay
              message={progress.lastSuccessMessage}
              onDismiss={progress.dismissSuccess}
              onAdvance={handleAdvance}
              isLastStep={progress.isLastStep}
            />
          )}
        </div>

        {/* Instructions panel */}
        <div className="space-y-6">
          {/* Step progress dots */}
          <StepProgress
            currentStep={progress.currentStepIndex}
            totalSteps={progress.totalSteps}
            isStepComplete={progress.isStepComplete}
            onStepClick={progress.goToStep}
          />

          {/* Current step instructions */}
          {progress.currentStep && (
            <StepInstructions
              step={progress.currentStep}
              stepNumber={progress.currentStepIndex + 1}
              totalSteps={progress.totalSteps}
              isComplete={progress.isStepComplete(progress.currentStepIndex)}
            />
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 pt-4 border-t border-stroke">
            <button
              onClick={progress.goToPreviousStep}
              disabled={progress.isFirstStep}
              className="px-4 py-2 text-sm text-content-secondary hover:text-content disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Previous
            </button>

            {progress.isLessonComplete && (
              <button
                onClick={handleFinish}
                className="px-4 py-2 text-sm bg-success hover:bg-success/80 text-white rounded-lg transition-colors ml-auto"
              >
                Complete Lesson
              </button>
            )}
          </div>

          {/* Category selector for lessons that allow category changes */}
          {lesson.sandbox.features.canChangeCategory && sandbox.categories.length > 1 && (
            <div className="pt-4 border-t border-stroke">
              <div className="text-sm text-content-secondary mb-2">Category:</div>
              <div className="flex gap-2 flex-wrap">
                {sandbox.categories.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => sandbox.setActiveCategory(category.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      sandbox.activeCategory === category.id
                        ? 'ring-2 ring-offset-2 ring-offset-surface ring-white/50 shadow-md'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      backgroundColor: category.color,
                      color: '#fff',
                    }}
                    aria-pressed={sandbox.activeCategory === category.id}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
