// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEventMock = vi.fn();

vi.mock('./trackEvent', () => ({
  trackEvent: (name: string, properties?: Record<string, unknown>) => {
    trackEventMock(name, properties);
  },
  getDeviceType: () => 'desktop',
}));

import {
  trackDesignCreated,
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasuredCommitted,
  trackDrawerMeasurementCleared,
  trackDrawerShapeApplied,
  trackDrawerShapeEditorOpened,
  trackDrawerShapeReset,
} from './eventsCore';
import { ANALYTICS_STORAGE_KEY, pruneAnalyticsData } from './identity';

vi.mock('./eventsPerson', () => ({
  updatePersonProperties: vi.fn(),
  markFeatureUsed: vi.fn(),
}));

beforeEach(() => {
  trackEventMock.mockReset();
  // Clears both localStorage and the module-level analytics cache
  pruneAnalyticsData();
});

describe('trackDrawerShapeEditorOpened', () => {
  it('emits the editor kind', () => {
    trackDrawerShapeEditorOpened('corners');

    expect(trackEventMock).toHaveBeenCalledWith('drawer_shape_editor_opened', {
      editor: 'corners',
    });
  });
});

describe('trackDrawerShapeApplied', () => {
  it('emits editor, displacement, trace, and cleared properties', () => {
    trackDrawerShapeApplied({
      editor: 'cells',
      displaced_bins: 3,
      used_trace: true,
      cleared: false,
    });

    expect(trackEventMock).toHaveBeenCalledWith('drawer_shape_applied', {
      editor: 'cells',
      displaced_bins: 3,
      used_trace: true,
      cleared: false,
    });
  });

  it('marks corner-cut applies that resolve back to the plain rectangle', () => {
    trackDrawerShapeApplied({
      editor: 'corners',
      displaced_bins: 0,
      used_trace: false,
      cleared: true,
    });

    expect(trackEventMock).toHaveBeenCalledWith(
      'drawer_shape_applied',
      expect.objectContaining({ editor: 'corners', cleared: true })
    );
  });
});

describe('trackDrawerShapeReset', () => {
  it('emits with no properties', () => {
    trackDrawerShapeReset();

    expect(trackEventMock).toHaveBeenCalledWith('drawer_shape_reset', {});
  });
});

describe('trackDrawerMeasuredCommitted', () => {
  it('emits slack rounded to 0.1mm plus offer and height flags', () => {
    trackDrawerMeasuredCommitted({
      slack_width_mm: 29.97001,
      slack_depth_mm: 2.04,
      half_fit_offered: true,
      has_height: false,
    });

    expect(trackEventMock).toHaveBeenCalledWith('drawer_measured_committed', {
      slack_width_mm: 30,
      slack_depth_mm: 2,
      half_fit_offered: true,
      has_height: false,
    });
  });
});

describe('trackDrawerHalfFitSuggestion', () => {
  it('emits the action taken', () => {
    trackDrawerHalfFitSuggestion('accepted');

    expect(trackEventMock).toHaveBeenCalledWith('drawer_half_fit_suggestion', {
      action: 'accepted',
    });
  });
});

describe('trackDrawerMeasurementCleared', () => {
  it('emits with no properties', () => {
    trackDrawerMeasurementCleared();

    expect(trackEventMock).toHaveBeenCalledWith('drawer_measurement_cleared', {});
  });
});

describe('trackDesignCreated', () => {
  const milestonesFired = (): string[] =>
    trackEventMock.mock.calls
      .filter(([name]) => name === 'engagement_milestone')
      .map(([, props]) => (props as { milestone: string }).milestone);

  it('fires the designer ladder at 1, 4 and 8 designs and nowhere between', () => {
    for (let i = 0; i < 8; i++) trackDesignCreated();

    expect(milestonesFired()).toEqual(['first_design', 'designs_4', 'designs_8']);
  });

  it('reports the count alongside the milestone', () => {
    for (let i = 0; i < 4; i++) trackDesignCreated();

    expect(trackEventMock).toHaveBeenLastCalledWith('engagement_milestone', {
      milestone: 'designs_4',
      designs_created: 4,
    });
  });

  it('fires each milestone once, across separate calls', () => {
    for (let i = 0; i < 12; i++) trackDesignCreated();

    expect(milestonesFired()).toEqual(['first_design', 'designs_4', 'designs_8']);
  });

  // Bins on the grid stopped discriminating past five, so the old 15- and
  // 30-bin rungs are gone. Nothing should resurrect them.
  it('no longer emits the retired bin-count milestones', () => {
    for (let i = 0; i < 40; i++) trackDesignCreated();

    expect(milestonesFired()).not.toContain('substantial');
    expect(milestonesFired()).not.toContain('power_user');
  });

  it('counts up from analytics data written before the field existed', () => {
    pruneAnalyticsData();
    localStorage.setItem(
      ANALYTICS_STORAGE_KEY,
      JSON.stringify({ userId: 'u', firstSeen: 'x', featureFlags: {}, milestones: {} })
    );

    trackDesignCreated();

    expect(milestonesFired()).toEqual(['first_design']);
  });
});
