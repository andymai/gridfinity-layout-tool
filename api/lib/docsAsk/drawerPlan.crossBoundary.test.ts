/**
 * Ask AI's drawer calculator is hand-copied from the docs calculator, since
 * api/ cannot import src/ at runtime. A grid, height or lip change in the app
 * without this file would make Ask AI quote a fit that the app does not make.
 */
import { describe, expect, it } from 'vitest';

import {
  GRID_MAX,
  GRID_MIN,
  GRID_MM,
  HEIGHT_UNIT_MM,
  LIP_PROTRUSION_MM,
  MEASURED_MM_MAX,
  MEASURED_MM_MIN,
  MIN_BIN_HEIGHT,
  PLATE_RISE_MM,
  STACK_JUNCTION_MM,
  drawerLink,
  planDrawer,
} from './drawerPlan.js';
import {
  drawerLink as clientDrawerLink,
  planDrawer as clientPlanDrawer,
} from '../../../apps/docs/.vitepress/theme/drawerPlan';
import { CONSTRAINTS } from '@/core/constants';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { baseplateFloorDepth } from '@/shared/printSettings/baseplateHeight';
import { GRIDFINITY_SPEC } from '@/shared/printSettings/gridfinityGeometry';
import {
  LIP_PROTRUSION_MM as CLIENT_LIP,
  STACK_JUNCTION_MM as CLIENT_JUNCTION,
} from '@/shared/utils/heightUnits';

describe('the Ask AI drawer calculator mirrors the app', () => {
  it('uses the same constants', () => {
    expect(GRID_MM).toBe(GRIDFINITY_SPEC.GRID_SIZE);
    expect(HEIGHT_UNIT_MM).toBe(GRIDFINITY_SPEC.HEIGHT_UNIT);
    expect(GRID_MIN).toBe(CONSTRAINTS.GRID_MIN);
    expect(GRID_MAX).toBe(CONSTRAINTS.GRID_MAX);
    expect(MIN_BIN_HEIGHT).toBe(CONSTRAINTS.MIN_BIN_HEIGHT);
    expect(MEASURED_MM_MIN).toBe(CONSTRAINTS.MEASURED_MM_MIN);
    expect(MEASURED_MM_MAX).toBe(CONSTRAINTS.MEASURED_MM_MAX);
    expect(LIP_PROTRUSION_MM).toBe(CLIENT_LIP);
    expect(STACK_JUNCTION_MM).toBe(CLIENT_JUNCTION);
    expect(PLATE_RISE_MM).toBe(baseplateFloorDepth(DEFAULT_BASEPLATE_PARAMS));
  });

  it('plans every drawer size the same way', () => {
    const lengths = [0, 41.9, 42, 62.9, 63, 83.9, 84, 100, 222.5, 345, 399.99, 2100, 2100.1];
    for (let mm = 30; mm <= 2200; mm += 13.7) lengths.push(Math.round(mm * 10) / 10);
    const heights = [undefined, 0.5, 1, 20, 34.3, 40, 75, 80, 150, 400, 5000, 5001];
    for (const widthMm of lengths) {
      for (const depthMm of [42, 260, 300.5, widthMm]) {
        for (const heightMm of heights) {
          const size =
            heightMm === undefined ? { widthMm, depthMm } : { widthMm, depthMm, heightMm };
          expect(planDrawer(size), JSON.stringify(size)).toEqual(clientPlanDrawer(size));
        }
      }
    }
  });

  it('builds the same drawer link', () => {
    for (const size of [
      { widthMm: 345, depthMm: 260, heightMm: 40 },
      { widthMm: 400.25, depthMm: 300 },
      { widthMm: 400, depthMm: 300, heightMm: 6000 },
    ]) {
      expect(drawerLink(size)).toBe(clientDrawerLink(size));
      expect(drawerLink(size, { name: 'Screw drawer' })).toBe(
        clientDrawerLink(size, { name: 'Screw drawer' })
      );
    }
  });
});
