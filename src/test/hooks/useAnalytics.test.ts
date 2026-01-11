import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLayoutStore } from '../../store/layout';
import { createDefaultLayout } from '../../constants';

// Mock the analytics module
vi.mock('../../utils/analytics', () => ({
  trackLayoutSnapshot: vi.fn(),
  initAnalytics: vi.fn(),
  computeLayoutMetrics: vi.fn(),
}));

// Import after mocking
import { useAnalytics } from '../../hooks/useAnalytics';

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset layout store
    const defaultLayout = createDefaultLayout();
    useLayoutStore.setState({
      layout: defaultLayout,
      activeLayoutId: 'test-id',
    });
  });

  it('renders without error', () => {
    // The hook should render without throwing
    expect(() => renderHook(() => useAnalytics())).not.toThrow();
  });

  it('returns void', () => {
    const { result } = renderHook(() => useAnalytics());
    expect(result.current).toBeUndefined();
  });

  it('can be called multiple times without error', () => {
    // Simulates multiple components using the hook
    expect(() => {
      renderHook(() => useAnalytics());
      renderHook(() => useAnalytics());
    }).not.toThrow();
  });

  it('cleans up on unmount without error', () => {
    const { unmount } = renderHook(() => useAnalytics());
    expect(() => unmount()).not.toThrow();
  });
});

// Note: The hook's core logic (visibilitychange tracking) only runs in production
// (import.meta.env.DEV === false). The computeLayoutMetrics tests in analytics.test.ts
// cover the metrics computation logic that the hook uses.
