import { describe, expect, it, vi } from 'vitest';
import { CreditsClock } from './creditsClock';

const run = (clock: CreditsClock, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) clock.advance(dt);
};

describe('CreditsClock', () => {
  it('eases up to normal speed rather than jumping to it', () => {
    const clock = new CreditsClock(100);
    clock.advance(1 / 60);
    expect(clock.rate).toBeGreaterThan(0);
    expect(clock.rate).toBeLessThan(0.5);
    run(clock, 2);
    expect(clock.rate).toBeCloseTo(1, 2);
  });

  it('stops when paused and holds its place', () => {
    const clock = new CreditsClock(100);
    run(clock, 3);
    clock.setPaused(true);
    const at = clock.time;
    run(clock, 2);
    expect(clock.time).toBeCloseTo(at, 5);
  });

  it('fast-forwards and rewinds while held, even when paused', () => {
    const clock = new CreditsClock(100);
    clock.seek(50);
    clock.setPaused(true);
    clock.setHoldRate(-6);
    run(clock, 2);
    expect(clock.time).toBeLessThan(45);
    clock.setHoldRate(null);
    run(clock, 2);
    expect(clock.rate).toBeCloseTo(0, 2);
  });

  it('says whether the end came from playing or from jumping there', () => {
    const onEnd = vi.fn();
    const clock = new CreditsClock(2, onEnd);
    run(clock, 4);
    expect(onEnd).toHaveBeenLastCalledWith(true);
    clock.seek(0);
    clock.seek(2);
    expect(onEnd).toHaveBeenLastCalledWith(false);
    clock.seek(1.5);
    clock.setHoldRate(6);
    run(clock, 2);
    expect(onEnd).toHaveBeenLastCalledWith(false);
  });

  it('ends once, and again only after it has been rewound', () => {
    const onEnd = vi.fn();
    const clock = new CreditsClock(10, onEnd);
    run(clock, 15);
    expect(onEnd).toHaveBeenCalledTimes(1);
    clock.seek(0);
    clock.seek(10);
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('notifies listeners on a seek, so a paused roll still follows a scrub', () => {
    const clock = new CreditsClock(100);
    const listener = vi.fn();
    const unsubscribe = clock.subscribe(listener);
    clock.setPaused(true);
    clock.seek(30);
    expect(listener).toHaveBeenCalledWith(clock);
    unsubscribe();
    clock.seek(40);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not end a roll that has not been measured yet', () => {
    const onEnd = vi.fn();
    const clock = new CreditsClock(0, onEnd);
    run(clock, 1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('keeps the playhead inside a shorter duration', () => {
    const clock = new CreditsClock(100);
    clock.seek(90);
    clock.setDuration(60);
    expect(clock.time).toBe(60);
  });
});
