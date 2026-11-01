import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  DEFAULT_PULL_TAB,
  activePullTab,
  planPullTab,
  planPullTabs,
  resolvePullTab,
  resolvePullTabWalls,
  pullTabWallFields,
  pullTabWallInset,
  pullTabUnavailableReason,
} from './pullTabPlan';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';
import { binDimensions, cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import type { PullTabWall } from '@/shared/types/bin';

describe('pull tab planning and saved designs', () => {
  const p = { ...DEFAULT_BIN_PARAMS, pullTab: { ...DEFAULT_PULL_TAB, enabled: true } };
  it('keeps old designs unchanged and preserves customized tabs on load', () => {
    expect(activePullTab(DEFAULT_BIN_PARAMS)).toBeNull();
    expect(migrateParams(p).pullTab).toEqual(p.pullTab);
    const legacyTab = Object.fromEntries(
      Object.entries(p.pullTab).filter(
        ([key]) =>
          key !== 'recessBorder' &&
          key !== 'recessInsideRadius' &&
          key !== 'backRecess' &&
          key !== 'widthMode' &&
          key !== 'widthPercent'
      )
    );
    expect(resolvePullTab(legacyTab)).toEqual(p.pullTab);
  });
  it('keeps wall and tab at least as thick as the general wall', () => {
    const thin = { ...p, pullTab: { ...p.pullTab, thickness: 0.4 } };
    expect(planPullTab(thin, 35, 1.2)?.thickness).toBe(p.wallThickness);
    expect(pullTabWallInset(thin)).toEqual({ front: 0, back: 0, left: 0, right: 0 });
    expect(planPullTab({ ...thin, wallThickness: 0.4 }, 35, 0.4)?.recessDepth).toBe(0);
  });
  it('allows 2 mm fillets in a shallow recess without deepening the cut', () => {
    const plan = planPullTab(
      {
        ...p,
        pullTab: { ...p.pullTab, backRecess: true, recessEdgeRadius: 2, recessInsideRadius: 2 },
      },
      35,
      1.2
    );
    expect(plan?.recessEdgeRadius).toBe(2);
    expect(plan?.recessInsideRadius).toBe(2);
    expect(plan?.recessDepth).toBe(1);
    expect(plan?.recessHeight).toBe(7);
  });
  it('fits larger tab curves without increasing the tab height', () => {
    const plan = planPullTab(
      { ...p, pullTab: { ...p.pullTab, topRadius: 10, rootRadius: 10 } },
      35,
      1.2
    );
    expect(plan?.topRadius).toBe(10);
    expect(plan?.rootRadius).toBe(10);
    expect(plan?.height).toBe(12);
    expect(plan?.width).toBe(50);
  });
  it('scales percent width with the selected wall and preserves mm designs', () => {
    const percent = {
      ...p,
      pullTab: { ...p.pullTab, widthMode: 'percent' as const, widthPercent: 50 },
    };
    expect(planPullTab({ ...percent, width: 2 }, 35, 1.2)?.width).toBe(37);
    expect(planPullTab({ ...percent, width: 3 }, 35, 1.2)?.width).toBe(58);
    expect(
      planPullTab({ ...percent, depth: 3, pullTab: { ...percent.pullTab, wall: 'depth' } }, 35, 1.2)
        ?.width
    ).toBe(58);
    expect(planPullTab({ ...p, width: 3 }, 35, 1.2)?.width).toBe(50);
    expect(resolvePullTab({ width: 55 }).widthMode).toBe('mm');
  });
  it('limits two matching recesses to leave a 0.8 mm middle wall', () => {
    for (const thickness of [0.4, 1.6, 3, 4]) {
      const plan = planPullTab(
        {
          ...p,
          wallThickness: 0.4,
          pullTab: { ...p.pullTab, thickness, backRecess: true, recessDepth: 3.2 },
        },
        35,
        0.4
      );
      expect(plan).not.toBeNull();
      if (!plan) continue;
      expect(plan.thickness - 2 * plan.recessDepth).toBeGreaterThanOrEqual(
        Math.min(thickness, 0.8) - 1e-8
      );
      expect(plan.recessDepth).toBeCloseTo(Math.max(0, (thickness - 0.8) / 2));
    }
  });
  it('fits independent inside and outside fillets within the pocket', () => {
    for (const recessDepth of [0, 0.1, 1, 3.2]) {
      for (const recessHeight of [1, 7, 80]) {
        const plan = planPullTab(
          {
            ...p,
            pullTab: {
              ...p.pullTab,
              recessDepth,
              recessHeight,
              recessInsideRadius: 3.2,
              recessEdgeRadius: 1.5,
            },
          },
          35,
          1.2
        );
        expect(plan).not.toBeNull();
        if (!plan) continue;
        const combined = plan.recessEdgeRadius + plan.recessInsideRadius;
        expect(combined * (1 - Math.cos(plan.recessBlendAngle))).toBeLessThanOrEqual(
          plan.recessDepth + 1e-8
        );
        expect(plan.recessBlendWidth * 2).toBeLessThan(plan.recessHeight);
        expect(plan.recessBlendWidth * 2).toBeLessThan(plan.recessWidth);
        expect(plan.recessInsideRadius).toBeGreaterThanOrEqual(0);
      }
    }
    const sharp = planPullTab({ ...p, pullTab: { ...p.pullTab, recessInsideRadius: 0 } }, 35, 1.2);
    expect(sharp?.recessInsideRadius).toBe(0);
    expect(sharp?.recessEdgeRadius).toBe(0.4);
  });
  it('keeps the top and both straight side borders equal', () => {
    const plan = planPullTab(p, 35, 1.2);
    expect(plan).not.toBeNull();
    if (!plan) return;
    const topBorder = 35 + plan.height - plan.recessTop;
    const sideBorder =
      plan.width / 2 - plan.tabShoulderRun + plan.tabCornerRise - plan.recessWidth / 2;
    expect(sideBorder).toBeCloseTo(topBorder);
    expect(plan.recessRadius).toBeGreaterThanOrEqual(plan.topRadius - topBorder);
  });
  it('keeps matched borders and closed corners for narrow tabs and shallow recesses', () => {
    for (const width of [12, 50, 500]) {
      for (const height of [3, 12, 40]) {
        for (const recessHeight of [1, 7, 80]) {
          for (const recessBorder of [0.8, 1.2, 4, 20]) {
            const plan = planPullTab(
              {
                ...p,
                pullTab: {
                  ...p.pullTab,
                  width,
                  height,
                  recessHeight,
                  recessBorder,
                  topRadius: 20,
                  rootRadius: 20,
                },
              },
              35,
              1.2
            );
            expect(plan).not.toBeNull();
            if (!plan) continue;
            expect(plan.recessWidth).toBeGreaterThanOrEqual(2);
            expect(plan.recessHeight).toBeGreaterThan(0);
            expect(plan.recessBorder).toBeGreaterThanOrEqual(0.8);
            expect(
              plan.width / 2 - plan.tabShoulderRun + plan.tabCornerRise - plan.recessWidth / 2
            ).toBeCloseTo(plan.recessBorder);
            expect(35 + plan.height - plan.recessTop).toBeCloseTo(plan.recessBorder);
            expect(plan.recessRadius + plan.recessBorder + 1e-8).toBeGreaterThanOrEqual(
              plan.tabCornerRise
            );
          }
        }
      }
    }
  });
  it('clamps corrupt imported values and keeps a solid rear skin', () => {
    expect(resolvePullTab({ thickness: 99, height: Number.NaN, wall: 'unknown' })).toMatchObject({
      thickness: 4,
      height: 12,
      wall: 'width',
    });
    const plan = planPullTab(
      { ...p, pullTab: { ...p.pullTab, recessDepth: 3.2, recessHeight: 80 } },
      35,
      1.2
    );
    expect(plan?.recessDepth).toBeCloseTo(2.2);
    expect((plan?.recessTop ?? 0) - (plan?.recessHeight ?? 0)).toBeCloseTo(2);
  });
});

describe('pull tabs on more than one wall', () => {
  const p = { ...DEFAULT_BIN_PARAMS, pullTab: { ...DEFAULT_PULL_TAB, enabled: true } };
  const on = (...walls: PullTabWall[]) => ({
    ...p,
    pullTab: resolvePullTab({ ...p.pullTab, ...pullTabWallFields(walls) }),
  });

  it('reads a saved width or depth wall as the front or right wall it built on', () => {
    expect(resolvePullTabWalls({ wall: 'width' })).toEqual(['front']);
    expect(resolvePullTabWalls({ wall: 'depth' })).toEqual(['right']);
    for (const wall of ['width', 'depth'] as const) {
      const saved = { ...DEFAULT_PULL_TAB, enabled: true, wall };
      const loaded = migrateParams({ ...p, pullTab: saved }).pullTab;
      expect(JSON.stringify(loaded)).toBe(JSON.stringify(saved));
      expect(loaded).not.toHaveProperty('walls');
    }
  });

  it('writes the front or right alone the way designs saved before walls did', () => {
    expect(pullTabWallFields(['front'])).toEqual({ wall: 'width' });
    expect(pullTabWallFields(['right'])).toEqual({ wall: 'depth' });
    const visited = resolvePullTab({
      ...resolvePullTab({ ...p.pullTab, ...pullTabWallFields(['front', 'right']) }),
      ...pullTabWallFields(['front']),
      walls: undefined,
    });
    expect(JSON.stringify(visited)).toBe(JSON.stringify(resolvePullTab(p.pullTab)));
  });

  it('stores every other selection in one canonical order', () => {
    expect(pullTabWallFields(['back'])).toEqual({ wall: 'width', walls: ['back'] });
    expect(pullTabWallFields(['left'])).toEqual({ wall: 'depth', walls: ['left'] });
    expect(pullTabWallFields(['right', 'left', 'front'])).toEqual({
      wall: 'width',
      walls: ['front', 'left', 'right'],
    });
    expect(JSON.stringify(resolvePullTab({ ...p.pullTab, walls: ['right', 'back'] }))).toBe(
      JSON.stringify(resolvePullTab({ ...p.pullTab, walls: ['back', 'right'], wall: 'depth' }))
    );
  });

  it('ignores unknown and repeated walls, falling back to the saved wall', () => {
    const corrupt = { wall: 'depth', walls: ['left', 'left', 'roof'] } as unknown as Parameters<
      typeof resolvePullTabWalls
    >[0];
    expect(resolvePullTabWalls(corrupt)).toEqual(['left']);
    const empty = { wall: 'depth', walls: ['roof'] } as unknown as Parameters<
      typeof resolvePullTabWalls
    >[0];
    expect(resolvePullTabWalls(empty)).toEqual(['right']);
    expect(resolvePullTab({ ...p.pullTab, walls: 'front' })).not.toHaveProperty('walls');
  });

  it('plans one tab per wall, each sized from its own wall length', () => {
    const percent = {
      ...on('front', 'back', 'left', 'right'),
      width: 2,
      depth: 3,
    };
    const tabs = planPullTabs(
      { ...percent, pullTab: { ...percent.pullTab, widthMode: 'percent', widthPercent: 50 } },
      35,
      1.2
    );
    expect(tabs.map((tab) => [tab.side, tab.width])).toEqual([
      ['front', 37],
      ['back', 37],
      ['left', 58],
      ['right', 58],
    ]);
    expect(planPullTabs({ ...p, pullTab: { ...p.pullTab, enabled: false } }, 35, 1.2)).toEqual([]);
  });

  it('refuses tabs whose thickened walls would close the cavity', () => {
    const narrow = (...walls: PullTabWall[]) => ({
      ...on(...walls),
      width: 2,
      depth: 0.5,
      gridUnitMm: 16,
      wallThickness: 1.6,
      pullTab: resolvePullTab({ ...on(...walls).pullTab, thickness: 4 }),
    });
    expect(pullTabUnavailableReason(narrow('front'))).toBeUndefined();
    expect(pullTabUnavailableReason(narrow('front', 'back'))).toBe('binDesigner.pullTab.noRoom');
    expect(pullTabUnavailableReason(narrow('left', 'right'))).toBeUndefined();
  });

  it('skips the tab on a wall too short for one, keeping the others', () => {
    const narrow = { ...on('front', 'left'), width: 0.5 };
    expect(planPullTabs(narrow, 35, 1.2).map((tab) => tab.side)).toEqual(['left']);
  });

  it('thickens each chosen wall inward and centres the cavity between them', () => {
    const thick = (...walls: PullTabWall[]) => {
      const params = on(...walls);
      return {
        inset: pullTabWallInset(params),
        dims: binDimensions(params),
        ui: cutoutInterior(params),
      };
    };
    const plain = binDimensions({ ...p, pullTab: undefined });
    const extra = DEFAULT_PULL_TAB.thickness - p.wallThickness;
    const opposite = thick('front', 'back');
    expect(opposite.inset).toEqual({ front: extra, back: extra, left: 0, right: 0 });
    expect(opposite.dims.innerD).toBeCloseTo(plain.innerD - 2 * extra);
    expect(opposite.dims.innerW).toBeCloseTo(plain.innerW);
    expect(opposite.ui.offsetY).toBeCloseTo(0);
    const adjacent = thick('back', 'left');
    expect(adjacent.ui.offsetX).toBeCloseTo(extra / 2);
    expect(adjacent.ui.offsetY).toBeCloseTo(-extra / 2);
    const all = thick('front', 'back', 'left', 'right');
    expect(all.dims.innerW).toBeCloseTo(plain.innerW - 2 * extra);
    expect(all.dims.innerD).toBeCloseTo(plain.innerD - 2 * extra);
    expect([all.ui.offsetX, all.ui.offsetY]).toEqual([0, 0]);
    expect(activePullTab(on('back'))?.walls).toEqual(['back']);
  });
});
