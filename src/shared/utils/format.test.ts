import { describe, it, expect } from 'vitest';
import { formatMm } from './format';

describe('formatMm', () => {
  it('rounds to two decimal places', () => {
    expect(formatMm(41.999)).toBe('42');
    expect(formatMm(3.14159)).toBe('3.14');
  });

  it('drops trailing zeros', () => {
    expect(formatMm(42)).toBe('42');
    expect(formatMm(10.5)).toBe('10.5');
  });
});
