// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEventMock = vi.fn();

vi.mock('./trackEvent', () => ({
  trackEvent: (name: string, properties?: Record<string, unknown>) => {
    trackEventMock(name, properties);
  },
  getDeviceType: () => 'desktop',
}));

import { trackToolActivated, trackToolConverted } from './conversionEvents';
import { ANALYTICS_STORAGE_KEY, pruneAnalyticsData } from './identity';

beforeEach(() => {
  trackEventMock.mockReset();
  // Clears both localStorage and the module-level analytics cache
  pruneAnalyticsData();
});

describe('trackToolActivated', () => {
  it('fires tool_activated with surface and action', () => {
    trackToolActivated('layout', 'draw');

    expect(trackEventMock).toHaveBeenCalledWith('tool_activated', {
      surface: 'layout',
      action: 'draw',
    });
  });

  it('fires only once per surface', () => {
    trackToolActivated('designer', 'param_edit');
    trackToolActivated('designer', 'param_edit');
    trackToolActivated('designer', 'param_edit');

    expect(trackEventMock).toHaveBeenCalledTimes(1);
  });

  it('tracks each surface independently', () => {
    trackToolActivated('layout', 'draw');
    trackToolActivated('designer', 'param_edit');
    trackToolActivated('baseplate', 'params_changed');

    expect(trackEventMock).toHaveBeenCalledTimes(3);
  });

  it('persists the activation guard in analytics storage', () => {
    trackToolActivated('baseplate', 'params_changed');

    const stored = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) ?? '{}') as {
      milestones: Record<string, string>;
    };
    expect(stored.milestones['tool_activated_baseplate']).toBeTruthy();
  });
});

describe('trackToolConverted', () => {
  it('fires tool_converted with defaults for optional props', () => {
    trackToolConverted('layout', { format: 'stl' });

    expect(trackEventMock).toHaveBeenCalledWith('tool_converted', {
      surface: 'layout',
      format: 'stl',
      split: false,
      piece_count: 1,
    });
  });

  it('fires on every conversion, not once', () => {
    trackToolConverted('designer', { format: '3mf' });
    trackToolConverted('designer', { format: '3mf' });

    expect(trackEventMock).toHaveBeenCalledTimes(2);
  });

  it('passes split and piece_count through', () => {
    trackToolConverted('baseplate', { format: 'stl', split: true, piece_count: 6 });

    expect(trackEventMock).toHaveBeenCalledWith('tool_converted', {
      surface: 'baseplate',
      format: 'stl',
      split: true,
      piece_count: 6,
    });
  });
});
