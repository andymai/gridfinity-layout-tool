import { describe, it, expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { PREVIEW_Z_OFFSET } from '../LidMesh/lidAnchorZ';
import { knifeRestGroupPosition } from './knifeRestPlacement';

const CHEF: KnifeSpec = {
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
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

function place(params: BinParams, offsetMm = 0): [number, number, number] {
  const plan = planKnifeRest(params);
  if (!plan) throw new Error('expected a rest plan for this fixture');
  return knifeRestGroupPosition(params, plan, offsetMm);
}

/** Half a footprint's printed body along one axis (mm). */
function halfBody(units: number, unitMm: number): number {
  return (units * unitMm - GRIDFINITY.TOLERANCE) / 2;
}

describe('knifeRestGroupPosition', () => {
  it('leaves exactly the planned gap between the block face and the rest face', () => {
    // The point of the placement: not the centre distance but the free drawer
    // space the user asked for, which is what they measure in the preview.
    const params = block();
    const [x, y] = place(params);
    const faceToFace = x - halfBody(6, 42) - halfBody(1, 42);
    expect(faceToFace).toBeCloseTo(21, 6);
    expect(y).toBe(0);
  });

  it('stands the rest on the same ground plane as the block', () => {
    // Both solids are built Z=0-bottom, so the rest takes the block's own
    // group nudge and nothing else — a seat plane derived here is how a
    // preview and an export come to disagree.
    expect(place(block())[2]).toBe(PREVIEW_Z_OFFSET);
    expect(place(block(), 40)[2]).toBe(PREVIEW_Z_OFFSET);
  });

  it('explodes further out along the exit axis, never back toward the block', () => {
    const params = block();
    const mated = place(params);
    const exploded = place(params, 30);
    expect(exploded[0] - mated[0]).toBeCloseTo(30, 6);
    expect(exploded[1]).toBe(0);
  });

  it('goes the other way when the knives exit the left wall', () => {
    const params = block({ cutouts: [knifeSlot({ knife: { ...CHEF, openEnd: 'start' } })] });
    const [x, y] = place(params);
    expect(x).toBeCloseTo(-(halfBody(6, 42) + 21 + halfBody(1, 42)), 6);
    expect(y).toBe(0);
    // Exploding a left-side rest has to move it further LEFT.
    expect(place(params, 30)[0]).toBeCloseTo(x - 30, 6);
  });

  it('steps along Y for a back exit, sized on the Y pitch', () => {
    // rotation 270 sends the slot's open end through the back wall.
    const params = block({
      width: 1,
      depth: 6,
      gridUnitMmY: 30,
      cutouts: [knifeSlot({ rotation: 270 })],
    });
    const [x, y] = place(params);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(halfBody(6, 30) + 21 + halfBody(1, 30), 6);
  });

  it('steps the other way along Y for a front exit', () => {
    const params = block({ width: 1, depth: 6, cutouts: [knifeSlot({ rotation: 90 })] });
    const [x, y] = place(params);
    expect(x).toBe(0);
    expect(y).toBeCloseTo(-(halfBody(6, 42) + 21 + halfBody(1, 42)), 6);
  });

  it('widens the step with a deeper rest footprint', () => {
    const oneU = place(block());
    const twoU = place(block({ knifeRest: { enabled: true, depthU: 2 } }));
    // Only the rest's own half grows, so the step grows by half a cell.
    expect(twoU[0] - oneU[0]).toBeCloseTo(21, 6);
  });

  it('honours a custom gap', () => {
    const [x] = place(block({ knifeRest: { enabled: true, gapMm: 60 } }));
    expect(x - halfBody(6, 42) - halfBody(1, 42)).toBeCloseTo(60, 6);
  });
});
