// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as DisplayModeModule from '@/shared/pwa/displayMode';
import type { DisplayMode } from '@/shared/pwa/displayMode';
import { pruneAnalyticsData } from './identity';
import {
  listenForDisplayModeChanges,
  listenForPwaInstallAvailability,
  noteCurrentDisplayMode,
} from './pwaEvents';

interface TestState {
  analyticsActive: boolean;
  displayMode: DisplayMode;
  onChange: ((mode: DisplayMode) => void) | null;
}

const state = vi.hoisted((): TestState => ({
  analyticsActive: true,
  displayMode: 'browser',
  onChange: null,
}));

const { trackEvent, markFeatureUsed } = vi.hoisted(() => ({
  trackEvent: vi.fn(),
  markFeatureUsed: vi.fn(),
}));

vi.mock('./trackEvent', () => ({ trackEvent }));
vi.mock('./eventsPerson', () => ({ markFeatureUsed }));
vi.mock('./init', () => ({
  isAnalyticsActive: () => state.analyticsActive,
}));
vi.mock('@/shared/pwa/displayMode', async (importOriginal) => ({
  ...(await importOriginal<typeof DisplayModeModule>()),
  getDisplayMode: () => state.displayMode,
  onDisplayModeChange: (listener: (mode: DisplayMode) => void) => {
    state.onChange = listener;
    return () => undefined;
  },
}));

function fireInstallAvailable(): void {
  window.dispatchEvent(new Event('beforeinstallprompt'));
}

beforeEach(() => {
  vi.clearAllMocks();
  pruneAnalyticsData();
  state.analyticsActive = true;
  state.displayMode = 'browser';
  state.onChange = null;
});

describe('listenForPwaInstallAvailability', () => {
  beforeAll(() => {
    listenForPwaInstallAvailability();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends one pwa_install_available event per day', () => {
    fireInstallAvailable();
    fireInstallAvailable();

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('pwa_install_available', {
      is_first_session: expect.any(Boolean),
    });
  });

  it('sends again on the next day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
    fireInstallAvailable();
    vi.setSystemTime(new Date('2026-11-11T12:00:00Z'));
    fireInstallAvailable();

    expect(trackEvent).toHaveBeenCalledTimes(2);
  });

  it('sends nothing while analytics is off', () => {
    state.analyticsActive = false;

    fireInstallAvailable();

    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('listenForDisplayModeChanges', () => {
  it('flags a launch from the installed app', () => {
    state.displayMode = 'standalone';

    listenForDisplayModeChanges();

    expect(markFeatureUsed).toHaveBeenCalledWith('pwa_standalone');
  });

  it('does not flag an installed launch while analytics is off', () => {
    state.analyticsActive = false;
    state.displayMode = 'standalone';

    listenForDisplayModeChanges();
    state.onChange?.('standalone');

    expect(markFeatureUsed).not.toHaveBeenCalled();
  });

  it('flags the current installed window when analytics turns back on', () => {
    state.displayMode = 'standalone';

    noteCurrentDisplayMode();

    expect(markFeatureUsed).toHaveBeenCalledWith('pwa_standalone');
  });

  it('does not flag a browser-tab launch', () => {
    listenForDisplayModeChanges();

    expect(markFeatureUsed).not.toHaveBeenCalled();
  });

  it('flags the launch when the tab moves into the app window', () => {
    listenForDisplayModeChanges();

    state.onChange?.('standalone');

    expect(markFeatureUsed).toHaveBeenCalledWith('pwa_standalone');
  });
});
