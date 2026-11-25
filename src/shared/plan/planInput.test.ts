import { describe, expect, it } from 'vitest';
import { planInput } from './planInput';

const bin = { label: 'M3', width: 1, depth: 1, height: 3 };
const issues = (value: unknown): string[] => {
  const parsed = planInput.safeParse(value);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message);
};

describe('planInput', () => {
  it('takes a measured drawer or a grid, not both and not neither', () => {
    const drawer = { width: 40, depth: 30, unit: 'cm' };
    expect(issues({ drawer, bins: [bin] })).toEqual([]);
    expect(issues({ grid: { width: 8, depth: 6 }, bins: [bin] })).toEqual([]);
    expect(issues({ bins: [bin] })).toContain('Give either a measured drawer or a grid size.');
    expect(issues({ drawer, grid: { width: 8, depth: 6 }, bins: [bin] })).toContain(
      'Give either a measured drawer or a grid size.'
    );
  });

  it('caps the bins after counts', () => {
    expect(
      issues({
        grid: { width: 8, depth: 6 },
        bins: [
          { ...bin, count: 40 },
          { ...bin, count: 21 },
        ],
      })
    ).toEqual(['A plan holds at most 60 bins after counts; this one has 61.']);
  });

  it('takes whole or half units and the app label length', () => {
    expect(issues({ grid: { width: 8, depth: 6 }, bins: [{ ...bin, width: 1.5 }] })).toEqual([]);
    expect(issues({ grid: { width: 8, depth: 6 }, bins: [{ ...bin, width: 1.25 }] })).toContain(
      'Use whole or half grid units.'
    );
    expect(
      issues({ grid: { width: 8, depth: 6 }, bins: [{ ...bin, label: 'x'.repeat(25) }] })
    ).not.toEqual([]);
  });

  it('needs each named category in the list, case aside', () => {
    expect(
      issues({
        grid: { width: 8, depth: 6 },
        categories: ['Screws'],
        bins: [{ ...bin, category: 'screws' }],
      })
    ).toEqual([]);
    expect(issues({ grid: { width: 8, depth: 6 }, bins: [{ ...bin, category: 'Nuts' }] })).toEqual([
      'Bin "M3" names category "Nuts", which is not in categories.',
    ]);
  });

  it('checks a crafted layer number without counting up to it', () => {
    const started = performance.now();
    const found = issues({
      grid: { width: 8, depth: 6 },
      bins: [{ ...bin, layer: 1_000_000_000 }],
    });
    expect(performance.now() - started).toBeLessThan(500);
    expect(found.length).toBeLessThan(15);
  });

  it('fills layers from 1 up', () => {
    expect(issues({ grid: { width: 8, depth: 6 }, bins: [{ ...bin, layer: 2 }] })).toEqual([
      'Layers must be filled from 1 up; no bin is on layer 1.',
    ]);
  });
});
