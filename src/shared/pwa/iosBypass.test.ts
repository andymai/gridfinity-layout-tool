// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isIosStandalonePwa } from './iosBypass';

describe('isIosStandalonePwa', () => {
  const originalUserAgent = navigator.userAgent;
  const originalPlatform = navigator.platform;
  const originalMaxTouchPoints = navigator.maxTouchPoints;
  const originalMatchMedia = window.matchMedia;

  function setNavigator(overrides: {
    userAgent?: string;
    platform?: string;
    maxTouchPoints?: number;
    standalone?: boolean;
  }): void {
    if (overrides.userAgent !== undefined) {
      Object.defineProperty(navigator, 'userAgent', {
        value: overrides.userAgent,
        configurable: true,
      });
    }
    if (overrides.platform !== undefined) {
      Object.defineProperty(navigator, 'platform', {
        value: overrides.platform,
        configurable: true,
      });
    }
    if (overrides.maxTouchPoints !== undefined) {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: overrides.maxTouchPoints,
        configurable: true,
      });
    }
    if (overrides.standalone !== undefined) {
      Object.defineProperty(navigator, 'standalone', {
        value: overrides.standalone,
        configurable: true,
      });
    }
  }

  function setStandaloneMatch(matches: boolean): void {
    window.matchMedia = vi.fn().mockReturnValue({
      matches,
      media: '(display-mode: standalone)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUserAgent, configurable: true });
    Object.defineProperty(navigator, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: originalMaxTouchPoints,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
  });

  beforeEach(() => {
    setStandaloneMatch(false);
  });

  it('returns false on a desktop browser', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Chrome/124.0',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: false,
    });
    expect(isIosStandalonePwa()).toBe(false);
  });

  it('returns false on iOS Safari (browser, not installed)', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      standalone: false,
    });
    setStandaloneMatch(false);
    expect(isIosStandalonePwa()).toBe(false);
  });

  it('returns true on iPhone home-screen install via navigator.standalone', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      standalone: true,
    });
    expect(isIosStandalonePwa()).toBe(true);
  });

  it('returns true on iPhone home-screen install via display-mode media query', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      platform: 'iPhone',
      standalone: false,
    });
    setStandaloneMatch(true);
    expect(isIosStandalonePwa()).toBe(true);
  });

  it('returns true on iPadOS 13+ (MacIntel + multi-touch) installed PWA', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
      standalone: true,
    });
    expect(isIosStandalonePwa()).toBe(true);
  });

  it('returns false on macOS desktop Safari standalone PWA — not iOS', () => {
    setNavigator({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: true,
    });
    expect(isIosStandalonePwa()).toBe(false);
  });
});
