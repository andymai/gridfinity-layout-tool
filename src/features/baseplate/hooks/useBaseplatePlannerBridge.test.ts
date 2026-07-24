// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  getDeviceType: vi.fn(() => 'desktop'),
}));

const navigateToPlanner = vi.fn();
vi.mock('@/shared/hooks/useBaseplateRouting', () => ({
  useBaseplateRouting: () => ({ navigateToPlanner }),
}));

import { trackEvent } from '@/shared/analytics/posthog';
import { useToastStore } from '@/core/store/toast';
import { useBaseplatePlannerBridge } from './useBaseplatePlannerBridge';
import { syncBaseplateFirstRunFlags } from './useBaseplateFirstRun';

beforeEach(() => {
  localStorage.clear();
  syncBaseplateFirstRunFlags();
  useToastStore.setState({ toasts: [] });
  vi.mocked(trackEvent).mockClear();
  navigateToPlanner.mockClear();
});

describe('useBaseplatePlannerBridge', () => {
  it('shows the bridge toast once and marks it seen', () => {
    const { result } = renderHook(() => useBaseplatePlannerBridge());

    act(() => result.current());

    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(localStorage.getItem('gridfinity-baseplate-planner-bridge-seen')).toBe('true');
    expect(trackEvent).toHaveBeenCalledWith('baseplate_planner_bridge', { action: 'shown' });
  });

  it('does not offer again after the first time', () => {
    const { result, rerender } = renderHook(() => useBaseplatePlannerBridge());

    act(() => result.current());
    rerender();
    act(() => result.current());

    expect(useToastStore.getState().toasts).toHaveLength(1);
  });

  it('navigates to the planner and tracks the click on action', () => {
    const { result } = renderHook(() => useBaseplatePlannerBridge());

    act(() => result.current());
    const action = useToastStore.getState().toasts[0].action;
    act(() => {
      void action?.onClick();
    });

    expect(navigateToPlanner).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('baseplate_planner_bridge', { action: 'clicked' });
  });
});
