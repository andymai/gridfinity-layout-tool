import { describe, expect, it } from 'vitest';
import { buildTimeline, nextTime, positionAt, previousTime, startOf } from './storyTimeline';

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
