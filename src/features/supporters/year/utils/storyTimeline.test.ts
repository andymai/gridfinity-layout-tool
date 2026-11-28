import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  nextTime,
  positionAt,
  previousTime,
  startOf,
  transitionAt,
} from './storyTimeline';

const timeline = buildTimeline([4, 5, 6]);

describe('storyTimeline', () => {
  it('lays cards end to end', () => {
    expect(timeline.starts).toEqual([0, 4, 9]);
    expect(timeline.total).toBe(15);
  });

  it('finds the card and the progress through it', () => {
    expect(positionAt(timeline, 0)).toEqual({ index: 0, progress: 0, elapsed: 0 });
    expect(positionAt(timeline, 6.5)).toEqual({ index: 1, progress: 0.5, elapsed: 2.5 });
    expect(positionAt(timeline, 15)).toEqual({ index: 2, progress: 1, elapsed: 6 });
  });

  it('skips to the next card, and past the end from the last one', () => {
    expect(nextTime(timeline, 1)).toBe(4);
    expect(nextTime(timeline, 10)).toBe(15);
  });

  it('restarts the card first, then goes to the one before', () => {
    expect(previousTime(timeline, 6)).toBe(4);
    expect(previousTime(timeline, 4.5)).toBe(0);
    expect(previousTime(timeline, 0.5)).toBe(0);
  });

  it('clamps a card index', () => {
    expect(startOf(timeline, -1)).toBe(0);
    expect(startOf(timeline, 9)).toBe(9);
  });
});

describe('the entrance and the fill between cards', () => {
  // Two cards of 4 and 3 seconds, each followed by a 1-second fill but the last.
  const lead = buildTimeline([5, 3], 2);
  const holds = [4, 3];
  const DISSOLVE = 0.3;

  it('starts the first card after the entrance', () => {
    expect(lead.starts).toEqual([2, 7]);
    expect(lead.total).toBe(10);
    expect(positionAt(lead, 1)).toEqual({ index: 0, progress: 0, elapsed: 0 });
  });

  it("fills the empty stage with the first card's colour", () => {
    expect(transitionAt(lead, holds, 1, DISSOLVE)).toEqual({
      phase: 'fill',
      target: 0,
      time: 1,
      length: 2,
    });
  });

  it('fades the fill off each card as it starts', () => {
    expect(transitionAt(lead, holds, 2.15, DISSOLVE)).toEqual({
      phase: 'dissolve',
      target: 0,
      progress: expect.closeTo(0.5, 6) as number,
    });
  });

  it('fills in the next card after the hold, and nothing after the last card', () => {
    expect(transitionAt(lead, holds, 4, DISSOLVE)).toBeNull();
    expect(transitionAt(lead, holds, 6.5, DISSOLVE)).toEqual({
      phase: 'fill',
      target: 1,
      time: 0.5,
      length: 1,
    });
    expect(transitionAt(lead, holds, 9.9, DISSOLVE)).toBeNull();
  });

  it('cuts a running fill short: a skip lands on the next card, never the end of the fill', () => {
    expect(nextTime(lead, 6.5)).toBe(7);
    expect(transitionAt(lead, holds, nextTime(lead, 6.5), DISSOLVE)?.phase).toBe('dissolve');
  });
});
