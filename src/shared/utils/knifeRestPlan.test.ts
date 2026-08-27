import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout, KnifeSpec } from '@/features/bin-designer/types';
import {
  KNIFE_REST_DEFAULT_GAP_MM,
  KNIFE_REST_GROOVE_DEPTH_MM,
  KNIFE_REST_GROOVE_EXTRA_WIDTH_MM,
  KNIFE_REST_HANDLE_DROP_MM,
} from '@/features/bin-designer/types';
import {
  planKnifeRest,
  shouldGenerateKnifeRest,
  knifeRestGrooveRadius,
  KNIFE_REST_MIN_HEIGHT_UNITS,
} from './knifeRestPlan';

const CHEF: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
  openEnd: 'end',
};

const PARING: KnifeSpec = {
  bladeLengthMm: 90,
  heelHeightMm: 20,
  spineThicknessMm: 1.8,
  handleWidthMm: 19,
  handleHeightMm: 19,
  openEnd: 'end',
};

function knifeSlot(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'k1',
    shape: 'knifeSlot',
    x: 20,
    y: 16,
    width: 215,
    depth: 3.8,
    cutDepth: 51,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    knife: CHEF,
    ...overrides,
  };
}

function block(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 6,
    depth: 1,
    height: 8,
    base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    cutouts: [knifeSlot()],
    knifeRest: { enabled: true },
    ...overrides,
  };
}

describe('planKnifeRest', () => {
  it('derives the chef companion: saddle from the handle, top snapped to a unit', () => {
    const plan = planKnifeRest(block());
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.style).toBe('companion');
    expect(plan.side).toBe('right');
    expect(plan.crossU).toBe(1);
    expect(plan.alongU).toBe(1);
    // Block fill top 56; saddle 56 - 23 - drop = 32; ideal top 38 → 6 units (42).
    const saddle = 56 - CHEF.handleHeightMm - KNIFE_REST_HANDLE_DROP_MM;
    expect(plan.heightUnits).toBe(6);
    expect(plan.bodyTopZMm).toBe(42);
    expect(plan.grooves).toHaveLength(1);
    expect(plan.grooves[0].widthMm).toBe(CHEF.handleWidthMm + KNIFE_REST_GROOVE_EXTRA_WIDTH_MM);
    expect(plan.grooves[0].depthMm).toBeCloseTo(plan.bodyTopZMm - saddle, 5);
    expect(plan.gapMm).toBe(KNIFE_REST_DEFAULT_GAP_MM);
  });

  it('integrated rest lands on the exact derived height, no unit snap', () => {
    const plan = planKnifeRest(block({ knifeRest: { enabled: true, style: 'integrated' } }));
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.style).toBe('integrated');
    expect(plan.bodyTopZMm).toBeCloseTo(
      56 - CHEF.handleHeightMm - KNIFE_REST_HANDLE_DROP_MM + KNIFE_REST_GROOVE_DEPTH_MM,
      5
    );
  });

  it('a mixed set cuts every groove down to its own saddle', () => {
    const plan = planKnifeRest(
      block({
        cutouts: [
          knifeSlot(),
          knifeSlot({ id: 'k2', y: 25, width: 100, depth: 3.3, cutDepth: 24, knife: PARING }),
        ],
      })
    );
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.grooves).toHaveLength(2);
    // Chef's larger handle sits lower, so its groove cuts deeper.
    const [chefGroove, paringGroove] = plan.grooves;
    expect(chefGroove.depthMm).toBeGreaterThan(paringGroove.depthMm);
    expect(chefGroove.depthMm - paringGroove.depthMm).toBeCloseTo(
      CHEF.handleHeightMm - PARING.handleHeightMm,
      5
    );
  });

  it('enforces the minimum body height', () => {
    // A very short block: saddle clamps near the socket, top still ≥ 2 units.
    const plan = planKnifeRest(
      block({ height: 3, cutouts: [knifeSlot({ cutDepth: 16, knife: PARING })] })
    );
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.heightUnits).toBeGreaterThanOrEqual(KNIFE_REST_MIN_HEIGHT_UNITS);
  });

  it('returns null when disabled, non-solid, or without open slots', () => {
    expect(planKnifeRest(block({ knifeRest: undefined }))).toBeNull();
    expect(planKnifeRest(block({ knifeRest: { enabled: false } }))).toBeNull();
    expect(planKnifeRest(block({ base: DEFAULT_BIN_PARAMS.base }))).toBeNull();
    expect(
      planKnifeRest(block({ cutouts: [knifeSlot({ knife: { ...CHEF, openEnd: undefined } })] }))
    ).toBeNull();
  });

  it('shouldGenerateKnifeRest is companion-only', () => {
    expect(shouldGenerateKnifeRest(block())).toBe(true);
    expect(
      shouldGenerateKnifeRest(block({ knifeRest: { enabled: true, style: 'integrated' } }))
    ).toBe(false);
  });
});

describe('knifeRestGrooveRadius', () => {
  it('passes through the shoulders and the saddle point', () => {
    const w = 29;
    const d = 6;
    const r = knifeRestGrooveRadius(w, d);
    // Circle centred d - r below the top: shoulder at (w/2, 0) is r away.
    expect(Math.hypot(w / 2, r - d)).toBeCloseTo(r, 9);
  });
});
