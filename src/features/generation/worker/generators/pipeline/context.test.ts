import { describe, it, expect } from 'vitest';
import { createInitialContext } from './context';
import type { BinParams } from '@/shared/types/bin';

function createTestParams(overrides?: Record<string, unknown>): BinParams {
  return {
    width: 2,
    depth: 2,
    height: 3,
    wallThickness: 1.2,
    style: 'standard',
    base: {
      style: 'plain',
      stackingLip: false,
      halfSockets: false,
      solid: false,
      magnetDiameter: 6,
      magnetDepth: 2,
      screwDiameter: 3,
    },
    compartments: {
      cols: 1,
      rows: 1,
      thickness: 1.2,
      cells: [0],
    },
    label: {
      enabled: false,
      depth: 12,
      width: 100,
      alignment: 'center',
      support: 'bracket',
    },
    scoop: { enabled: false, radius: 21 },
    inserts: [],
    cutoutConfig: {
      topOffset: 0,
      shape: 'roundedRect',
      cornerRadius: 3.75,
      enabled: false,
      widthPercent: 100,
      depthPercent: 100,
      isGrouped: false,
    },
    walls: {
      enabled: false,
      height: 50,
      cornerRadius: 2,
      sides: { front: true, back: true, left: true, right: true },
    },
    wallPattern: {
      enabled: false,
      pattern: 'honeycomb',
      size: 5,
      spacing: 1.5,
      sides: { front: true, back: true, left: true, right: true },
    },
    slotConfig: {
      width: 5,
      depth: 10,
      spacing: 10,
      sides: { front: false, back: false, left: false, right: false },
    },
    gridUnitMm: 42,
    heightUnitMm: 7,
    ...overrides,
  } as BinParams;
}

describe('createInitialContext', () => {
  it('derives correct dimensions for a plain 2x2x3 bin', () => {
    const ctx = createInitialContext(createTestParams());
    const dim = ctx.dimensions;

    expect(dim.outerW).toBeCloseTo(83.5); // 2*42 - 0.5
    expect(dim.outerD).toBeCloseTo(83.5);
    expect(dim.innerW).toBeCloseTo(81.1); // 83.5 - 2*1.2
    expect(dim.innerD).toBeCloseTo(81.1);
    expect(dim.totalHeight).toBe(21); // 3 * 7
    expect(dim.wallHeight).toBe(16); // 21 - 5 (SOCKET_HEIGHT)
    expect(dim.isFlat).toBe(false);
    expect(dim.solid).toBe(false);
    expect(dim.isSlotted).toBe(false);
    expect(dim.hasLip).toBe(false);
    expect(dim.withMagnet).toBe(false);
    expect(dim.withScrew).toBe(false);
  });

  it('derives flat floor dimensions', () => {
    const ctx = createInitialContext(
      createTestParams({
        base: {
          style: 'flat',
          stackingLip: false,
          halfSockets: false,
          solid: false,
          magnetDiameter: 6,
          magnetDepth: 2,
          screwDiameter: 3,
        },
      })
    );
    expect(ctx.dimensions.isFlat).toBe(true);
    expect(ctx.dimensions.wallHeight).toBe(21); // No socket deduction for flat
  });

  it('produces versioned shellKey with v2 prefix including gridUnitMm', () => {
    const ctx = createInitialContext(createTestParams());

    // shellKey uses buildCacheKey with v2 prefix, gridUnitMm, and quantized floats
    const expected = [
      'v2',
      2,
      2,
      42, // gridUnitMm
      false,
      false,
      false,
      false,
      6,
      2,
      3,
      true,
      16,
      1.2,
      false,
      false,
    ].join('|');

    expect(ctx.dimensions.shellKey).toBe(expected);
  });

  it('initializes context with empty targets and null solid/mesh', () => {
    const ctx = createInitialContext(createTestParams());
    expect(ctx.solid).toBeNull();
    expect(ctx.mesh).toBeNull();
    expect(ctx.fuseTargets).toEqual([]);
    expect(ctx.cutTargets).toEqual([]);
    expect(ctx.originToTag.size).toBe(0);
  });

  it('should use params.gridUnitMm instead of hardcoded 42mm', () => {
    const ctx = createInitialContext(createTestParams({ gridUnitMm: 50 }));
    const dim = ctx.dimensions;
    // outerW should be 2 * 50 - 0.5, not 2 * 42 - 0.5
    expect(dim.outerW).toBeCloseTo(99.5);
    expect(dim.outerD).toBeCloseTo(99.5);
    expect(dim.maxDimension).toBeCloseTo(100);
  });

  it('computes interiorHeight with lip deduction', () => {
    const ctx = createInitialContext(
      createTestParams({
        base: {
          style: 'plain',
          stackingLip: true,
          halfSockets: false,
          solid: false,
          magnetDiameter: 6,
          magnetDepth: 2,
          screwDiameter: 3,
        },
      })
    );
    expect(ctx.dimensions.hasLip).toBe(true);
    // interiorHeight = wallHeight - LIP_SMALL_TAPER (0.7)
    expect(ctx.dimensions.interiorHeight).toBeCloseTo(15.3);
  });
});
