import { describe, it, expect } from 'vitest';
import { getPatternCalculator } from './registry';
import { isStampCalculator } from './types';
import { PATTERN_WEB_THICKNESS } from './patternScale';

const STAMP_PATTERNS = ['honeycomb', 'round', 'diamond', 'triangle', 'slots'] as const;

describe('getPatternCalculator web thickness', () => {
  it.each(STAMP_PATTERNS)('threads the strut width into %s', (pattern) => {
    const calculator = getPatternCalculator(pattern, 4, 0.5, 1.6);
    expect(isStampCalculator(calculator)).toBe(true);
    if (isStampCalculator(calculator)) expect(calculator.getWebThickness()).toBe(1.6);
  });

  it.each(STAMP_PATTERNS)('defaults %s to the legacy web', (pattern) => {
    const calculator = getPatternCalculator(pattern, 4, 0.5);
    if (isStampCalculator(calculator)) {
      expect(calculator.getWebThickness()).toBe(PATTERN_WEB_THICKNESS);
    }
  });

  it('clamps an untrusted strut width', () => {
    const calculator = getPatternCalculator('round', 4, 0.5, 40);
    if (isStampCalculator(calculator)) expect(calculator.getWebThickness()).toBe(2.4);
  });

  it('ignores the strut width on a kumiko lattice', () => {
    const calculator = getPatternCalculator('goma', 4, 0.5, 1.6);
    expect(isStampCalculator(calculator)).toBe(false);
  });
});
