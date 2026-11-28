import { describe, expect, it } from 'vitest';
import { BEAT } from './motion';
import { TILE, tilePose, tileSpan, tileStart } from './tiles';

describe('tileSpan', () => {
  it('covers exactly the card when the frame is the card', () => {
    expect(tileSpan({ width: 1080, height: 1920, left: 0, top: 0, scale: 1 }, 1920)).toEqual({
      c0: 0,
      c1: 8,
      r0: 0,
      r1: 15,
    });
  });

  it('runs past the card on a tall phone, above and below it', () => {
    const span = tileSpan({ width: 390, height: 844, left: 0, top: 75.5, scale: 390 / 1080 }, 1920);
    expect(span.r0).toBeLessThan(0);
    expect((span.r1 + 1) * TILE).toBeGreaterThan(1920);
  });
});

describe('tileStart', () => {
  it('lands the front row first and every tile on a 64th-note tick', () => {
    const length = BEAT;
    expect(tileStart(0, 16, 0, 9, length)).toBeLessThan(tileStart(15, 16, 0, 9, length));
    for (const [row, col] of [
      [3, 2],
      [10, 7],
      [15, 8],
    ] as const) {
      const start = tileStart(row, 16, col, 9, length);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(length);
      expect((start / (BEAT / 16)) % 1).toBeCloseTo(0, 6);
    }
  });
});

describe('tilePose', () => {
  it('has every tile in place by the end of the fill', () => {
    for (const row of [0, 7, 15]) {
      const pose = tilePose(BEAT * 1.5, row, 16, 4, 9, BEAT, false);
      expect(pose.opacity).toBe(1);
      expect(Math.abs(pose.y)).toBeLessThan(0.5);
    }
  });

  it('only fades rows in, in three steps, under reduced motion', () => {
    const early = tilePose(BEAT * 0.3, 0, 16, 0, 9, BEAT, true);
    const late = tilePose(BEAT * 0.3, 15, 16, 0, 9, BEAT, true);
    expect(early.y).toBe(0);
    expect(early.opacity).toBeGreaterThan(late.opacity);
  });
});
