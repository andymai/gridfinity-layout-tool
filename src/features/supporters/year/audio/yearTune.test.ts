import { describe, expect, it } from 'vitest';
import { LOOP_NOTES, LOOP_STEPS, STEPS_PER_BAR, notesBetween } from './yearTune';

describe('yearTune', () => {
  it('lays a pad, a bass and drums under every bar', () => {
    const bars = LOOP_STEPS / STEPS_PER_BAR;
    for (let bar = 0; bar < bars; bar++) {
      const start = bar * STEPS_PER_BAR;
      const inBar = LOOP_NOTES.filter((n) => n.step >= start && n.step < start + STEPS_PER_BAR);
      expect(inBar.filter((n) => n.voice === 'pad')).toHaveLength(1);
      expect(inBar.some((n) => n.voice === 'bass')).toBe(true);
      expect(inBar.some((n) => n.voice === 'kick')).toBe(true);
    }
  });

  it('keeps every note inside the loop, in order', () => {
    const steps = LOOP_NOTES.map((n) => n.step);
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(steps.every((s) => s >= 0 && s < LOOP_STEPS)).toBe(true);
  });

  it('continues across the loop seam without a gap or a repeat', () => {
    const seam = notesBetween(LOOP_STEPS - 4, LOOP_STEPS + 4);
    expect(seam.some((n) => n.step === LOOP_STEPS && n.voice === 'pad')).toBe(true);
    expect(new Set(seam.map((n) => `${n.step}-${n.voice}-${n.notes.join()}`)).size).toBe(
      seam.length
    );
  });

  it('returns nothing for an empty window', () => {
    expect(notesBetween(10, 10)).toEqual([]);
  });
});
