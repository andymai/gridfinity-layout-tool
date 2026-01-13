import { useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'gridfinity-guide-progress';

/**
 * Load completed lessons from localStorage.
 * Returns empty set if no data or invalid data.
 */
function loadProgress(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Set();

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set();

    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    // Corrupted data, start fresh
    return new Set();
  }
}

/**
 * Save completed lessons to localStorage.
 */
function saveProgress(completed: Set<string>): void {
  if (completed.size === 0) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  }
}

/**
 * Hook to track guide lesson completion progress.
 * Persists to localStorage for cross-session tracking.
 */
export function useGuideProgress() {
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(() => loadProgress());

  /**
   * Check if a specific lesson is complete.
   */
  const isComplete = useCallback(
    (lessonId: string): boolean => {
      return completedLessons.has(lessonId);
    },
    [completedLessons]
  );

  /**
   * Mark a lesson as complete.
   */
  const markComplete = useCallback((lessonId: string): void => {
    setCompletedLessons((prev) => {
      if (prev.has(lessonId)) return prev;

      const next = new Set(prev);
      next.add(lessonId);
      saveProgress(next);
      return next;
    });
  }, []);

  /**
   * Reset all progress.
   */
  const resetProgress = useCallback((): void => {
    setCompletedLessons(new Set());
    saveProgress(new Set());
  }, []);

  /**
   * Count of completed lessons.
   */
  const completionCount = useMemo(() => completedLessons.size, [completedLessons]);

  return {
    completedLessons,
    isComplete,
    markComplete,
    resetProgress,
    completionCount,
  };
}
