import { describe, expect, it } from 'vitest';
import { buildRollTimeline, messageDwell, scrubTime } from './rollTimeline';

const base = { startOffset: -600, endOffset: 3400, baseSpeed: 100, introSeconds: 5 };

describe('buildRollTimeline', () => {
  it('holds on the title card, then rolls at the base speed', () => {
    const timeline = buildRollTimeline({ ...base, marks: [] });
    expect(timeline.offsetAt(4.9)).toBe(-600);
    expect(timeline.duration).toBeCloseTo(5 + 4000 / 100, 3);
    expect(timeline.offsetAt(15)).toBeCloseTo(400, 1);
  });

  it('spends at least the dwell time inside a reading window', () => {
    const mark = { at: 1000, height: 80, dwell: 5 };
    const timeline = buildRollTimeline({ ...base, marks: [mark] });
    const half = mark.height / 2 + 48;
    const inside = timeline.timeAt(mark.at + half) - timeline.timeAt(mark.at - half);
    expect(inside).toBeGreaterThanOrEqual(mark.dwell - 0.05);
  });

  it('eases into a quote instead of stepping its speed', () => {
    const timeline = buildRollTimeline({ ...base, marks: [{ at: 1000, height: 80, dwell: 5 }] });
    let previous = base.baseSpeed;
    for (let offset = 760; offset <= 900; offset += 10) {
      const speed = 10 / (timeline.timeAt(offset + 5) - timeline.timeAt(offset - 5));
      expect(speed).toBeLessThanOrEqual(previous + 1e-6);
      expect(previous - speed).toBeLessThan(15);
      previous = speed;
    }
  });

  it('round-trips between time and offset', () => {
    const timeline = buildRollTimeline({
      ...base,
      marks: [
        { at: 300, height: 60, dwell: 3 },
        { at: 2200, height: 120, dwell: 6 },
      ],
    });
    for (let offset = -500; offset < 3400; offset += 137) {
      expect(timeline.offsetAt(timeline.timeAt(offset))).toBeCloseTo(offset, 3);
    }
  });

  it('clamps outside the roll', () => {
    const timeline = buildRollTimeline({ ...base, marks: [] });
    expect(timeline.offsetAt(-3)).toBe(-600);
    expect(timeline.offsetAt(1e6)).toBe(3400);
    expect(timeline.timeAt(1e6)).toBe(timeline.duration);
  });

  it('survives a roll with nothing in it', () => {
    const timeline = buildRollTimeline({ ...base, endOffset: -600, marks: [] });
    expect(timeline.duration).toBe(5);
    expect(timeline.offsetAt(10)).toBe(-600);
  });
});

describe('messageDwell', () => {
  it('gives longer quotes longer, within bounds', () => {
    expect(messageDwell(8)).toBe(1.4);
    expect(messageDwell(60)).toBeGreaterThan(messageDwell(30));
    expect(messageDwell(280)).toBe(4.5);
  });
});

describe('scrubTime', () => {
  const timeline = buildRollTimeline({ ...base, marks: [{ at: 1000, height: 80, dwell: 6 }] });

  it('moves the roll by exactly the distance scrubbed, even through a slow quote', () => {
    const from = timeline.timeAt(900);
    expect(timeline.offsetAt(scrubTime(timeline, from, 250, 100))).toBeCloseTo(1150, 1);
  });

  it('rewinds out of the roll and back into the title card', () => {
    const from = timeline.timeAt(-550);
    expect(scrubTime(timeline, from, -150, 100)).toBeCloseTo(base.introSeconds - 1, 5);
  });

  it('scrubs forward through the title card at the base speed', () => {
    expect(scrubTime(timeline, 1, 200, 100)).toBeCloseTo(3, 5);
  });
});
