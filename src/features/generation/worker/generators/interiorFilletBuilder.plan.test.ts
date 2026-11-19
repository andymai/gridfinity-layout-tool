// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { deriveDimensions } from './pipeline/context';
import { planBinInteriorFillets, slottedCavity } from './interiorFilletBuilder';
import { slottedFilletRadiusMm } from '@/shared/utils/slottedFillet';
import { interiorFilletRadiusMm } from '@/shared/utils/interiorFillet';

describe('planBinInteriorFillets', () => {
  // The floor raise does not build on a custom footprint, so a raise the design
  // still carries from a rectangular grid must not lift its fillet off the floor.
  it('keeps a custom shape on the standard floor whatever raises it carries', () => {
    const params = buildParams({
      width: 2,
      depth: 2,
      height: 4,
      interiorFilletMm: 2.5,
      cellMask: { cols: 4, rows: 4, cells: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0] },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, floorRaises: [6] },
    });
    const dimensions = deriveDimensions(params, true);
    const plans = planBinInteriorFillets({ params, dimensions, radius: 2.5 });
    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) expect(plan.zFloor).toBeCloseTo(dimensions.floorThickness, 6);
  });
});

describe('a slotted bin plans the fillet the shared seat expects', () => {
  // The slot channel and the piece corners are cut for `slottedFilletRadiusMm`,
  // so the plan has to build exactly that radius, across sizes, heights,
  // layouts and every clamp along the way.
  const layouts = {
    single: { x: { enabled: true, pitch: 40 }, y: { enabled: false, pitch: 40 } },
    dense: { x: { enabled: true, pitch: 10 }, y: { enabled: true, pitch: 10 } },
    custom: {
      layout: 'custom' as const,
      customGrid: { cols: 4, rows: 2, cells: [0, 1, 1, 1, 0, 1, 1, 1] },
    },
  };
  for (const [name, slot] of Object.entries(layouts)) {
    for (const size of [
      { width: 1, depth: 1 },
      { width: 2, depth: 3 },
      { width: 1.5, depth: 1 },
    ]) {
      for (const height of [2, 6]) {
        for (const radius of [0.5, 2.5, 6, 15]) {
          for (const floorGroove of [true, false]) {
            for (const stackingLip of [true, false]) {
              const label = `${name} ${size.width}x${size.depth}x${height} r${radius} groove ${floorGroove} lip ${stackingLip}`;
              it(label, () => {
                const params = buildParams({
                  ...size,
                  height,
                  style: 'slotted',
                  interiorFilletMm: radius,
                  base: { ...DEFAULT_BIN_PARAMS.base, stackingLip },
                  slotConfig: { ...DEFAULT_BIN_PARAMS.slotConfig, ...slot },
                  dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, floorGroove },
                });
                const dimensions = deriveDimensions(params, true);
                const plans = planBinInteriorFillets({
                  params,
                  dimensions,
                  radius: interiorFilletRadiusMm(params),
                });
                const expected = slottedFilletRadiusMm(params, slottedCavity(dimensions));
                if (expected === 0) {
                  expect(plans).toHaveLength(0);
                } else {
                  expect(plans).toHaveLength(1);
                  expect(plans[0].radius).toBeCloseTo(expected, 9);
                }
              });
            }
          }
        }
      }
    }
  }
});
