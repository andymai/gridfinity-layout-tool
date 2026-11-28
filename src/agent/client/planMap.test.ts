import { describe, expect, it } from 'vitest';
import type { PlanView } from '@/agent/contract';
import {
  CELL,
  fitLabel,
  labelColor,
  planCaption,
  planDescription,
  planMapView,
  planOpenLabel,
} from './planMap';

const plan = (width: number, depth: number): PlanView => ({
  handle: '0a1b2c3d',
  title: 'Tools',
  grid: { width, depth },
  bins: [
    { label: 'Tray', x: 0, y: 0, width: 1, depth: 1, layer: 2, color: '#fbbf24' },
    { label: 'M3 screws', x: 0, y: 0, width: 1, depth: 1, layer: 1, color: '#334155' },
  ],
  stashed: [{ label: 'Case', reason: 'no room left on its layer' }],
  link: 'https://gridfinitylayouttool.com/#plan=v1.abc',
});

describe('the plan map', () => {
  it('draws a line on each whole unit, counted from the front-left corner', () => {
    const map = planMapView(plan(2.5, 2.5));
    expect(map.columns).toEqual([CELL, 2 * CELL]);
    expect(map.rows).toEqual([1.5 * CELL, 0.5 * CELL]);
    expect(planMapView(plan(3, 2)).columns).toEqual([CELL, 2 * CELL]);
  });

  it('puts a bin at the front on the bottom row, and upper layers last', () => {
    const map = planMapView(plan(2, 2));
    expect(map.bins.map((bin) => [bin.key, bin.upper, bin.y])).toEqual([
      [1, false, CELL],
      [0, true, CELL],
    ]);
    expect(map.bins[0]?.text).toBe('M3');
  });

  it('picks the label color with the higher contrast on each fill', () => {
    expect(labelColor('#334155')).toBe('#ffffff');
    expect(labelColor('#fbbf24')).toBe('#1b1b1f');
    expect(labelColor('#94a3b8')).toBe('#1b1b1f');
    expect(labelColor('red')).toBe('#1b1b1f');
  });

  it('keeps the first word of a label that does not fit', () => {
    expect(fitLabel('M3 screws', 3)).toBe('M3');
    expect(fitLabel('Measuring', 4)).toBe('Mea…');
    expect(fitLabel('Long', 1)).toBe('');
  });

  it('describes each bin and the stash for a screen reader', () => {
    expect(planDescription(plan(2, 2))).toEqual([
      'Tray: 1 × 1 units, 0 across and 0 back from the front-left corner, on layer 2.',
      'M3 screws: 1 × 1 units, 0 across and 0 back from the front-left corner.',
      'Case: in the stash, no room left on its layer.',
    ]);
  });

  it('names the grid, the bins and the stash', () => {
    expect(planCaption(plan(2, 2))).toBe('2 × 2 units · 2 bins · 1 in the stash');
    expect(planOpenLabel(plan(2, 2))).toBe('Open in the layout editor');
  });

  it('shows a drawer without bins as the empty drawer, to open as it is', () => {
    const drawer: PlanView = { ...plan(12, 10.5), bins: [], stashed: [] };
    expect(planCaption(drawer)).toBe('12 × 10.5 units · empty drawer');
    expect(planOpenLabel(drawer)).toBe('Open this drawer');
    expect(planMapView(drawer).bins).toEqual([]);
    expect(planDescription(drawer)).toEqual([]);
  });
});
