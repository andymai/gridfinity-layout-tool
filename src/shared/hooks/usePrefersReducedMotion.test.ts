import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

// jsdom ships neither MediaQueryListEvent nor a matchMedia that reacts to
// changes, so both are modelled here on the real DOM interfaces.
class MockMediaQueryListEvent extends Event implements MediaQueryListEvent {
  readonly matches: boolean;
  readonly media: string;

  constructor(type: string, init: MediaQueryListEventInit) {
    super(type, init);
    this.matches = init.matches ?? false;
    this.media = init.media ?? '';
  }
}

describe('usePrefersReducedMotion', () => {
  let listeners: EventListenerOrEventListenerObject[];
  let created: MediaQueryList[];
  let matches: boolean;

  class MockMediaQueryList extends EventTarget implements MediaQueryList {
    readonly media: string;
    readonly matches: boolean;
    onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => unknown) | null = null;

    constructor(media: string, mediaMatches: boolean) {
      super();
      this.media = media;
      this.matches = mediaMatches;
    }

    override addEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions
    ): void {
      super.addEventListener(type, callback, options);
      if (callback) listeners.push(callback);
    }

    override removeEventListener(
      type: string,
      callback: EventListenerOrEventListenerObject | null,
      options?: boolean | EventListenerOptions
    ): void {
      super.removeEventListener(type, callback, options);
      listeners = listeners.filter((l) => l !== callback);
    }

    addListener(): void {}
    removeListener(): void {}
  }

  function emitChange(nextMatches: boolean): void {
    for (const mql of created) {
      mql.dispatchEvent(new MockMediaQueryListEvent('change', { matches: nextMatches }));
    }
  }

  beforeEach(() => {
    listeners = [];
    created = [];
    matches = false;

    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
      const mql = new MockMediaQueryList(query, matches);
      created.push(mql);
      return mql;
    });
  });

  it('returns false when motion is not reduced', () => {
    matches = false;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when motion is reduced', () => {
    matches = true;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('reacts to runtime changes', () => {
    matches = false;
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      emitChange(true);
    });

    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(listeners).toHaveLength(1);
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
