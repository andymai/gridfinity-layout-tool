import { describe, it, expect } from 'vitest';
import { computeBaseplateLayout } from './supportersLayout';
import { fitLabelLines } from './labelText';

describe('computeBaseplateLayout', () => {
  it('places one socket per supporter', () => {
    expect(computeBaseplateLayout(32).positions).toHaveLength(32);
  });

  it('centers the grid on the origin', () => {
    const { positions } = computeBaseplateLayout(32);
    const meanX = positions.reduce((s, p) => s + p.x, 0) / positions.length;
    const meanZ = positions.reduce((s, p) => s + p.z, 0) / positions.length;
    expect(Math.abs(meanX)).toBeLessThan(1e-9);
    expect(Math.abs(meanZ)).toBeLessThan(1e-9);
  });

  it('produces a slightly-wide grid (columns >= rows)', () => {
    const { columns, rows } = computeBaseplateLayout(32);
    expect(columns).toBeGreaterThanOrEqual(rows);
  });

  it('handles a single supporter centered', () => {
    const layout = computeBaseplateLayout(1);
    expect(layout.columns).toBe(1);
    expect(layout.positions[0]).toMatchObject({ x: 0, z: 0 });
  });

  it('handles zero supporters', () => {
    const layout = computeBaseplateLayout(0);
    expect(layout.positions).toHaveLength(0);
    expect(layout.rows).toBe(0);
  });
});

describe('fitLabelLines', () => {
  it('keeps a short name on one line', () => {
    expect(fitLabelLines('Max')).toEqual(['Max']);
  });

  it('wraps a two-word name across lines', () => {
    expect(fitLabelLines('Diego Silva')).toEqual(['Diego', 'Silva']);
  });

  it('hard-breaks a single long word across lines', () => {
    const lines = fitLabelLines('PummeledLeftNut', 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('PummeledL');
  });

  it('truncates with an ellipsis when it overflows maxLines', () => {
    const lines = fitLabelLines('Supercalifragilistic', 9, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
  });

  it('returns nothing for an empty name', () => {
    expect(fitLabelLines('   ')).toEqual([]);
  });
});
