import { describe, expect, it } from 'vitest';
import {
  LOOP_EVENTS,
  LOOP_STEPS,
  STEPS_PER_BAR,
  chordAt,
  eventsInWindow,
  midiToHz,
} from './creditsTune';

describe('creditsTune', () => {
  it('is sixteen bars, with every melody note inside its bar', () => {
    expect(LOOP_STEPS).toBe(16 * STEPS_PER_BAR);
    for (const e of LOOP_EVENTS.filter((e) => e.voice === 'lead')) {
      const inBar = e.step % STEPS_PER_BAR;
      expect(inBar + e.length).toBeLessThanOrEqual(STEPS_PER_BAR);
    }
  });

  it('keeps the melody in the key of A minor (with the raised seventh over E)', () => {
    const scale = new Set([9, 11, 0, 2, 4, 5, 7, 8]);
    for (const e of LOOP_EVENTS.filter((e) => e.voice === 'lead')) {
      expect(scale.has(e.midi % 12)).toBe(true);
    }
  });

  it('plays the same window identically on every lap of the loop', () => {
    const first = eventsInWindow(0, 32).map((e) => [e.voice, e.midi]);
    const third = eventsInWindow(LOOP_STEPS * 2, LOOP_STEPS * 2 + 32).map((e) => [e.voice, e.midi]);
    expect(third).toEqual(first);
  });

  it('returns a window that straddles the loop seam without gaps', () => {
    const seam = eventsInWindow(LOOP_STEPS - 2, LOOP_STEPS + 2);
    const kicks = seam.filter((e) => e.voice === 'kick').map((e) => e.step);
    expect(kicks).toEqual([LOOP_STEPS]);
    expect(seam.every((e) => e.step >= LOOP_STEPS - 2 && e.step < LOOP_STEPS + 2)).toBe(true);
  });

  it('finds the chord under a step, including negative ones', () => {
    expect(chordAt(0)).toEqual(chordAt(LOOP_STEPS));
    expect(chordAt(-1)).toEqual(chordAt(LOOP_STEPS - 1));
  });

  it('tunes A4 to 440 Hz', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBeCloseTo(880);
  });
});
