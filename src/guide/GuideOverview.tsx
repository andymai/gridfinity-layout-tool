import { LessonCard } from './components/LessonCard';
import { lessonMetas, TOTAL_LESSONS } from './lessons';
import { useGuideProgress } from './hooks/useGuideProgress';

/**
 * Guide overview page showing all available lessons.
 */
export function GuideOverview() {
  const { isComplete, completionCount, resetProgress } = useGuideProgress();

  return (
    <div className="space-y-8" data-testid="guide-overview">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-2xl sm:text-3xl font-bold text-content">
          Learn Gridfinity Layout Tool
        </h2>
        <p className="text-content-secondary max-w-md mx-auto">
          Interactive lessons to get you from zero to organized in minutes.
          No prior experience required — just bring your enthusiasm for tidy drawers.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {lessonMetas.map((lesson) => (
              <div
                key={lesson.id}
                className={`w-3 h-3 rounded-full transition-colors ${
                  isComplete(lesson.id) ? 'bg-success' : 'bg-stroke'
                }`}
                title={lesson.title}
              />
            ))}
          </div>
          <span className="text-sm text-content-secondary">
            {completionCount} / {TOTAL_LESSONS} complete
          </span>
        </div>

        {completionCount > 0 && (
          <button
            onClick={resetProgress}
            className="text-xs text-content-tertiary hover:text-content transition-colors"
          >
            Reset progress
          </button>
        )}
      </div>

      {/* Lesson cards grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {lessonMetas.map((lesson, index) => (
          <LessonCard
            key={lesson.id}
            lesson={lesson}
            isComplete={isComplete(lesson.id)}
            index={index}
          />
        ))}
      </div>

      {/* Completion message */}
      {completionCount === TOTAL_LESSONS && (
        <div className="text-center p-6 rounded-xl bg-success/10 border border-success/30">
          <div className="text-2xl mb-2">🎉</div>
          <h3 className="font-semibold text-success">You've completed all lessons!</h3>
          <p className="text-sm text-content-secondary mt-1">
            You're now a Gridfinity Layout Tool pro. Go forth and organize!
          </p>
        </div>
      )}
    </div>
  );
}
