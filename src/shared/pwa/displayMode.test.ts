// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDisplayMode, isInstalledDisplayMode, onDisplayModeChange } from './displayMode';

let activeMode = 'browser';
const changeListeners = new Map<string, Set<() => void>>();

function fakeMatchMedia(query: string): MediaQueryList {
  const mode = /display-mode: ([a-z-]+)/.exec(query)?.[1] ?? '';
  const listeners = changeListeners.get(mode) ?? new Set<() => void>();
  changeListeners.set(mode, listeners);
  return {
    media: query,
    get matches() {
      return mode === activeMode;
    },
    addEventListener: (_type: string, cb: () => void) => listeners.add(cb),
    removeEventListener: (_type: string, cb: () => void) => listeners.delete(cb),
  } as unknown as MediaQueryList;
}

function switchMode(next: string): void {
  const previous = activeMode;
  activeMode = next;
  for (const mode of [previous, next]) {
    for (const cb of changeListeners.get(mode) ?? []) cb();
  }
}

describe('displayMode', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    activeMode = 'browser';
    changeListeners.clear();
    window.matchMedia = vi.fn(fakeMatchMedia);
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Reflect.deleteProperty(navigator, 'standalone');
  });

  it('reports browser when no display-mode query matches', () => {
    expect(getDisplayMode()).toBe('browser');
  });

  it.each(['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'])(
    'reports %s when its query matches',
    (mode) => {
      activeMode = mode;
      expect(getDisplayMode()).toBe(mode);
    }
  );

  it('treats the iOS navigator.standalone flag as standalone', () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(getDisplayMode()).toBe('standalone');
  });

  it('counts only app-window modes as installed', () => {
    expect(isInstalledDisplayMode('standalone')).toBe(true);
    expect(isInstalledDisplayMode('window-controls-overlay')).toBe(true);
    expect(isInstalledDisplayMode('minimal-ui')).toBe(true);
    expect(isInstalledDisplayMode('fullscreen')).toBe(false);
    expect(isInstalledDisplayMode('browser')).toBe(false);
  });

  it('notifies once per real mode change, even when two queries fire', () => {
    const listener = vi.fn();
    onDisplayModeChange(listener);

    switchMode('standalone');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('standalone');
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = onDisplayModeChange(listener);

    unsubscribe();
    switchMode('standalone');

    expect(listener).not.toHaveBeenCalled();
  });
});
