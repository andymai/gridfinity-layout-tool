import { describe, expect, it } from 'vitest';
import {
  BEAT,
  dropPose,
  easeOut,
  enterPose,
  hash,
  onGrid,
  springContact,
  springX,
  squash,
} from './motion';

describe('the beat grid', () => {
  it('is 88 beats a minute', () => {
    expect(BEAT).toBeCloseTo(0.6818, 4);
  });

  it('snaps a time to the nearest subdivision', () => {
    const step = BEAT / 12;
    expect(onGrid(step * 3.4, step)).toBeCloseTo(step * 3);
    expect(onGrid(step * 3.6, step)).toBeCloseTo(step * 4);
  });
});

describe('the spring', () => {
  it('rests at 1 before it starts and settles at 0', () => {
    expect(springX(-1, 0.55, 0.25)).toBe(1);
    expect(springX(0, 0.55, 0.25)).toBe(1);
    expect(Math.abs(springX(5, 0.55, 0.25))).toBeLessThan(1e-3);
  });

  it('first crosses zero at its contact time, then every half period', () => {
    const { first, period } = springContact(0.55, 0.25);
    expect(springX(first, 0.55, 0.25)).toBeCloseTo(0, 6);
    expect(springX(first + period, 0.55, 0.25)).toBeCloseTo(0, 6);
  });
});

describe('easing and squash', () => {
  it('eases out from 0 to 1 and clamps outside', () => {
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });

  it('squashes only just after a contact', () => {
    expect(squash(-0.01, 0.1)).toBe(0);
    expect(squash(0.05, 0.1)).toBeGreaterThan(0);
    expect(squash(0.3, 0.1)).toBe(0);
  });

  it('hashes to a stable value in [0, 1)', () => {
    expect(hash(3, 4)).toBe(hash(3, 4));
    for (let i = 0; i < 50; i++) {
      const value = hash(i, i * 7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('enterPose', () => {
  it('rises into place and shows fully once the entrance is over', () => {
    expect(enterPose(0, 1, 36, false).opacity).toBe(0);
    expect(enterPose(1.1, 1, 36, false).y).toBeGreaterThan(0);
    const done = enterPose(5, 1, 36, false);
    expect(done.opacity).toBe(1);
    expect(done.y).toBeCloseTo(0, 6);
  });

  it('only fades under reduced motion, on the same beat', () => {
    const mid = enterPose(1.1, 1, 36, true);
    expect(mid.y).toBe(0);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
  });
});

describe('dropPose', () => {
  const spec = { contact: 1, height: 600 };

  it('is out of sight above the card before the fall and at rest after', () => {
    expect(dropPose(0, spec).opacity).toBe(0);
    const rest = dropPose(6, spec);
    expect(rest.opacity).toBe(1);
    expect(Math.abs(rest.y)).toBeLessThan(1);
  });

  it('touches the floor at its contact time', () => {
    expect(dropPose(1, spec).y).toBeCloseTo(0, 3);
  });
});
