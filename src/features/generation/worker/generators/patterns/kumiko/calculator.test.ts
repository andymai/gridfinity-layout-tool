import { describe, it, expect } from 'vitest';
import { createKumikoCalculator } from './calculator';
import { createMitsukudeCalculator, MITSUKUDE_DEF } from './mitsukude';
import { KUMIKO_STRUT_WIDTH } from './segmentLattice';

const BAND = { perimeter: 160, bandHeight: 20 };

describe('createKumikoCalculator', () => {
  it('exposes the wrapped-lattice strategy and pattern id', () => {
    const calc = createKumikoCalculator(MITSUKUDE_DEF, 0.5);
    expect(calc.strategy).toBe('wrapped-lattice');
    expect(calc.getPatternType()).toBe('mitsukude');
    expect(calc.getVoidFraction()).toBe(MITSUKUDE_DEF.voidFraction);
  });

  it('scales lattice density with the pattern scale slider', () => {
    const fine = createKumikoCalculator(MITSUKUDE_DEF, 0).getLattice(BAND);
    const neutral = createKumikoCalculator(MITSUKUDE_DEF, 0.5).getLattice(BAND);
    const bold = createKumikoCalculator(MITSUKUDE_DEF, 1).getLattice(BAND);
    expect(fine.columnPitch).toBeLessThan(neutral.columnPitch);
    expect(neutral.columnPitch).toBeLessThan(bold.columnPitch);
    expect(fine.segments.length).toBeGreaterThan(bold.segments.length);
  });

  it('reports a strut-half-width shape radius for junction border sizing', () => {
    const calc = createKumikoCalculator(MITSUKUDE_DEF, 0.5);
    expect(calc.getShapeRadius()).toBeCloseTo(KUMIKO_STRUT_WIDTH / 2, 9);
  });

  it('requires at least one cell row of band height', () => {
    const calc = createMitsukudeCalculator(6, 0.5);
    expect(calc.getMinPatternHeight()).toBeGreaterThan(5);
    expect(calc.getLattice(BAND).segments.length).toBeGreaterThan(0);
  });
});
