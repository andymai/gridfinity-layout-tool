import { describe, it, expect } from 'vitest';
import { evaluateNumberExpression } from './numberExpression';

describe('evaluateNumberExpression', () => {
  it.each([
    ['42', 42],
    ['42.5', 42.5],
    ['.5', 0.5],
    ['42.', 42],
    ['-4.2', -4.2],
    ['+3', 3],
    ['  42  ', 42],
  ])('parses plain number %s', (raw, expected) => {
    expect(evaluateNumberExpression(raw)).toBe(expected);
  });

  it.each([
    ['42/2', 21],
    ['1+2*3', 7],
    ['(1+2)*3', 9],
    ['-(1+2)', -3],
    ['10-4-3', 3],
    ['100/4/5', 5],
    ['2*(3+4)-1', 13],
  ])('evaluates %s with correct precedence', (raw, expected) => {
    expect(evaluateNumberExpression(raw)).toBe(expected);
  });

  it.each([
    ['42mm', 42],
    ['42 mm', 42],
    ['90°', 90],
    ['50%', 50],
    ['21mm*2', 42],
  ])('drops the unit suffix in %s', (raw, expected) => {
    expect(evaluateNumberExpression(raw)).toBe(expected);
  });

  it('reads a comma as a decimal separator', () => {
    expect(evaluateNumberExpression('1,5')).toBe(1.5);
  });

  it('parses scientific notation as a number, not a suffix', () => {
    expect(evaluateNumberExpression('1e3')).toBe(1000);
    expect(evaluateNumberExpression('1e307')).toBe(1e307);
    // Must overflow to Infinity so callers can reject it — swallowing the
    // exponent as a unit suffix would silently commit 1 instead.
    expect(evaluateNumberExpression('1e309')).toBe(Infinity);
  });

  it('lets division by zero surface as Infinity for the caller to reject', () => {
    expect(evaluateNumberExpression('10/0')).toBe(Infinity);
    expect(evaluateNumberExpression('1/(2-2)')).toBe(Infinity);
  });

  it.each([
    ['abc'],
    ['Infinity'],
    [''],
    ['   '],
    ['1+'],
    ['(1+2'],
    ['1 2'],
    ['.'],
    ['--'],
    ['mm42'],
  ])('returns NaN for invalid input %s', (raw) => {
    expect(evaluateNumberExpression(raw)).toBeNaN();
  });
});
