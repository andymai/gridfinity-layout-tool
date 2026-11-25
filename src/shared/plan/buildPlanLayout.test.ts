import { describe, expect, it } from 'vitest';
import { STAGING_ID } from '@/core/constants';
import { isOk } from '@/core/result';
import { importLayoutJSON } from '@/core/storage/ShareService';
import { footprintsOverlap } from '@/shared/utils/collision';
import { buildPlanLayout } from './buildPlanLayout';
import type { PlanResult } from './buildPlanLayout';
import { planInput } from './planInput';

function plan(value: unknown): PlanResult {
  const built = buildPlanLayout(planInput.parse(value));
  if (!isOk(built)) throw new Error(JSON.stringify(built.error));
  return built.value;
}

const screwDrawer = {
  title: 'Screw drawer',
  drawer: { width: 40, depth: 30, height: 8, unit: 'cm' },
  categories: ['Screws', 'Tools'],
  bins: [
    { label: 'M3', width: 1, depth: 1, height: 3, category: 'Screws', count: 6 },
    {
      label: 'Hex keys',
      width: 3,
      depth: 1,
      height: 3,
      category: 'Tools',
      items: ['2 mm', '2.5 mm'],
    },
    { label: 'Drill bits', width: 2, depth: 2, height: 6, category: 'Tools' },
  ],
};

describe('buildPlanLayout', () => {
  it('fits the grid to the drawer and places every bin without overlap', () => {
    const result = plan(screwDrawer);
    const { layout } = result;
    expect(layout.drawer).toMatchObject({
      width: 9,
      depth: 7,
      measuredMm: { width: 400, depth: 300, height: 80 },
    });
    expect(result.placed).toHaveLength(8);
    expect(result.stashed).toEqual([]);
    const onGrid = layout.bins.filter((bin) => bin.layerId !== STAGING_ID);
    for (const [i, a] of onGrid.entries()) {
      for (const b of onGrid.slice(i + 1)) expect(footprintsOverlap(a, b)).toBe(false);
    }
    expect(
      layout.bins.find((bin) => bin.label === 'Hex keys')?.items?.map((item) => item.name)
    ).toEqual(['2 mm', '2.5 mm']);
  });

  it('places the largest bins first, in a fixed order', () => {
    const result = plan(screwDrawer);
    expect(result.placed[0]).toMatchObject({ label: 'Drill bits', x: 0, y: 0 });
    expect(JSON.stringify(plan(screwDrawer))).toBe(JSON.stringify(result));
  });

  it('stashes what does not fit, with the reason', () => {
    const result = plan({
      grid: { width: 2, depth: 2, height: 6 },
      bins: [
        { label: 'Big', width: 2, depth: 2, height: 3 },
        { label: 'Extra', width: 1, depth: 1, height: 3 },
        { label: 'Tall', width: 1, depth: 1, height: 9 },
      ],
    });
    expect(result.placed.map((bin) => bin.label)).toEqual(['Big']);
    expect(result.stashed).toEqual([
      { label: 'Extra', layer: 1, reason: 'no-room' },
      { label: 'Tall', layer: 1, reason: 'too-tall' },
    ]);
    expect(result.layout.bins.filter((bin) => bin.layerId === STAGING_ID)).toHaveLength(2);
  });

  it('puts a layer-2 bin only where bins below carry it', () => {
    const carried = plan({
      grid: { width: 4, depth: 2, height: 12 },
      bins: [
        { label: 'Base', width: 2, depth: 2, height: 3 },
        { label: 'Tray', width: 2, depth: 2, height: 2, layer: 2 },
      ],
    });
    expect(carried.placed.find((bin) => bin.label === 'Tray')).toMatchObject({
      layer: 2,
      x: 0,
      y: 0,
    });

    const floating = plan({
      grid: { width: 4, depth: 2, height: 12 },
      bins: [
        { label: 'Base', width: 1, depth: 1, height: 3 },
        { label: 'Tray', width: 2, depth: 2, height: 2, layer: 2 },
      ],
    });
    expect(floating.stashed).toEqual([{ label: 'Tray', layer: 2, reason: 'no-support' }]);
  });

  it('uses a half grid, with padding from the half-unit slack, when a bin asks for one', () => {
    const result = plan({
      drawer: { width: 400, depth: 300, unit: 'mm' },
      bins: [{ label: 'Half', width: 1.5, depth: 1, height: 3 }],
    });
    expect(result.half).toBe(true);
    expect(result.layout.drawer.width).toBe(9.5);
    expect(result.layout.baseplateParams?.paddingLeft).toBe(0.5);
  });

  it('builds a layout that the app imports as a shared layout', () => {
    const imported = importLayoutJSON(JSON.stringify(plan(screwDrawer).layout));
    expect(imported.errors).toEqual([]);
    expect(imported.layout?.bins).toHaveLength(8);
  });

  it('plans 60 bins on a large drawer quickly', () => {
    const started = performance.now();
    const result = plan({
      grid: { width: 20, depth: 20, height: 12 },
      bins: [
        { label: 'Small', width: 1, depth: 1, height: 3, count: 40 },
        { label: 'Long', width: 4, depth: 1, height: 3, count: 20 },
      ],
    });
    expect(result.placed).toHaveLength(60);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
