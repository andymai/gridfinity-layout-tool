// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.stubEnv('DEV', false);
vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'phc_test');

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
}));
const displayMode = vi.hoisted(() => ({ current: 'standalone' }));

vi.mock('posthog-js', () => ({ default: posthog }));
vi.mock('@/core/store/settings', () => ({
  useSettingsStore: { getState: () => ({ settings: { analyticsEnabled: true } }) },
}));
vi.mock('@/shared/pwa/displayMode', () => ({ getDisplayMode: () => displayMode.current }));
vi.mock('./events', () => ({
  updatePersonProperties: vi.fn(),
  getLayoutContext: () => ({}),
  listenForPwaInstall: vi.fn(),
  listenForDisplayModeChanges: vi.fn(),
  captureUtmParameters: vi.fn(),
}));

import { initAnalytics } from './init';

type BeforeSend = (event: {
  event: string;
  properties?: Record<string, unknown>;
}) => { properties?: Record<string, unknown> } | null;

describe('initAnalytics before_send', () => {
  let beforeSend: BeforeSend;

  beforeAll(async () => {
    initAnalytics();
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    beforeSend = (posthog.init.mock.calls[0]?.[1] as { before_send: BeforeSend }).before_send;
  });

  it('reads the display mode for each event, so it survives a session rotation', () => {
    expect(beforeSend({ event: 'bin_created' })?.properties?.display_mode).toBe('standalone');
    displayMode.current = 'browser';
    expect(beforeSend({ event: 'bin_created' })?.properties?.display_mode).toBe('browser');
  });

  it('keeps a display_mode the caller set', () => {
    const sent = beforeSend({ event: 'x', properties: { display_mode: 'minimal-ui' } });

    expect(sent?.properties?.display_mode).toBe('minimal-ui');
  });
});
