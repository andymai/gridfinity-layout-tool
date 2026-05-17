import { describe, it, expect } from 'vitest';
import { pMap } from '../lib/concurrency';

describe('pMap', () => {
  it('preserves order', async () => {
    const out = await pMap([1, 2, 3, 4, 5], async (n) => n * 2, 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('bounds in-flight count', async () => {
    let inFlight = 0;
    let peak = 0;
    const work = (): Promise<number> =>
      new Promise((res) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        setTimeout(() => {
          inFlight--;
          res(1);
        }, 5);
      });
    await pMap(
      Array.from({ length: 20 }, () => 0),
      work,
      4
    );
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('handles empty input', async () => {
    expect(await pMap([], async () => 1, 4)).toEqual([]);
  });
});
