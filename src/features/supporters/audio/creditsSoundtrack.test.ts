import { describe, expect, it } from 'vitest';
import { crossedAny, musicFor } from './creditsSoundtrack';

describe('musicFor', () => {
  it('plays along at normal speed', () => {
    expect(musicFor(1, true)).toEqual({ mode: 'play', tempo: 1, pitch: 1 });
  });

  it('speeds up and pitches up with a fast-forward, within a cap', () => {
    const fast = musicFor(6, true);
    expect(fast.mode).toBe('play');
    expect(fast.tempo).toBe(1.75);
    expect(fast.pitch).toBeGreaterThan(1);
  });

  it('holds while paused and warbles while rewinding', () => {
    expect(musicFor(0, true).mode).toBe('hold');
    expect(musicFor(-6, true).mode).toBe('rewind');
  });

  it('goes quiet once the credits are over', () => {
    expect(musicFor(1, false).mode).toBe('off');
  });
});

describe('crossedAny', () => {
  const seats = new Float64Array([1, 2.5, 4]);

  it('catches a seat inside the step, counting its end but not its start', () => {
    expect(crossedAny(seats, 2.4, 2.6)).toBe(true);
    expect(crossedAny(seats, 2.5, 3.9)).toBe(false);
    expect(crossedAny(seats, 3.9, 4)).toBe(true);
  });

  it('finds nothing past the last seat or in an empty list', () => {
    expect(crossedAny(seats, 4, 10)).toBe(false);
    expect(crossedAny(new Float64Array(0), 0, 10)).toBe(false);
  });
});
