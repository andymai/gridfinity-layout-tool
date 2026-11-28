import { describe, expect, it } from 'vitest';
import { BEAT } from './motion';
import { layerStarts, layerWeights, printStateAt } from './printLayers';

/** A 10 × 10 floor plate at z 0 and one thin wall rising to z 10. */
const vertices = new Float32Array([
  0, 0, 0, 10, 0, 0, 10, 10, 0, 0, 10, 0, 0, 0, 0, 0, 0, 10, 0, 1, 10,
]);
const indices = new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6]);

describe('layerWeights', () => {
  it('puts each triangle in the layer its middle falls in', () => {
    const weights = layerWeights(vertices, indices, 10);
    expect(weights[0]).toBeCloseTo(100);
    expect(weights.slice(1).every((weight) => weight < 100)).toBe(true);
  });

  it('weighs a flat or empty mesh evenly', () => {
    expect(layerWeights(new Float32Array(0), new Uint32Array(0), 3)).toEqual([1, 1, 1]);
  });
});

describe('layerStarts', () => {
  const starts = layerStarts([10, 1, 1, 1], 1.5 * BEAT, 3 * BEAT);

  it('starts with the print and stays inside its span, in order', () => {
    expect(starts[0]).toBeCloseTo(1.5 * BEAT);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1] ?? 0);
      expect(starts[i]).toBeLessThan(4.5 * BEAT + 1e-6);
    }
  });

  it('gives a heavy layer more time than a light one', () => {
    const heavy = (starts[1] ?? 0) - (starts[0] ?? 0);
    const light = (starts[2] ?? 0) - (starts[1] ?? 0);
    expect(heavy).toBeGreaterThan(light);
  });
});

describe('printStateAt', () => {
  const starts = [1, 2, 3, 4];

  it('shows nothing before the first layer and all of it after the last', () => {
    expect(printStateAt(starts, 0.5).printed).toBe(0);
    expect(printStateAt(starts, 10).printed).toBe(1);
  });

  it('has the newest layer white-hot when it lands, then cooled', () => {
    expect(printStateAt(starts, 2).printed).toBeCloseTo(0.5);
    expect(printStateAt(starts, 2).hotOpacity).toBeCloseTo(1);
    expect(printStateAt(starts, 2.9).hotOpacity).toBeLessThan(0.05);
  });
});
