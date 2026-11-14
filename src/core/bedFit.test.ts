import { describe, it, expect } from 'vitest';
import { fitsBedAtAnyAngle } from './bedFit';

/** Sweeps the turn in 0.001° steps: slow, but has no formula to get wrong. */
function fitsBySweep(w: number, d: number, bedW: number, bedD: number): boolean {
  const steps = 90_000;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2);
    const c = Math.cos(t);
    const s = Math.sin(t);
    if (w * c + d * s <= bedW + 1e-9 && w * s + d * c <= bedD + 1e-9) return true;
  }
  return false;
}

describe('fitsBedAtAnyAngle', () => {
  it('fits a 1.5 x 7 bin across a 256mm bed diagonally', () => {
    expect(fitsBedAtAnyAngle(1.5 * 42, 7 * 42, 256, 256)).toBe(true);
  });

  it('rejects a part too long even for the diagonal', () => {
    expect(fitsBedAtAnyAngle(1.5 * 42, 8 * 42, 256, 256)).toBe(false);
  });

  it('fits square-on and turned 90°', () => {
    expect(fitsBedAtAnyAngle(100, 200, 220, 120)).toBe(true);
    expect(fitsBedAtAnyAngle(200, 100, 220, 120)).toBe(true);
  });

  it('never fits a square part wider than the bed', () => {
    expect(fitsBedAtAnyAngle(260, 260, 256, 256)).toBe(false);
    expect(fitsBedAtAnyAngle(230, 230, 300, 220)).toBe(false);
  });

  it('rejects a part wider than the bed at its narrowest', () => {
    expect(fitsBedAtAnyAngle(230, 400, 400, 220)).toBe(false);
  });

  it('agrees with a sweep over every turn on a spread of parts and beds', () => {
    const parts = [20, 45, 63, 84, 126, 168, 210, 252, 294, 336];
    const beds: ReadonlyArray<readonly [number, number]> = [
      [180, 180],
      [220, 220],
      [256, 256],
      [250, 210],
      [350, 320],
    ];
    let rotatedOnly = 0;
    for (const [bedW, bedD] of beds) {
      for (const w of parts) {
        for (const d of parts) {
          const expected = fitsBySweep(w, d, bedW, bedD);
          expect(fitsBedAtAnyAngle(w, d, bedW, bedD), `${w}x${d} on ${bedW}x${bedD}`).toBe(
            expected
          );
          const squareOn = (w <= bedW && d <= bedD) || (w <= bedD && d <= bedW);
          if (expected && !squareOn) rotatedOnly++;
        }
      }
    }
    // Guards the sweep itself: a grid with no angle-only fits proves nothing.
    expect(rotatedOnly).toBeGreaterThan(0);
  });
});
