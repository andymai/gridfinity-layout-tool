// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

const navigateToPlanner = vi.fn();
vi.mock('@/shared/hooks/useDesignerRouting', () => ({
  useDesignerRouting: () => ({ navigateToPlanner }),
}));

import { trackEvent } from '@/shared/analytics/posthog';
import { useToastStore } from '@/core/store/toast';
import { usePlannerBridge } from './usePlannerBridge';
import { syncDesignerFirstRunFlags } from './useDesignerFirstRun';

beforeEach(() => {
  localStorage.clear();
  syncDesignerFirstRunFlags();
  useToastStore.setState({ toasts: [] });
  vi.mocked(trackEvent).mockClear();
  navigateToPlanner.mockClear();
});

describe('usePlannerBridge', () => {
  it('shows the bridge toast once and marks it seen', () => {
    const { result } = renderHook(() => usePlannerBridge());

    act(() => result.current());

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].action?.label).toBeTruthy();
    expect(localStorage.getItem('gridfinity-designer-planner-bridge-seen')).toBe('true');
    expect(trackEvent).toHaveBeenCalledWith('designer_planner_bridge', { action: 'shown' });
  });

  it('does not offer again after the first time', () => {
    const { result, rerender } = renderHook(() => usePlannerBridge());

    act(() => result.current());
    rerender();
    act(() => result.current());

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('navigates to the planner and tracks the click on action', () => {
    const { result } = renderHook(() => usePlannerBridge());

    act(() => result.current());
    const action = useToastStore.getState().toasts[0].action;
    act(() => {
      void action?.onClick();
    });

    expect(navigateToPlanner).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('designer_planner_bridge', { action: 'clicked' });
  });
});
