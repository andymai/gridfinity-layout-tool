import { describe, it, expect } from 'vitest';
import { parseSvgLengthMm } from './svgLength';

describe('parseSvgLengthMm', () => {
  it('returns null for null/empty/unparseable input', () => {
    expect(parseSvgLengthMm(null)).toBeNull();
    expect(parseSvgLengthMm(undefined)).toBeNull();
    expect(parseSvgLengthMm('')).toBeNull();
    expect(parseSvgLengthMm('   ')).toBeNull();
    expect(parseSvgLengthMm('abc')).toBeNull();
  });

  it('returns null for non-positive values', () => {
    expect(parseSvgLengthMm('0mm')).toBeNull();
    expect(parseSvgLengthMm('-10mm')).toBeNull();
  });

  it('returns null for relative or unknown units', () => {
    expect(parseSvgLengthMm('50%')).toBeNull();
    expect(parseSvgLengthMm('1em')).toBeNull();
    expect(parseSvgLengthMm('3rem')).toBeNull();
  });

  it('returns null for unitless values (caller keeps user units)', () => {
    expect(parseSvgLengthMm('100')).toBeNull();
    expect(parseSvgLengthMm('100.5')).toBeNull();
  });

  it('returns null for px (CSS unit, not physical)', () => {
    expect(parseSvgLengthMm('100px')).toBeNull();
  });

  it('converts mm 1:1', () => {
    expect(parseSvgLengthMm('100mm')).toBe(100);
    expect(parseSvgLengthMm('50.5mm')).toBe(50.5);
  });

  it('converts cm to mm', () => {
    expect(parseSvgLengthMm('5cm')).toBe(50);
  });

  it('converts inches to mm', () => {
    expect(parseSvgLengthMm('2in')).toBeCloseTo(50.8, 5);
  });

  it('converts points to mm', () => {
    // 72pt = 1in = 25.4mm
    expect(parseSvgLengthMm('72pt')).toBeCloseTo(25.4, 5);
  });

  it('converts picas to mm', () => {
    // 1pc = 12pt = 1/6 in = 25.4/6 mm
    expect(parseSvgLengthMm('6pc')).toBeCloseTo(25.4, 5);
  });

  it('converts Q (quarter mm) to mm', () => {
    expect(parseSvgLengthMm('4Q')).toBe(1);
  });

  it('handles whitespace and case variations', () => {
    expect(parseSvgLengthMm('  100MM  ')).toBe(100);
    expect(parseSvgLengthMm('100 mm')).toBe(100);
    expect(parseSvgLengthMm('2IN')).toBeCloseTo(50.8, 5);
  });

  it('handles scientific notation', () => {
    expect(parseSvgLengthMm('1e2mm')).toBe(100);
  });

  it('accepts an explicit + sign (SVG/CSS number grammar)', () => {
    expect(parseSvgLengthMm('+100mm')).toBe(100);
    expect(parseSvgLengthMm('+2in')).toBeCloseTo(50.8, 5);
  });
});
