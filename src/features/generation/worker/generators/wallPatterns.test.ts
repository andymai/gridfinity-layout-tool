import { describe, it, expect } from 'vitest';
import {
  getSlotFreeWalls,
  getPatternDescriptors,
  CUTOUT_BORDER_WIDTH,
  getExpandedCutoutDimensions,
} from './wallPatterns';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import type { BinParams } from '@/shared/types/bin';
import { DISABLED_WALL_CUTOUT } from '@/shared/constants/bin';

/** Minimal BinParams stub for testing wallPatterns functions. */
const BASE_PARAMS: BinParams = {
  width: 1,
  depth: 1,
  height: 3,
  gridUnitMm: 42,
  heightUnitMm: 7,
  wallThickness: 1.2,
  style: 'standard',
  slotConfig: {
    x: { enabled: false, pitch: 20 },
    y: { enabled: false, pitch: 20 },
  },
  base: { magnetHoles: false, screwHoles: false },
  lip: true,
  label: { enabled: false, width: 12, angle: 45, overhangAngle: 60 },
  compartments: { enabled: false, rows: 1, cols: 1, thickness: 1.2, cells: [true] },
  inserts: [],
  wallPattern: { enabled: false, pattern: 'honeycomb' as const },
  exportFileName: { template: 'gridfinity_{w}x{d}x{h}', separator: '_' },
} as BinParams;

function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return { ...BASE_PARAMS, ...overrides };
}

const DEFAULT_SLOT_CONFIG = BASE_PARAMS.slotConfig;

describe('getSlotFreeWalls', () => {
  it('returns all walls free for non-slotted bin', () => {
    const result = getSlotFreeWalls(makeParams({ style: 'standard' }));
    expect(result).toEqual({ front: true, back: true, left: true, right: true });
  });

  it('blocks left/right when x-axis slots enabled', () => {
    const result = getSlotFreeWalls(
      makeParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_SLOT_CONFIG,
          x: { enabled: true, pitch: 20 },
          y: { enabled: false, pitch: 20 },
        },
      })
    );
    expect(result).toEqual({ front: true, back: true, left: false, right: false });
  });

  it('blocks front/back when y-axis slots enabled', () => {
    const result = getSlotFreeWalls(
      makeParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_SLOT_CONFIG,
          x: { enabled: false, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      })
    );
    expect(result).toEqual({ front: false, back: false, left: true, right: true });
  });

  it('blocks all walls when both axes have slots', () => {
    const result = getSlotFreeWalls(
      makeParams({
        style: 'slotted',
        slotConfig: {
          ...DEFAULT_SLOT_CONFIG,
          x: { enabled: true, pitch: 20 },
          y: { enabled: true, pitch: 20 },
        },
      })
    );
    expect(result).toEqual({ front: false, back: false, left: false, right: false });
  });
});

describe('CUTOUT_BORDER_WIDTH', () => {
  it('is 1.5mm', () => {
    expect(CUTOUT_BORDER_WIDTH).toBe(1.5);
  });
});

describe('getPatternDescriptors — side field', () => {
  const PATTERN_PARAMS = makeParams({
    wallPattern: { enabled: true, pattern: 'honeycomb' as const },
    height: 5,
  });

  // innerW/innerD for a 1×1 bin at 42mm grid: ~39.6mm (42 - 2*1.2 wallThickness)
  const innerW = 42 - 2 * 1.2;
  const innerD = 42 - 2 * 1.2;
  const wallHeight = 5 * 7; // 35mm

  it('includes side field on each descriptor', () => {
    const result = getPatternDescriptors(PATTERN_PARAMS, innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    const { descriptors } = result!;
    expect(descriptors.length).toBeGreaterThan(0);
    for (const d of descriptors) {
      expect(d.side).toBeDefined();
      expect(['front', 'back', 'left', 'right']).toContain(d.side);
    }
  });

  it('returns all four sides for a standard bin', () => {
    const result = getPatternDescriptors(PATTERN_PARAMS, innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    const sides = result!.descriptors.map((d) => d.side);
    expect(sides).toEqual(['front', 'back', 'left', 'right']);
  });

  it('omits slotted sides', () => {
    const params = makeParams({
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      height: 5,
      style: 'slotted',
      slotConfig: {
        x: { enabled: true, pitch: 20 },
        y: { enabled: false, pitch: 20 },
      },
    });
    const result = getPatternDescriptors(params, innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    const sides = result!.descriptors.map((d) => d.side);
    expect(sides).toEqual(['front', 'back']);
  });
});

describe('getExpandedCutoutDimensions', () => {
  it('expands width by 2× border and height by 1× border', () => {
    const result = getExpandedCutoutDimensions(30, 20, CUTOUT_BORDER_WIDTH);
    expect(result).toEqual({
      expandedWidth: 30 + 2 * CUTOUT_BORDER_WIDTH,
      expandedHeight: 20 + CUTOUT_BORDER_WIDTH,
    });
  });

  it('expanded width exceeds wall span for near-full-width cutouts', () => {
    // cutWidth = 40, wallSpan = 42 → expanded = 40 + 3 = 43 >= 42
    const { expandedWidth } = getExpandedCutoutDimensions(40, 20, CUTOUT_BORDER_WIDTH);
    expect(expandedWidth).toBeGreaterThanOrEqual(42);
  });

  it('expanded width stays within wall span for narrow cutouts', () => {
    const { expandedWidth } = getExpandedCutoutDimensions(20, 15, CUTOUT_BORDER_WIDTH);
    expect(expandedWidth).toBeLessThan(42);
  });
});

describe('clip solid position correctness', () => {
  it('clip solid must use original cutWidth for center computation, not expanded', () => {
    const wallSpan = 84;
    const cutWidth = 40;
    const wallThickness = 1.2;

    const originalCenter = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'left', 0);
    const { expandedWidth } = getExpandedCutoutDimensions(cutWidth, 20, CUTOUT_BORDER_WIDTH);
    const expandedCenter = computeCutoutCenter(wallSpan, expandedWidth, wallThickness, 'left', 0);

    // Using expandedWidth shifts the anchor for left/right alignment — the clip
    // solid must use the original cutWidth so the border is symmetric around the cutout.
    expect(expandedCenter).not.toBe(originalCenter);
  });

  it('center alignment is unaffected by width (anchor = 0)', () => {
    const wallSpan = 84;
    const cutWidth = 40;
    const wallThickness = 1.2;

    const originalCenter = computeCutoutCenter(wallSpan, cutWidth, wallThickness, 'center', 0);
    const { expandedWidth } = getExpandedCutoutDimensions(cutWidth, 20, CUTOUT_BORDER_WIDTH);
    const expandedCenter = computeCutoutCenter(wallSpan, expandedWidth, wallThickness, 'center', 0);

    expect(originalCenter).toBe(0);
    expect(expandedCenter).toBe(0);
  });
});

describe('getPatternDescriptors — cutout-aware walls', () => {
  const innerW = 42 * 2 - 2 * 1.2; // 2×2 bin
  const innerD = 42 * 2 - 2 * 1.2;
  const wallHeight = 5 * 7;

  it('returns descriptors with cutout info when walls have cutouts', () => {
    const params = makeParams({
      width: 2,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      walls: {
        enabled: true,
        shape: 'u-shape' as const,
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 70, depth: 50 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    });
    const result = getPatternDescriptors(params, innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    // All four walls should still have pattern descriptors
    // (clipping happens in featuresStage, not here)
    const sides = result!.descriptors.map((d) => d.side);
    expect(sides).toContain('front');
  });
});
