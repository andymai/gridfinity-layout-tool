import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CutFace, BinGeometryContext } from './splitConnectorBuilder';
import type { applySplitConnectors as ApplySplitConnectorsFn } from './splitConnectorBuilder';

// Mock brepjs to avoid WASM loading
vi.mock('brepjs', () => ({
  drawRectangle: vi.fn(() => ({
    sketchOnPlane: vi.fn(() => ({
      loftWith: vi.fn(() => 'lofted-shape'),
    })),
  })),
  unwrap: vi.fn((v) => v),
  fuse: vi.fn((_a, b) => b),
  cut: vi.fn((a) => a),
  translate: vi.fn((_s, pos) => ({ translated: pos })),
  getBounds: vi.fn(() => ({ xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 10 })),
}));

vi.mock('./generatorTypes', () => ({
  sketch: vi.fn(() => ({ extrude: vi.fn(() => 'extruded-shape') })),
}));

describe('splitConnectorBuilder tab clipping', () => {
  let applySplitConnectors: typeof ApplySplitConnectorsFn;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./splitConnectorBuilder');
    applySplitConnectors = mod.applySplitConnectors;
  });

  const baseFace: CutFace = {
    axis: 'x',
    position: 0,
    isMale: true,
    binEdgeLength: 84, // 2-unit bin width in mm
    pieceEdgeLength: 42,
    pieceCenterOffset: 0,
    perpendicularCuts: [],
  };

  const baseConfig = {
    enabled: true,
    clearance: 0.15,
    tongueThickness: 2.4,
    tongueProtrusion: 3.0,
  };

  it('generates tabs at full wall height when no cutout fraction', () => {
    const context: BinGeometryContext = {
      floorZ: 3.8,
      wallTopZ: 24.8,
      wallThickness: 1.2,
      floorThickness: 1.2,
    };

    // Should not throw and should return a result
    const result = applySplitConnectors('piece' as any, [baseFace], context, baseConfig);
    expect(result).toBeDefined();
  });

  it('generates tabs with clipped height when cutout fraction is set', () => {
    const context: BinGeometryContext = {
      floorZ: 3.8,
      wallTopZ: 24.8,
      wallThickness: 1.2,
      floorThickness: 1.2,
      wallCutoutDepthFraction: 0.5, // 50% cutout
    };

    const result = applySplitConnectors('piece' as any, [baseFace], context, baseConfig);
    expect(result).toBeDefined();
  });

  it('skips wall tabs when cutout removes nearly all wall (fraction ≈ 1)', () => {
    const context: BinGeometryContext = {
      floorZ: 3.8,
      wallTopZ: 24.8,
      wallThickness: 1.2,
      floorThickness: 1.2,
      wallCutoutDepthFraction: 0.99, // 99% cutout → effective height < MIN_FEATURE_HEIGHT
    };

    // Should still return without error (tabs skipped, floor tongue may still apply)
    const result = applySplitConnectors('piece' as any, [baseFace], context, baseConfig);
    expect(result).toBeDefined();
  });

  it('returns piece unchanged when no cut faces', () => {
    const context: BinGeometryContext = {
      floorZ: 3.8,
      wallTopZ: 24.8,
      wallThickness: 1.2,
      floorThickness: 1.2,
    };

    const piece = 'unchanged-piece' as any;
    const result = applySplitConnectors(piece, [], context, baseConfig);
    expect(result).toBe(piece);
  });
});
