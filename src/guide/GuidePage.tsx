import { Link, useParams } from 'react-router-dom';
import { GuideOverview } from './GuideOverview';
import { getLessonMeta } from './lessons';

/**
 * Main guide page container.
 * Renders either the overview or a specific lesson based on URL params.
 */
export function GuidePage() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  const lessonMeta = lessonId ? getLessonMeta(lessonId) : null;

  return (
    <div className="min-h-screen bg-surface text-content" data-testid="guide-page">
      {/* Header */}
      <header className="border-b border-stroke px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/guide"
              className="text-xl font-bold hover:text-accent transition-colors"
            >
              Gridfinity Guide
            </Link>
            {lessonMeta && (
              <>
                <span className="text-content-tertiary">/</span>
                <span className="text-content-secondary">{lessonMeta.title}</span>
              </>
            )}
          </div>
          <Link
            to="/"
            className="text-sm text-content-secondary hover:text-content transition-colors flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to App
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {lessonId ? <LessonPlaceholder lessonId={lessonId} /> : <GuideOverview />}
      </main>
    </div>
  );
}

/**
 * Placeholder for individual lesson view.
 * Will be replaced with LessonView component.
 */
function LessonPlaceholder({ lessonId }: { lessonId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/guide"
          className="text-sm text-content-secondary hover:text-content"
        >
          ← All Lessons
        </Link>
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold capitalize">Lesson: {lessonId}</h2>
        <p className="text-content-secondary">
          Interactive sandbox coming soon...
        </p>
      </div>

      {/* Placeholder sandbox area */}
      <div className="aspect-video bg-surface-secondary border border-stroke rounded-lg flex items-center justify-center">
        <span className="text-content-tertiary">
          Interactive Sandbox Placeholder
        </span>
      </div>
    </div>
  );
}
