// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkContentInAddressBar, stripUrlFragments, whenLinkContentCleared } from './linkHash';

afterEach(() => {
  window.history.replaceState(null, '', '/');
  vi.useRealTimers();
});

describe('link content in analytics', () => {
  it('knows a share or plan link from any other hash', () => {
    window.history.replaceState(null, '', '/#plan=v1.abc');
    expect(linkContentInAddressBar()).toBe(true);
    window.history.replaceState(null, '', '/#share=eyJ');
    expect(linkContentInAddressBar()).toBe(true);
    window.history.replaceState(null, '', '/#layers');
    expect(linkContentInAddressBar()).toBe(false);
  });

  it('drops the hash from every URL property, the person properties included', () => {
    const event = stripUrlFragments({
      event: '$pageview',
      properties: {
        $current_url: 'https://gridfinitylayouttool.com/#share=eyJsYWJlbCI6Ik0zIn0',
        $session_entry_url: 'https://gridfinitylayouttool.com/?utm_source=x#plan=v1.abc',
        $pathname: '/',
        note: 'a#b',
      },
      $set_once: { $initial_current_url: 'https://gridfinitylayouttool.com/#plan=v1.abc' },
    });
    expect(event.properties).toEqual({
      $current_url: 'https://gridfinitylayouttool.com/',
      $session_entry_url: 'https://gridfinitylayouttool.com/?utm_source=x',
      $pathname: '/',
      note: 'a#b',
    });
    expect(event.$set_once).toEqual({ $initial_current_url: 'https://gridfinitylayouttool.com/' });
  });

  it('waits until the link content leaves the address bar', async () => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/#plan=v1.abc');
    let done = false;
    void whenLinkContentCleared(100).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(300);
    expect(done).toBe(false);
    window.history.replaceState(null, '', '/');
    await vi.advanceTimersByTimeAsync(100);
    expect(done).toBe(true);
  });
});
