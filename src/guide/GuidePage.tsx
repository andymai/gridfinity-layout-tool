import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Lesson } from './lessons/types';
import { GuideOverview } from './GuideOverview';
import { getLessonMeta, loadLesson } from './lessons';
import { LessonView } from './LessonView';

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
        {lessonId ? <LessonLoader lessonId={lessonId} /> : <GuideOverview />}
      </main>
    </div>
  );
}

/**
 * Loads and displays a lesson with loading/error states.
 */
function LessonLoader({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const loadedLesson = await loadLesson(lessonId);

      if (cancelled) return;

      if (loadedLesson) {
        setLesson(loadedLesson);
      } else {
        setError(`Lesson "${lessonId}" not found`);
      }
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-content-secondary">Loading lesson...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="text-4xl">🤔</div>
        <h2 className="text-xl font-semibold text-content">Lesson Not Found</h2>
        <p className="text-content-secondary">{error}</p>
        <Link
          to="/guide"
          className="inline-block px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded-lg transition-colors"
        >
          Back to All Lessons
        </Link>
      </div>
    );
  }

  if (!lesson) {
    return null;
  }

  return <LessonView lesson={lesson} />;
}
