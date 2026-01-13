import { Link, useParams } from 'react-router-dom';

/**
 * Main guide page container.
 * Renders either the overview or a specific lesson based on URL params.
 */
export function GuidePage() {
  const { lessonId } = useParams<{ lessonId?: string }>();

  return (
    <div
      className="min-h-screen bg-surface text-content"
      data-testid="guide-page"
    >
      {/* Header */}
      <header className="border-b border-stroke px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Gridfinity Guide</h1>
          <Link
            to="/"
            className="text-sm text-content-secondary hover:text-content transition-colors"
          >
            ← Back to App
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {lessonId ? (
          <LessonPlaceholder lessonId={lessonId} />
        ) : (
          <OverviewPlaceholder />
        )}
      </main>
    </div>
  );
}

/**
 * Placeholder for the guide overview (lesson list).
 * Will be replaced with GuideOverview component.
 */
function OverviewPlaceholder() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Learn Gridfinity Layout Tool</h2>
        <p className="text-content-secondary">
          Interactive lessons to get you from zero to organized in minutes.
        </p>
      </div>

      {/* Placeholder lesson cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {['basics', 'categories', 'layers', 'print'].map((id) => (
          <Link
            key={id}
            to={`/guide/${id}`}
            className="p-6 rounded-lg bg-surface-secondary border border-stroke hover:border-accent transition-colors"
          >
            <h3 className="font-semibold capitalize">{id}</h3>
            <p className="text-sm text-content-secondary mt-1">
              Coming soon...
            </p>
          </Link>
        ))}
      </div>
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
