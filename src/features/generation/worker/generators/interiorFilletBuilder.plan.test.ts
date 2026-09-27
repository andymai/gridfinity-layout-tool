// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { deriveDimensions } from './pipeline/context';
import { planBinInteriorFillets } from './interiorFilletBuilder';

describe('planBinInteriorFillets', () => {
  // The floor raise does not build on a custom footprint, so a raise the design
  // still carries from a rectangular grid must not lift its fillet off the floor.
  it('keeps a custom shape on its own floor whatever raises it carries', () => {
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.5,
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, floorRaises: [6] },
    });
    const plans = planBinInteriorFillets({
      params,
      dimensions: deriveDimensions(params, true),
      radius: 2.5,
    });
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) expect(plan.zFloor).toBeCloseTo(params.wallThickness, 6);
  });
});
