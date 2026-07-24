// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
  getDeviceType: vi.fn(() => 'desktop'),
}));

import { trackEvent, getDeviceType } from '@/shared/analytics/posthog';
import {
  useBaseplateFirstRun,
  syncBaseplateFirstRunFlags,
  dismissBaseplateQuickstartOnEdit,
} from './useBaseplateFirstRun';

beforeEach(() => {
  localStorage.clear();
  syncBaseplateFirstRunFlags();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(getDeviceType).mockReturnValue('desktop');
});

describe('useBaseplateFirstRun', () => {
  it('shows the quickstart for a new browser', () => {
    const { result } = renderHook(() => useBaseplateFirstRun());
    expect(result.current.shouldShowQuickstart).toBe(true);
  });

  it('hides the quickstart after dismissal and records the method', () => {
    const { result } = renderHook(() => useBaseplateFirstRun());

    act(() => result.current.markQuickstartSeen('got_it'));

    expect(result.current.shouldShowQuickstart).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith('baseplate_quickstart_dismissed', {
      method: 'got_it',
    });
  });

  it('offers the planner bridge until marked seen', () => {
    const { result } = renderHook(() => useBaseplateFirstRun());
    expect(result.current.shouldOfferPlannerBridge).toBe(true);

    act(() => result.current.markPlannerBridgeSeen());

    expect(result.current.shouldOfferPlannerBridge).toBe(false);
  });
});

describe('dismissBaseplateQuickstartOnEdit', () => {
  it('consumes the quickstart on a desktop edit', () => {
    dismissBaseplateQuickstartOnEdit();

    expect(localStorage.getItem('gridfinity-baseplate-quickstart-seen')).toBe('true');
    expect(trackEvent).toHaveBeenCalledWith('baseplate_quickstart_dismissed', {
      method: 'first_edit',
    });
  });

  it('fires only once', () => {
    dismissBaseplateQuickstartOnEdit();
    dismissBaseplateQuickstartOnEdit();

    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('does not consume the flag on mobile (card never rendered there)', () => {
    vi.mocked(getDeviceType).mockReturnValue('mobile');

    dismissBaseplateQuickstartOnEdit();

    expect(localStorage.getItem('gridfinity-baseplate-quickstart-seen')).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
