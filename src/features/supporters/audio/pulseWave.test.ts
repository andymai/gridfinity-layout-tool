import { describe, expect, it } from 'vitest';
import { pulseCoefficients } from './pulseWave';

/** One period of the wave the coefficients describe, sampled. */
function sample(duty: number, points = 400): number[] {
  const { real, imag } = pulseCoefficients(duty, 200);
  return Array.from({ length: points }, (_, k) => {
    const t = (k + 0.5) / points;
    let v = 0;
    for (let n = 1; n < real.length; n++) {
      v += real[n] * Math.cos(2 * Math.PI * n * t) + imag[n] * Math.sin(2 * Math.PI * n * t);
    }
    return v;
  });
}

describe('pulseCoefficients', () => {
  it('describes a wave that is high for exactly its duty cycle', () => {
    for (const duty of [0.125, 0.25, 0.5]) {
      const wave = sample(duty);
      const high = wave.filter((v) => v > 0).length / wave.length;
      expect(high).toBeCloseTo(duty, 1);
    }
  });

  it('has no DC term, so it sits centred on silence', () => {
    const { real, imag } = pulseCoefficients(0.25);
    expect(real[0]).toBe(0);
    expect(imag[0]).toBe(0);
  });
});
