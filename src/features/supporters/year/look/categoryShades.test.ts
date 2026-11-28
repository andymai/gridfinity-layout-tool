import { describe, expect, it } from 'vitest';
import { contrast, hexToOklch, hexToRgb } from './color';
import { SHADE_STEPS, assignShadeSteps, categoryShades, type GroupedRect } from './categoryShades';

/** The approved concept's four shades of #9ADCFF on #D81F2B. */
const CONCEPT = [
  { rim: '#84D5FF', floor: '#28A0D3', shade: '#0384B2' },
  { rim: '#A8E0FF', floor: '#5AACD5', shade: '#3C90B8' },
  { rim: '#C8EBFF', floor: '#68BAE3', shade: '#4A9DC6' },
  { rim: '#E7F6FF', floor: '#75C8F2', shade: '#58ABD4' },
];

function near(a: string, b: string, tolerance: number): boolean {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return x.every((value, i) => Math.abs(value - (y[i] ?? 0)) * 255 <= tolerance);
}

describe('categoryShades', () => {
  const shades = categoryShades('#9ADCFF', '#D81F2B');

  it('matches the concept within a few levels per channel', () => {
    shades.forEach((shade, step) => {
      const want = CONCEPT[step];
      if (!want) throw new Error('no concept step');
      expect(near(shade.rim, want.rim, 8)).toBe(true);
      expect(near(shade.floor, want.floor, 8)).toBe(true);
      expect(near(shade.shade, want.shade, 8)).toBe(true);
    });
  });

  it('keeps every rim at 3:1 or more on the card', () => {
    for (const shade of shades) expect(contrast(shade.rim, '#D81F2B')).toBeGreaterThanOrEqual(3);
  });

  it('keeps the hue and steps lightness evenly up to 0.965', () => {
    const hue = hexToOklch('#9ADCFF').h;
    const lightness = shades.map((shade) => hexToOklch(shade.rim).l);
    for (const shade of shades) expect(Math.abs(hexToOklch(shade.rim).h - hue)).toBeLessThan(3);
    expect(lightness.at(-1)).toBeCloseTo(0.965, 2);
    const gaps = lightness.slice(1).map((l, i) => l - (lightness[i] ?? 0));
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0] ?? 0, 2);
  });
});

describe('assignShadeSteps', () => {
  const rect = (x: number, y: number, w: number, d: number, group: string): GroupedRect => ({
    x,
    y,
    w,
    d,
    group,
  });

  it('puts two neighbouring groups two steps apart', () => {
    const steps = assignShadeSteps([rect(0, 0, 2, 2, 'a'), rect(2, 0, 2, 2, 'b')]);
    expect(Math.abs((steps.get('a') ?? 0) - (steps.get('b') ?? 0))).toBeGreaterThanOrEqual(2);
  });

  it('gives the group covering the most the first step', () => {
    const steps = assignShadeSteps([rect(0, 0, 1, 1, 'small'), rect(5, 5, 4, 4, 'big')]);
    expect(steps.get('big')).toBe(0);
  });

  it('cycles groups that never touch', () => {
    const rects = Array.from({ length: 6 }, (_, i) => rect(i * 3, 0, 1, 1, `g${i}`));
    const steps = assignShadeSteps(rects);
    const used = new Set(steps.values());
    expect(used.size).toBe(SHADE_STEPS);
  });

  it('treats a corner touch as apart and an edge touch as neighbours', () => {
    const corner = assignShadeSteps([rect(0, 0, 1, 1, 'a'), rect(1, 1, 1, 1, 'b')]);
    expect(corner.get('b')).toBe(1);
    const edge = assignShadeSteps([rect(0, 0, 1, 1, 'a'), rect(0, 1, 1, 1, 'b')]);
    expect(Math.abs((edge.get('a') ?? 0) - (edge.get('b') ?? 0))).toBeGreaterThanOrEqual(2);
  });
});
