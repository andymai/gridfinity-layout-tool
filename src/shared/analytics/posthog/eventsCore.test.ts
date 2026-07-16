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
