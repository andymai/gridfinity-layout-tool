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
  trackDrawerHalfFitSuggestion,
  trackDrawerMeasuredCommitted,
  trackDrawerMeasurementCleared,
  trackDrawerShapeApplied,
  trackDrawerShapeEditorOpened,
  trackDrawerShapeReset,
} from './eventsCore';

beforeEach(() => {
  trackEventMock.mockReset();
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
