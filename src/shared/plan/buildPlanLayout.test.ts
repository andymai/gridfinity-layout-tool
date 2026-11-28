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

  it('plans the drawer alone when there are no bins', () => {
    const result = plan({ drawer: { width: 52, depth: 44, height: 8, unit: 'cm' }, bins: [] });
    expect(result.half).toBe(false);
    expect(result.placed).toEqual([]);
    expect(result.stashed).toEqual([]);
    expect(result.layout.bins).toEqual([]);
    expect(result.layout.drawer).toMatchObject({
      width: 12,
      depth: 10,
      height: 11.42,
      measuredMm: { width: 520, depth: 440, height: 80 },
    });
    expect(result.layout.layers).toEqual([{ id: 'plan-layer-1', name: 'Layer 1', height: 3 }]);
    expect(result.layout.baseplateParams).toMatchObject({ paddingLeft: 8, paddingFront: 10 });
  });

  it('fits a half grid for halfGrid where it fits tighter, and whole units where not', () => {
    const tighter = plan({
      drawer: { width: 330, depth: 400, unit: 'mm' },
      halfGrid: true,
      bins: [],
    });
    expect(tighter.half).toBe(true);
    expect(tighter.layout.drawer).toMatchObject({ width: 7.5, depth: 9.5 });
    expect(tighter.layout.baseplateParams).toMatchObject({ paddingLeft: 7.5, paddingFront: 0.5 });

    const whole = plan({
      drawer: { width: 38, depth: 51, unit: 'cm' },
      halfGrid: true,
      bins: [{ label: 'M3', width: 1, depth: 1, height: 3, count: 3 }],
    });
    expect(whole.half).toBe(false);
    expect(whole.layout.drawer).toMatchObject({ width: 9, depth: 12 });
    expect(whole.placed.map((bin) => [bin.x, bin.y])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  it('builds an empty drawer that the app imports', () => {
    const imported = importLayoutJSON(
      JSON.stringify(
        plan({ drawer: { width: 15, depth: 21, unit: 'in' }, halfGrid: true, bins: [] }).layout
      )
    );
    expect(imported.errors).toEqual([]);
    expect(imported.layout?.drawer).toMatchObject({ width: 9, depth: 12.5 });
    expect(imported.layout?.bins).toEqual([]);
  });

  it('refuses a measured height outside what the app stores', () => {
    const built = buildPlanLayout(
      planInput.parse({
        drawer: { width: 40, depth: 30, height: 600, unit: 'cm' },
        bins: [{ label: 'M3', width: 1, depth: 1, height: 3 }],
      })
    );
    expect(isOk(built)).toBe(false);
  });

  it('builds a layout that the app imports as a shared layout', () => {
    const imported = importLayoutJSON(JSON.stringify(plan(screwDrawer).layout));
    expect(imported.errors).toEqual([]);
    expect(imported.layout?.bins).toHaveLength(8);
  });

  it('stays quick when many upper bins cannot be carried', () => {
    const started = performance.now();
    const result = plan({
      grid: { width: 50, depth: 50, height: 12 },
      bins: [
        { label: 'Base', width: 25, depth: 50, height: 3 },
        { label: 'Lid', width: 25.5, depth: 25.5, height: 2, layer: 2, count: 59 },
      ],
    });
    expect(result.stashed).toHaveLength(59);
    expect(result.stashed[0].reason).toBe('no-support');
    expect(performance.now() - started).toBeLessThan(5000);
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
