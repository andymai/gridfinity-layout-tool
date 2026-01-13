import { Link } from 'react-router-dom';
import type { LessonMeta } from '../lessons/types';

interface LessonCardProps {
  lesson: LessonMeta;
  isComplete: boolean;
  index: number;
}

/**
 * Card displaying lesson info in the guide overview.
 */
export function LessonCard({ lesson, isComplete, index }: LessonCardProps) {
  return (
    <Link
      to={`/guide/${lesson.id}`}
      className="group relative block p-6 rounded-xl bg-surface-secondary border border-stroke hover:border-accent transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
      style={{
        animationDelay: `${index * 50}ms`,
      }}
    >
      {/* Completion badge */}
      {isComplete && (
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-md">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Icon and title */}
      <div className="flex items-start gap-4">
        <div className="text-3xl" role="img" aria-label={lesson.title}>
          {lesson.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-content group-hover:text-accent transition-colors">
            {lesson.title}
          </h3>
          <p className="text-sm text-content-secondary mt-0.5">{lesson.tagline}</p>
        </div>
      </div>

      {/* Description */}
      <p className="mt-4 text-sm text-content-tertiary line-clamp-2">{lesson.description}</p>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          {/* Difficulty badge */}
          <span
            className={`px-2 py-0.5 rounded-full ${
              lesson.difficulty === 'beginner'
                ? 'bg-success/10 text-success'
                : 'bg-warning/10 text-warning'
            }`}
          >
            {lesson.difficulty}
          </span>

          {/* Time estimate */}
          <span className="text-content-tertiary">~{lesson.estimatedMinutes} min</span>
        </div>

        {/* Arrow indicator */}
        <svg
          className="w-4 h-4 text-content-tertiary group-hover:text-accent group-hover:translate-x-1 transition-all"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
