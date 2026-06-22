import { describe, it, expect } from 'vitest';
import {
  getSlotFreeWalls,
  getPatternDescriptors,
  CUTOUT_BORDER_WIDTH,
  BOTTOM_SOLID_SKIRT,
  getExpandedCutoutDimensions,
} from './wallPatterns';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import type { BinParams } from '@/shared/types/bin';
import type { CellMask } from '@/shared/utils/cellMask';
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

describe('BOTTOM_SOLID_SKIRT', () => {
  it('matches the top keep-out / cutout border solid-margin unit (#2317)', () => {
    expect(BOTTOM_SOLID_SKIRT).toBe(1.5);
  });
});

describe('getPatternDescriptors — solid skirt above floor (#2317)', () => {
  it('anchors the lowest hex a full skirt above the interior floor', () => {
    const wallThickness = 1.0;
    const params = makeParams({
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      height: 5,
      wallThickness,
    });
    const innerW = 42 - 2 * wallThickness;
    const innerD = 42 - 2 * wallThickness;
    const wallHeight = 5 * 7;

    const result = getPatternDescriptors(params, innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    const { descriptors, calculator } = result!;
    const R = calculator.getShapeRadius();

    for (const d of descriptors) {
      // center.y is the in-plane vertical; +translateZ gives absolute bin Z.
      // Lowest vertex of a pointy-top hex sits R below its center. The floor
      // slab top is at z = wallThickness, so the solid skirt above the floor
      // is lowestVertexZ - wallThickness and must be the full BOTTOM_SOLID_SKIRT.
      const lowestVertexZ = Math.min(...d.centers.map((c) => c.y)) - R + d.translateZ;
      expect(lowestVertexZ - wallThickness).toBeGreaterThanOrEqual(BOTTOM_SOLID_SKIRT - 1e-6);
    }
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

describe('getPatternDescriptors — polygon (cellMask) bins', () => {
  // 3×3 L-shape at half-bin resolution (6×6 mask): bottom-right 1u cell empty.
  // Outer loop has 6 axis-aligned edges: 1 back, 1 left, 2 front (notch + long
  // arm), 2 right (long arm + notch).
  function buildMask(rows: (0 | 1)[][]): CellMask {
    const bottomFirst = rows.slice().reverse();
    const cols = bottomFirst[0]?.length ?? 0;
    return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
  }
  const L_SHAPE: CellMask = buildMask([
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0],
    [1, 1, 1, 1, 0, 0],
  ]);

  const innerW = 42 * 3 - 2 * 1.2; // 3u AABB inner
  const innerD = 42 * 3 - 2 * 1.2;
  const wallHeight = 5 * 7;

  const POLYGON_PARAMS = (extra: Partial<BinParams> = {}): BinParams =>
    makeParams({
      width: 3,
      depth: 3,
      height: 5,
      cellMask: L_SHAPE,
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      ...extra,
    });

  it('emits one descriptor per axis-aligned outer edge', () => {
    const result = getPatternDescriptors(POLYGON_PARAMS(), innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    // L-shape outer loop has 6 edges; each produces a descriptor provided the
    // wall span is wide enough for at least one pattern element.
    const { descriptors } = result!;
    expect(descriptors.length).toBeGreaterThanOrEqual(4);
    expect(descriptors.length).toBeLessThanOrEqual(6);
  });

  it('flags exactly one descriptor per cardinal as outermost (allowClip)', () => {
    const result = getPatternDescriptors(POLYGON_PARAMS(), innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    const { descriptors } = result!;
    // Group by side so we catch the case where a cardinal has descriptors
    // but *zero* allowClip (would mean cutout/handle clipping has no edge
    // to bind to on that side — a real bug, silent without this assert).
    const bySide = new Map<string, { total: number; clip: number }>();
    for (const d of descriptors) {
      const counts = bySide.get(d.side) ?? { total: 0, clip: 0 };
      counts.total += 1;
      if (d.allowClip) counts.clip += 1;
      bySide.set(d.side, counts);
    }
    expect(bySide.size).toBeGreaterThan(0);
    for (const { total, clip } of bySide.values()) {
      expect(total).toBeGreaterThan(0);
      expect(clip).toBe(1);
    }
  });

  it('each descriptor carries its own wallSpan (not a single-side lookup)', () => {
    const result = getPatternDescriptors(POLYGON_PARAMS(), innerW, innerD, wallHeight);
    expect(result).not.toBeNull();
    const { descriptors } = result!;
    // L-shape: front cardinal has two edges of different spans (long arm vs notch step).
    const frontSpans = descriptors
      .filter((d) => d.side === 'front')
      .map((d) => d.wallSpan)
      .sort((a, b) => a - b);
    if (frontSpans.length === 2) {
      expect(frontSpans[1]).toBeGreaterThan(frontSpans[0]);
    }
    // Every wallSpan must be positive.
    for (const d of descriptors) expect(d.wallSpan).toBeGreaterThan(0);
  });

  it('rect bins mark every descriptor as allowClip: true', () => {
    const rectParams = makeParams({
      wallPattern: { enabled: true, pattern: 'honeycomb' as const },
      height: 5,
    });
    const result = getPatternDescriptors(rectParams, 42 - 2 * 1.2, 42 - 2 * 1.2, wallHeight);
    expect(result).not.toBeNull();
    for (const d of result!.descriptors) {
      expect(d.allowClip).toBe(true);
    }
  });
});
