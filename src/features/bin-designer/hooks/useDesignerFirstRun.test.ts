// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/shared/analytics/posthog';
import { useDesignerFirstRun, syncDesignerFirstRunFlags } from './useDesignerFirstRun';

beforeEach(() => {
  localStorage.clear();
  syncDesignerFirstRunFlags();
  vi.mocked(trackEvent).mockClear();
});

describe('useDesignerFirstRun', () => {
  it('shows the quickstart for a new browser', () => {
    const { result } = renderHook(() => useDesignerFirstRun());
    expect(result.current.shouldShowQuickstart).toBe(true);
  });

  it('hides the quickstart after dismissal and records the method', () => {
    const { result } = renderHook(() => useDesignerFirstRun());

    act(() => result.current.markQuickstartSeen('got_it'));

    expect(result.current.shouldShowQuickstart).toBe(false);
    expect(localStorage.getItem('gridfinity-designer-quickstart-seen')).toBe('true');
    expect(trackEvent).toHaveBeenCalledWith('designer_quickstart_dismissed', {
      method: 'got_it',
    });
  });

  it('records the dismissal only once', () => {
    const { result } = renderHook(() => useDesignerFirstRun());

    act(() => result.current.markQuickstartSeen('first_edit'));
    act(() => result.current.markQuickstartSeen('got_it'));

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('respects an existing quickstart flag', () => {
    localStorage.setItem('gridfinity-designer-quickstart-seen', 'true');
    syncDesignerFirstRunFlags();

    const { result } = renderHook(() => useDesignerFirstRun());
    expect(result.current.shouldShowQuickstart).toBe(false);
  });

  it('offers the planner bridge until marked seen', () => {
    const { result } = renderHook(() => useDesignerFirstRun());
    expect(result.current.shouldOfferPlannerBridge).toBe(true);

    act(() => result.current.markPlannerBridgeSeen());

    expect(result.current.shouldOfferPlannerBridge).toBe(false);
    expect(localStorage.getItem('gridfinity-designer-planner-bridge-seen')).toBe('true');
  });
});
