import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSupporterFocus } from './useSupporterFocus';
import { CreditsClock } from '../utils/creditsClock';
import { buildRollTimeline } from '../utils/rollTimeline';
import type { RollSchedule } from '../utils/rollSchedule';
import type { SupporterBin } from '../utils/supportersData';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

const bins: SupporterBin[] = [
  { id: 'a', name: 'Ada', department: 2, isNewest: false },
  { id: 'g', name: 'Grace', department: 5, isNewest: false },
];
const schedule: RollSchedule = {
  timeline: buildRollTimeline({
    startOffset: 0,
    endOffset: 2000,
    baseSpeed: 100,
    introSeconds: 5,
    marks: [],
  }),
  seatTimes: new Map([
    ['a', 9],
    ['g', 14],
  ]),
  creditTimes: new Map([
    ['a', 9],
    ['g', 14],
  ]),
  zoneCues: [],
};
const LABELS = Array.from({ length: 9 }, (_, i) => `dept ${i}`);

function setup(over: Partial<Parameters<typeof useSupporterFocus>[0]> = {}) {
  const clock = new CreditsClock(schedule.timeline.duration);
  const setPaused = vi.fn((p: boolean) => clock.setPaused(p));
  const openRoll = vi.fn();
  const hook = renderHook(() =>
    useSupporterFocus({
      bins,
      rolling: true,
      schedule,
      clock,
      setPaused,
      departmentLabels: LABELS,
      creditName: null,
      openRoll,
      ...over,
    })
  );
  return { ...hook, clock, setPaused, openRoll };
}

afterEach(() => vi.useRealTimers());

describe('useSupporterFocus', () => {
  it('pauses mid-roll with the bin already seated', () => {
    const { result, clock } = setup();
    act(() => result.current.showSupporter('g', true));
    expect(clock.time).toBeCloseTo(14.75, 5);
    expect(clock.isPaused).toBe(true);
    expect(result.current.focusedId).toBe('g');
  });

  it('shows a clicked bin without stopping the roll', () => {
    const { result, clock } = setup();
    act(() => result.current.selectBin('a'));
    expect(result.current.focusedId).toBe('a');
    expect(clock.isPaused).toBe(false);
  });

  it('flies to the bin when the roll is not running', () => {
    const { result } = setup({ rolling: false });
    act(() => result.current.showSupporter('a', true));
    expect(result.current.flyTo).toMatchObject({ id: 'a' });
  });

  it('names the department of a supporter found by search', () => {
    const { result } = setup();
    act(() => result.current.setFindQuery('grace'));
    act(() => result.current.findText());
    expect(result.current.findStatus).toBe('supporters.find.department');
    expect(result.current.focusedId).toBe('g');
  });

  it('resumes when the paused credit is clicked again', () => {
    const { result, clock } = setup();
    act(() => result.current.onCredit('a'));
    act(() => result.current.onCredit('a'));
    expect(clock.isPaused).toBe(false);
    expect(result.current.focusedId).toBeNull();
  });

  describe('letting go of a found supporter', () => {
    it('resumes the roll when the search is cleared mid-roll', () => {
      const { result, clock } = setup();
      act(() => result.current.setFindQuery('Grace'));
      act(() => result.current.findText());
      expect(clock.isPaused).toBe(true);
      act(() => result.current.setFindQuery(''));
      expect(result.current.focusedId).toBeNull();
      expect(result.current.findStatus).toBeNull();
      expect(clock.isPaused).toBe(false);
    });

    it('sends the camera home when the search is cleared in the finale', () => {
      const { result } = setup({ rolling: false });
      act(() => result.current.setFindQuery('Ada'));
      act(() => result.current.findText());
      const before = result.current.homeRequest;
      act(() => result.current.setFindQuery(''));
      expect(result.current.focusedId).toBeNull();
      expect(result.current.flyTo).toBeNull();
      expect(result.current.homeRequest).toBe(before + 1);
    });

    it('lets go the same way on a click into empty space', () => {
      const { result, clock } = setup();
      act(() => result.current.onCredit('a'));
      act(() => result.current.release());
      expect(result.current.focusedId).toBeNull();
      expect(clock.isPaused).toBe(false);
    });

    it('keeps a pause the visitor chose themselves', () => {
      const { result, clock } = setup();
      act(() => result.current.togglePause());
      act(() => result.current.selectBin('a'));
      act(() => result.current.release());
      expect(result.current.focusedId).toBeNull();
      expect(clock.isPaused).toBe(true);
    });

    it('keeps a pause the visitor chose before searching', () => {
      const { result, clock } = setup();
      act(() => result.current.togglePause());
      act(() => result.current.setFindQuery('Grace'));
      act(() => result.current.findText());
      act(() => result.current.setFindQuery(''));
      expect(result.current.focusedId).toBeNull();
      expect(clock.isPaused).toBe(true);
    });

    it('leaves a camera that never flew where the visitor put it', () => {
      const { result } = setup({ rolling: false });
      act(() => result.current.selectBin('a'));
      const before = result.current.homeRequest;
      act(() => result.current.release());
      expect(result.current.homeRequest).toBe(before);
    });
  });

  it('lands a shared link on its supporter, reopening the roll', () => {
    const { result, clock, openRoll } = setup({ creditName: 'Grace' });
    act(() => result.current.landCreditLink(schedule));
    expect(openRoll).toHaveBeenCalled();
    expect(clock.time).toBeCloseTo(14.75, 5);
    expect(result.current.spotlight).toBe('Grace');
  });

  it('lands a shared link only once, and only on an exact name', () => {
    const exact = setup({ creditName: 'Grace' });
    act(() => exact.result.current.landCreditLink(schedule));
    exact.clock.seek(0);
    act(() => exact.result.current.landCreditLink(schedule));
    expect(exact.clock.time).toBe(0);

    const partial = setup({ creditName: 'Gra' });
    act(() => partial.result.current.landCreditLink(schedule));
    expect(partial.result.current.spotlight).toBeNull();
  });

  it('flies to a linked supporter under reduced motion and lets the spotlight fade', () => {
    vi.useFakeTimers();
    const { result } = setup({ creditName: 'Ada', rolling: false });
    act(() => result.current.landCreditLink(null));
    expect(result.current.flyTo).toMatchObject({ id: 'a' });
    expect(result.current.spotlight).toBe('Ada');
    act(() => vi.advanceTimersByTime(6000));
    expect(result.current.spotlight).toBeNull();
  });
});
