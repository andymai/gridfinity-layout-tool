import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useYearSoundtrack } from './useYearSoundtrack';

const created: { closed: boolean; state: AudioContextState }[] = [];

class FakeAudioContext {
  closed = false;
  state: AudioContextState = 'running';
  constructor() {
    created.push(this);
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

vi.mock('../audio/yearSoundtrack', () => ({
  STOP_FADE_S: 0.8,
  YearSoundtrack: class {
    tick(): void {}
    stop(): void {}
  },
}));

describe('useYearSoundtrack', () => {
  afterEach(() => {
    created.length = 0;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('touches no audio while sound is off', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    renderHook(() => useYearSoundtrack(false, false));
    expect(created).toHaveLength(0);
  });

  it('opens one context when sound is on and closes it on unmount', () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { unmount, rerender } = renderHook(({ paused }) => useYearSoundtrack(true, paused), {
      initialProps: { paused: false },
    });
    rerender({ paused: true });
    expect(created).toHaveLength(1);
    if (created[0]) created[0].state = 'suspended';
    unmount();
    expect(created[0]?.closed).toBe(true);
  });

  it('lets a playing tune fade out before it closes the context', () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    const { unmount } = renderHook(() => useYearSoundtrack(true, false));
    unmount();
    expect(created[0]?.closed).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(created[0]?.closed).toBe(true);
  });
});
