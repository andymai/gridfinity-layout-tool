import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCreditsClock } from './useCreditsClock';

let pending = new Map<number, FrameRequestCallback>();
let nextId = 1;
let now = 0;

const frames = (count: number, ms = 16) => {
  for (let i = 0; i < count; i++) {
    now += ms;
    const callbacks = [...pending.values()];
    pending = new Map();
    act(() => callbacks.forEach((cb) => cb(now)));
  }
};

beforeEach(() => {
  pending = new Map();
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useCreditsClock', () => {
  it('ticks the playhead forward while running', () => {
    const { result } = renderHook(() => useCreditsClock(true, () => {}));
    result.current.clock.setDuration(60);
    frames(120);
    expect(result.current.clock.time).toBeGreaterThan(1);
  });

  it('stops ticking when no longer running', () => {
    const { result, rerender } = renderHook(({ running }) => useCreditsClock(running, () => {}), {
      initialProps: { running: true },
    });
    result.current.clock.setDuration(60);
    frames(30);
    rerender({ running: false });
    const at = result.current.clock.time;
    frames(30);
    expect(result.current.clock.time).toBe(at);
    expect(pending.size).toBe(0);
  });

  it('caps a long frame, so returning to a background tab does not leap ahead', () => {
    const { result } = renderHook(() => useCreditsClock(true, () => {}));
    result.current.clock.setDuration(600);
    result.current.clock.rate = 1;
    frames(1, 30_000);
    expect(result.current.clock.time).toBeLessThan(0.2);
  });

  it('reports pause to React and to the clock together', () => {
    const { result } = renderHook(() => useCreditsClock(true, () => {}));
    act(() => result.current.setPaused(true));
    expect(result.current.paused).toBe(true);
    expect(result.current.clock.isPaused).toBe(true);
  });

  it('calls the latest end handler', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ onEnd }) => useCreditsClock(true, onEnd), {
      initialProps: { onEnd: first },
    });
    rerender({ onEnd: second });
    result.current.clock.setDuration(1);
    act(() => result.current.clock.seek(1));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
