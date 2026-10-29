import { describe, expect, it } from 'vitest';
import { buildCreditsPlan } from './creditsPlan';
import { INTRO_SECONDS, buildRollSchedule, zoneAt, type MeasuredCredit } from './rollSchedule';
import type { SupporterBin } from './supportersData';

const bins: SupporterBin[] = [
  { id: 'a', name: 'Ada', department: 0, isNewest: false },
  { id: 'b', name: 'Bo', department: 0, isNewest: false },
  { id: 'd', name: 'Dee', department: 0, isNewest: false },
  { id: 'e', name: 'Eli', department: 0, isNewest: false },
  { id: 'q', name: 'Quinn', department: 0, message: 'Saved my whole garage', isNewest: false },
  { id: 'c', name: 'Cy', department: 3, isNewest: false },
  { id: 'x', name: null, isNewest: false },
];
const plan = buildCreditsPlan(bins);
const binsById = new Map(bins.map((b) => [b.id, b]));

/** Stack every credit 60 px tall, top to bottom, as the DOM would. */
const measured: MeasuredCredit[] = plan.items.map((item, i) => ({
  id: item.id,
  center: i * 60 + 30,
  height: 60,
}));
const region = { height: 600, readingLine: 350 };
const schedule = buildRollSchedule(plan, binsById, measured, region, 100);

describe('buildRollSchedule', () => {
  it('seats every credited bin after the title card', () => {
    expect([...schedule.seatTimes.keys()].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'q', 'x']);
    for (const time of schedule.seatTimes.values()) expect(time).toBeGreaterThan(INTRO_SECONDS);
  });

  it('drops the names in a block one after another', () => {
    const block = plan.items.find((i) => i.kind === 'names' && i.binIds.length > 1);
    const ids = block?.kind === 'names' ? block.binIds : [];
    const [first, second] = ids.map((id) => schedule.seatTimes.get(id) ?? 0);
    expect(second).toBeGreaterThan(first);
    expect(second - first).toBeLessThan(0.2);
  });

  it('seats a bin as its credit crosses the reading line', () => {
    const line = measured.find((m) => m.id === 'message-q');
    const at = (line?.center ?? 0) - region.readingLine;
    expect(schedule.timeline.offsetAt(schedule.seatTimes.get('q') ?? 0)).toBeCloseTo(at, 0);
  });

  it('cues the camera to each department ahead of its heading, in roll order', () => {
    expect(schedule.zoneCues.map((c) => c.zone)).toEqual([0, 3, 8]);
    const heading = measured.find((m) => m.id === 'dept-3');
    const read = schedule.timeline.timeAt((heading?.center ?? 0) - region.readingLine);
    expect(schedule.zoneCues[1].time).toBeLessThan(read);
  });

  it('starts with the first credit just below the region and ends near its top', () => {
    const { timeline } = schedule;
    expect(timeline.startOffset).toBe(-region.height);
    const last = measured.at(-1);
    expect(timeline.endOffset).toBeCloseTo((last?.center ?? 0) - region.height * 0.3);
  });

  it('slows down for a quote, so it takes longer than a block of names', () => {
    const plain = buildRollSchedule(
      buildCreditsPlan(bins.map((b) => ({ ...b, message: undefined }))),
      binsById,
      measured,
      region,
      100
    );
    expect(schedule.timeline.duration).toBeGreaterThan(plain.timeline.duration);
  });
});

describe('zoneAt', () => {
  it('follows the cues and is null before the first one', () => {
    expect(zoneAt(schedule, 0)).toBeNull();
    expect(zoneAt(schedule, schedule.zoneCues[1].time + 0.01)).toBe(3);
    expect(zoneAt(schedule, schedule.timeline.duration)).toBe(8);
  });
});
