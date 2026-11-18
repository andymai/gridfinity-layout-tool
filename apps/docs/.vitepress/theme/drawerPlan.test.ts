import { describe, expect, it } from 'vitest';
import { createDefaultLayout } from '@/core/constants';
import { isOk } from '@/core/result';
import { buildDrawerLinkLayout, parseDrawerLink } from '@/shared/utils/drawerLink';
import { drawerLink, planDrawer, toMm } from './drawerPlan';

function openedLayout(link: string) {
  const parsed = parseDrawerLink(new URL(link).search);
  if (parsed === null || !isOk(parsed)) throw new Error(`the app rejects ${link}`);
  const built = buildDrawerLinkLayout(createDefaultLayout(), parsed.value, 'fallback');
  if (!isOk(built)) throw new Error(`the app cannot build ${link}`);
  return built.value;
}

describe('planDrawer', () => {
  it('fits the grid that the drawer link opens', () => {
    for (const size of [
      { widthMm: 345, depthMm: 260, heightMm: 40 },
      { widthMm: 440, depthMm: 345, heightMm: 150 },
      { widthMm: 295, depthMm: 522 },
      { widthMm: 405, depthMm: 480, heightMm: 75 },
    ]) {
      const plan = planDrawer(size);
      const layout = openedLayout(drawerLink(size));
      expect(plan?.grid.width).toBe(layout.drawer.width);
      expect(plan?.grid.depth).toBe(layout.drawer.depth);
    }
  });

  it('gives the free space of each axis', () => {
    expect(planDrawer({ widthMm: 345, depthMm: 260 })?.grid).toEqual({
      width: 8,
      depth: 6,
      gridWidthMm: 336,
      gridDepthMm: 252,
      freeWidthMm: 9,
      freeDepthMm: 8,
    });
  });

  it('offers a half-unit grid only when it fits tighter', () => {
    expect(planDrawer({ widthMm: 405, depthMm: 480 })?.half).toEqual({
      width: 9.5,
      depth: 11,
      gridWidthMm: 399,
      gridDepthMm: 462,
      freeWidthMm: 6,
      freeDepthMm: 18,
    });
    expect(planDrawer({ widthMm: 345, depthMm: 260 })?.half).toBeNull();
  });

  it('matches the stack readout of the deep tool drawer recipe', () => {
    const stacks = planDrawer({ widthMm: 440, depthMm: 345, heightMm: 150 })?.stacks;
    expect(stacks?.map((s) => [s.count, s.units, Math.round(s.totalMm * 100) / 100])).toEqual([
      [1, 20, 144.4],
      [2, 10, 144.05],
      [3, 6, 129.7],
    ]);
  });

  it('skips the stacks without a height and any bin under the shortest the editor makes', () => {
    expect(planDrawer({ widthMm: 345, depthMm: 260 })?.stacks).toEqual([]);
    expect(planDrawer({ widthMm: 345, depthMm: 260, heightMm: 18 })?.stacks).toEqual([]);
    expect(planDrawer({ widthMm: 345, depthMm: 260, heightMm: 40 })?.stacks).toEqual([
      { count: 1, units: 5, totalMm: 39.4 },
      { count: 2, units: 2, totalMm: 32.05 },
    ]);
  });

  it('refuses a drawer outside 1 to 50 grid units', () => {
    expect(planDrawer({ widthMm: 41, depthMm: 260 })).toBeNull();
    expect(planDrawer({ widthMm: 345, depthMm: 2101 })).toBeNull();
    expect(planDrawer({ widthMm: Number.NaN, depthMm: 260 })).toBeNull();
  });
});

describe('drawerLink', () => {
  it('writes the format that parseDrawerLink reads, with the name', () => {
    const link = drawerLink({ widthMm: 345, depthMm: 260, heightMm: 40 }, { name: 'Screw drawer' });
    expect(link).toBe('https://gridfinitylayouttool.com/?drawer=345x260x40&name=Screw+drawer');
    const layout = openedLayout(link);
    expect(layout.name).toBe('Screw drawer');
    expect(layout.drawer.measuredMm).toEqual({ width: 345, depth: 260, height: 40 });
  });

  it('opens the baseplate generator and leaves out a missing height', () => {
    expect(drawerLink({ widthMm: 295, depthMm: 522 }, { tool: 'baseplate' })).toBe(
      'https://gridfinitylayouttool.com/baseplate?drawer=295x522'
    );
  });

  it('carries inches as millimeters to one decimal', () => {
    const size = { widthMm: toMm(15.5, 'in'), depthMm: toMm(21, 'in') };
    expect(drawerLink(size)).toBe('https://gridfinitylayouttool.com/?drawer=393.7x533.4');
    expect(openedLayout(drawerLink(size)).drawer.measuredMm).toEqual({
      width: 393.7,
      depth: 533.4,
    });
  });
});
