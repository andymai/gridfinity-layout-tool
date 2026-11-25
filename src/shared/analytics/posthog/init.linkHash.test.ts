// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock('posthog-js', () => ({
  default: {
    init: mocks.init,
    capture: vi.fn(),
    identify: vi.fn(),
    register: vi.fn(),
    setPersonProperties: vi.fn(),
    people: { set: vi.fn(), set_once: vi.fn() },
  },
}));

describe('PostHog start on a link with layout content', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.init.mockReset();
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'phc_test');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('starts only after the plan has left the address bar', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/#plan=v1.abc');
    const { initAnalytics } = await import('./init');
    initAnalytics();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.init).not.toHaveBeenCalled();
    window.history.replaceState(null, '', '/');
    await vi.advanceTimersByTimeAsync(500);
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));
  });

  it('strips the hash from what it sends', async () => {
    const { initAnalytics } = await import('./init');
    initAnalytics();
    await vi.waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));
    const options = mocks.init.mock.calls[0]?.[1] as {
      before_send: (event: unknown) => { properties: Record<string, unknown> } | null;
    };
    const sent = options.before_send({
      event: 'bin_created',
      properties: { $current_url: 'https://gridfinitylayouttool.com/#share=eyJ' },
    });
    expect(sent?.properties.$current_url).toBe('https://gridfinitylayouttool.com/');
  });
});
