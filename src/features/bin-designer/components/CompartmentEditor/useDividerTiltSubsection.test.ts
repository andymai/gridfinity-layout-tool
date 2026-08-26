import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { createTrailingTrack, rowKeyOf } from './useDividerTiltSubsection';

describe('useDividerTiltSubsection helpers', () => {
  it('rowKeyOf joins compartment IDs in canonical order with a dash', () => {
    expect(rowKeyOf(0, 1)).toBe('0-1');
    expect(rowKeyOf(2, 7)).toBe('2-7');
  });

  it('rowKeyOf normalizes argument order so callers can pass the pair either way', () => {
    expect(rowKeyOf(7, 2)).toBe('2-7');
    expect(rowKeyOf(1, 0)).toBe('0-1');
  });
});

describe('createTrailingTrack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends only the last payload of a burst, once the delay elapses', () => {
    const send = vi.fn();
    const track = createTrailingTrack(send, 2000);

    track.queue({ lean_deg: 1 });
    track.queue({ lean_deg: 2 });
    track.queue({ lean_deg: 3 });
    expect(send).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ lean_deg: 3 });
  });

  it('flush sends a pending payload immediately and cancels the timer', () => {
    const send = vi.fn();
    const track = createTrailingTrack(send, 2000);

    track.queue({ lean_deg: 5 });
    track.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({ lean_deg: 5 });

    // The cancelled timer must not fire a duplicate.
    vi.advanceTimersByTime(5000);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('flush with nothing pending sends nothing', () => {
    const send = vi.fn();
    createTrailingTrack(send, 2000).flush();
    expect(send).not.toHaveBeenCalled();
  });

  it('a new burst after a send starts a fresh debounce window', () => {
    const send = vi.fn();
    const track = createTrailingTrack(send, 2000);

    track.queue({ lean_deg: 1 });
    vi.advanceTimersByTime(2000);
    track.queue({ lean_deg: 2 });
    vi.advanceTimersByTime(2000);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({ lean_deg: 2 });
  });
});
