import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGuideProgress } from '../../guide/hooks/useGuideProgress';

const STORAGE_KEY = 'gridfinity-guide-progress';

describe('useGuideProgress', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns empty completed set when no progress saved', () => {
      const { result } = renderHook(() => useGuideProgress());

      expect(result.current.completedLessons).toEqual(new Set());
      expect(result.current.isComplete('basics')).toBe(false);
    });

    it('loads existing progress from localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['basics', 'categories']));

      const { result } = renderHook(() => useGuideProgress());

      expect(result.current.completedLessons).toEqual(new Set(['basics', 'categories']));
      expect(result.current.isComplete('basics')).toBe(true);
      expect(result.current.isComplete('categories')).toBe(true);
      expect(result.current.isComplete('layers')).toBe(false);
    });

    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json{{{');

      const { result } = renderHook(() => useGuideProgress());

      expect(result.current.completedLessons).toEqual(new Set());
    });

    it('handles invalid data format gracefully', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ invalid: 'format' }));

      const { result } = renderHook(() => useGuideProgress());

      expect(result.current.completedLessons).toEqual(new Set());
    });
  });

  describe('markComplete', () => {
    it('marks a lesson as complete', () => {
      const { result } = renderHook(() => useGuideProgress());

      act(() => {
        result.current.markComplete('basics');
      });

      expect(result.current.isComplete('basics')).toBe(true);
      expect(result.current.completedLessons).toEqual(new Set(['basics']));
    });

    it('persists completion to localStorage', () => {
      const { result } = renderHook(() => useGuideProgress());

      act(() => {
        result.current.markComplete('basics');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      expect(stored).toContain('basics');
    });

    it('does not duplicate already completed lessons', () => {
      const { result } = renderHook(() => useGuideProgress());

      act(() => {
        result.current.markComplete('basics');
        result.current.markComplete('basics');
      });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      expect(stored.filter((l: string) => l === 'basics')).toHaveLength(1);
    });

    it('can mark multiple lessons complete', () => {
      const { result } = renderHook(() => useGuideProgress());

      act(() => {
        result.current.markComplete('basics');
        result.current.markComplete('categories');
        result.current.markComplete('layers');
      });

      expect(result.current.completedLessons).toEqual(new Set(['basics', 'categories', 'layers']));
    });
  });

  describe('resetProgress', () => {
    it('clears all progress', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['basics', 'categories']));
      const { result } = renderHook(() => useGuideProgress());

      act(() => {
        result.current.resetProgress();
      });

      expect(result.current.completedLessons).toEqual(new Set());
      expect(result.current.isComplete('basics')).toBe(false);
    });

    it('clears localStorage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['basics']));
      const { result } = renderHook(() => useGuideProgress());

      act(() => {
        result.current.resetProgress();
      });

      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('completionCount', () => {
    it('returns correct count of completed lessons', () => {
      const { result } = renderHook(() => useGuideProgress());

      expect(result.current.completionCount).toBe(0);

      act(() => {
        result.current.markComplete('basics');
      });

      expect(result.current.completionCount).toBe(1);

      act(() => {
        result.current.markComplete('categories');
        result.current.markComplete('layers');
      });

      expect(result.current.completionCount).toBe(3);
    });
  });
});
