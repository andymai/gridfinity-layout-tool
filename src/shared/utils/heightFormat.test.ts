import { describe, it, expect } from 'vitest';
import { formatHeight } from './heightFormat';

describe('formatHeight', () => {
  it('formats standard gridfinity height units', () => {
    expect(formatHeight(3, 7)).toBe('3u (21mm)');
    expect(formatHeight(5, 7)).toBe('5u (35mm)');
    expect(formatHeight(12, 7)).toBe('12u (84mm)');
  });

  it('rounds mm to nearest integer', () => {
    expect(formatHeight(3, 7.5)).toBe('3u (23mm)');
    expect(formatHeight(1, 6.3)).toBe('1u (6mm)');
  });

  it('handles custom height unit sizes', () => {
    expect(formatHeight(4, 10)).toBe('4u (40mm)');
    expect(formatHeight(2, 1)).toBe('2u (2mm)');
  });

  it('handles zero height', () => {
    expect(formatHeight(0, 7)).toBe('0u (0mm)');
  });
});
