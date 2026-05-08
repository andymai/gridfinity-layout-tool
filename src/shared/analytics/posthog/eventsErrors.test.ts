// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureExceptionMock = vi.fn();
const captureMock = vi.fn();
const getPosthogInstanceMock = vi.fn();

vi.mock('./init', () => ({
  getPosthogInstance: () => getPosthogInstanceMock(),
}));

vi.mock('./trackEvent', () => ({
  trackEvent: vi.fn(),
  getDeviceType: () => 'desktop',
}));

vi.mock('@/core/store/interaction', () => ({
  useInteractionStore: { getState: () => ({ interaction: null }) },
}));

vi.mock('@/core/store/layout', () => ({
  useLayoutStore: {
    getState: () => ({
      layout: {
        drawer: { width: 10, depth: 8, height: 12 },
        bins: [],
        layers: [],
        categories: [],
      },
    }),
  },
}));

import { captureException } from './eventsErrors';

beforeEach(() => {
  captureExceptionMock.mockReset();
  captureMock.mockReset();
  getPosthogInstanceMock.mockReset();
  getPosthogInstanceMock.mockReturnValue({
    captureException: captureExceptionMock,
    capture: captureMock,
  });
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('captureException', () => {
  it('delegates to posthog.captureException so the SDK builds $exception_list', () => {
    const error = new Error('boom');
    captureException(error);

    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    expect(captureExceptionMock.mock.calls[0][0]).toBe(error);
  });

  it('does not fire a manual $exception event with legacy flat fields', () => {
    captureException(new Error('boom'));

    const manualExceptionCall = captureMock.mock.calls.find(([name]) => name === '$exception');
    expect(manualExceptionCall).toBeUndefined();
  });

  it('passes layout context and additional context as additionalProperties', () => {
    captureException(new Error('boom'), { boundary: 'root' });

    const [, additionalProperties] = captureExceptionMock.mock.calls[0];
    expect(additionalProperties).toMatchObject({
      boundary: 'root',
      drawer_size: '10x8x12',
      bin_count: 0,
      device_type: 'desktop',
    });
  });

  it('no-ops when posthog is not initialized', () => {
    getPosthogInstanceMock.mockReturnValue(null);
    expect(() => captureException(new Error('boom'))).not.toThrow();
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('swallows errors thrown by posthog so analytics never breaks the app', () => {
    captureExceptionMock.mockImplementation(() => {
      throw new Error('posthog blew up');
    });
    expect(() => captureException(new Error('boom'))).not.toThrow();
  });
});
