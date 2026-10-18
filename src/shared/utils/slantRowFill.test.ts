import { describe, expect, it } from 'vitest';
import { createTestLayout } from '@/test/testUtils';
import { gridUnits } from '@/core/types';
import type { Rect, SlantConfig } from '@/core/types';
import { planSlantedRows } from './slantRowFill';

const layout = createTestLayout();
const area = (x: number, y: number, width: number, depth: number): Rect => ({
  x: gridUnits(x),
  y: gridUnits(y),
  width: gridUnits(width),
  depth: gridUnits(depth),
});
const slant = (side: SlantConfig['side']): SlantConfig => ({ angleDeg: 45, side });
const size = { width: 2, depth: 1 };

describe('planSlantedRows', () => {
  it('fills a row along the lean and keeps the cells past it for the support', () => {
    const rows = planSlantedRows(area(1, 0, 2, 5), size, 6, slant('back'), layout);
    expect(rows).toHaveLength(1);
    expect(rows[0].bins.map((b) => b.y)).toEqual([0, 1, 2, 3]);
    expect(rows[0].support).toEqual(area(1, 4, 2, 1));
  });

  it('starts at the trailing end of a row leaning toward the front', () => {
    const rows = planSlantedRows(area(1, 0, 2, 5), size, 6, slant('front'), layout);
    expect(rows[0].bins.map((b) => b.y)).toEqual([4, 3, 2, 1]);
    expect(rows[0].support).toEqual(area(1, 0, 2, 1));
  });

  it('lays rows side by side across the lean', () => {
    const rows = planSlantedRows(area(0, 0, 5, 4), size, 6, slant('back'), layout);
    expect(rows.map((row) => row.bins[0].x)).toEqual([0, 2]);
    expect(rows.every((row) => row.bins.length === 3)).toBe(true);
  });

  it('leans along X with the bins turned the way they were painted', () => {
    const rows = planSlantedRows(area(0, 0, 7, 1), size, 6, slant('right'), layout);
    expect(rows[0].bins.map((b) => b.x)).toEqual([0, 2, 4]);
    expect(rows[0].support).toEqual(area(6, 0, 1, 1));
  });

  it('gives a taller row a longer support, and plans nothing that cannot hold one', () => {
    const tall = planSlantedRows(area(1, 0, 2, 5), size, 12, slant('back'), layout);
    expect(tall[0].bins).toHaveLength(3);
    expect(tall[0].support.depth).toBe(2);
    expect(planSlantedRows(area(1, 0, 2, 1), size, 6, slant('back'), layout)).toEqual([]);
  });

  it('caps each row for a single placed bin', () => {
    const rows = planSlantedRows(area(1, 0, 2, 8), size, 6, slant('back'), layout, 1);
    expect(rows[0].bins).toHaveLength(1);
    expect(rows[0].support).toEqual(area(1, 1, 2, 1));
  });
});
