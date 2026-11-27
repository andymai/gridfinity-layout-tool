import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useYearSoundtrack } from './useYearSoundtrack';

const created: { closed: boolean }[] = [];

class FakeAudioContext {
  closed = false;
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
  YearSoundtrack: class {
    tick(): void {}
    stop(): void {}
  },
}));

describe('useYearSoundtrack', () => {
  afterEach(() => {
    created.length = 0;
    vi.unstubAllGlobals();
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
    unmount();
    expect(created[0]?.closed).toBe(true);
  });
});
