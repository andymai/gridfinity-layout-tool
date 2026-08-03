import { describe, expect, it } from 'vitest';
import {
  formatGrams,
  formatMillimetres,
  formatPrintDuration,
  roundSummaryMinutes,
} from './printFormat';

describe('formatPrintDuration', () => {
  it('splits into hours and minutes', () => {
    expect(formatPrintDuration(145)).toEqual({ hours: 2, minutes: 25 });
  });

  it('reports a whole hour with no minute remainder', () => {
    expect(formatPrintDuration(120)).toEqual({ hours: 2, minutes: 0 });
  });

  it('stays in minutes below an hour', () => {
    expect(formatPrintDuration(45)).toEqual({ hours: 0, minutes: 45 });
  });

  it('rounds a fractional minute', () => {
    expect(formatPrintDuration(90.6)).toEqual({ hours: 1, minutes: 31 });
  });

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('treats %s as zero', (value) => {
    expect(formatPrintDuration(value)).toEqual({ hours: 0, minutes: 0 });
  });
});

describe('roundSummaryMinutes', () => {
  it('rounds a sub-hour median to five minutes', () => {
    expect(roundSummaryMinutes(47)).toBe(45);
    expect(roundSummaryMinutes(48)).toBe(50);
  });

  it('rounds an hour-plus median to a quarter hour', () => {
    // Quoting a 127-minute median to the minute implies precision the sample
    // does not have.
    expect(roundSummaryMinutes(127)).toBe(120);
    expect(roundSummaryMinutes(133)).toBe(135);
  });

  it.each([1, 2, 4])('never rounds a real %s-minute print down to zero', (value) => {
    // printMinutes is validated at min 1, so "about 0m" would be reachable and
    // would read as missing data rather than a fast print.
    expect(roundSummaryMinutes(value)).toBe(5);
  });

  it.each([0, -1, Number.NaN])('treats %s as zero', (value) => {
    expect(roundSummaryMinutes(value)).toBe(0);
  });
});

describe('formatMillimetres', () => {
  it('drops trailing zeros', () => {
    expect(formatMillimetres(0.2)).toBe('0.2');
    expect(formatMillimetres(0.4)).toBe('0.4');
    expect(formatMillimetres(1.0)).toBe('1');
  });

  it('keeps two decimals of real precision', () => {
    expect(formatMillimetres(0.28)).toBe('0.28');
    expect(formatMillimetres(0.125)).toBe('0.13');
  });

  it('handles a non-finite value', () => {
    expect(formatMillimetres(Number.NaN)).toBe('0');
  });
});

describe('formatGrams', () => {
  it('rounds to whole grams', () => {
    expect(formatGrams(18.4)).toBe('18');
    expect(formatGrams(18.6)).toBe('19');
  });

  it.each([0, -3, Number.NaN])('treats %s as zero', (value) => {
    expect(formatGrams(value)).toBe('0');
  });
});
