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
  const onShown = vi.fn();
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
      onShown,
      ...over,
    })
  );
  return { ...hook, clock, setPaused, openRoll, onShown };
}

afterEach(() => vi.useRealTimers());

describe('useSupporterFocus', () => {
  it('pauses mid-roll with the bin already seated', () => {
    const { result, clock, onShown } = setup();
    act(() => result.current.showSupporter('g', true));
    expect(clock.time).toBeCloseTo(14.75, 5);
    expect(clock.isPaused).toBe(true);
    expect(result.current.focusedId).toBe('g');
    expect(onShown).toHaveBeenCalledWith(bins[1]);
  });

  it('shows a clicked bin without stopping the roll, and reports who was shown', () => {
    const { result, clock, onShown } = setup();
    act(() => result.current.selectBin('a'));
    expect(result.current.focusedId).toBe('a');
    expect(clock.isPaused).toBe(false);
    expect(onShown).toHaveBeenCalledWith(bins[0]);
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

  it('lands a shared link on its supporter, reopening the roll', () => {
    const { result, clock, openRoll, onShown } = setup({ creditName: 'Grace' });
    act(() => result.current.landCreditLink(schedule));
    expect(openRoll).toHaveBeenCalled();
    expect(clock.time).toBeCloseTo(14.75, 5);
    expect(result.current.spotlight).toBe('Grace');
    expect(onShown).toHaveBeenCalledWith(bins[1]);
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
