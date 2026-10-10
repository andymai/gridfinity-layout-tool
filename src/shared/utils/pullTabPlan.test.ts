import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import {
  DEFAULT_PULL_TAB,
  activePullTab,
  planPullTab,
  resolvePullTab,
  pullTabWallInset,
} from './pullTabPlan';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';

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
    expect(pullTabWallInset(thin)).toEqual({ x: 0, y: 0 });
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
