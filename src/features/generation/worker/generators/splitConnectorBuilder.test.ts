import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CutFace, BinGeometryContext } from './splitConnectorBuilder';
import type { applySplitConnectors as ApplySplitConnectorsFn } from './splitConnectorBuilder';

// Mock brepjs to avoid WASM loading.
// All mock shapes have a delete() stub so disposal calls in production code
// (added to plug WASM handle leaks) succeed in unit tests.
const mockShape = (extra?: object) => ({ delete: vi.fn(), ...extra });
vi.mock('brepjs', () => ({
  drawRectangle: vi.fn(() => ({
    sketchOnPlane: vi.fn(() => ({
      loftWith: vi.fn(() => mockShape()),
    })),
  })),
  translateDrawing: vi.fn((drawing) => drawing),
  unwrap: vi.fn((v) => v),
  fuse: vi.fn((_a, b) => b),
  cut: vi.fn((a) => a),
  translate: vi.fn((_s, pos) => mockShape({ translated: pos })),
  getBounds: vi.fn(() => ({ xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 10 })),
}));

const baseFace: CutFace = {
  axis: 'x',
  position: 0,
  isMale: true,
  binEdgeLength: 84,
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

const baseContext: BinGeometryContext = {
  floorZ: 3.8,
  wallTopZ: 24.8,
  wallThickness: 1.2,
  floorThickness: 1.2,
};

describe('splitConnectorBuilder', () => {
  let applySplitConnectors: typeof ApplySplitConnectorsFn;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('./splitConnectorBuilder');
    applySplitConnectors = mod.applySplitConnectors;
  });

  it('returns piece unchanged when no cut faces', () => {
    const piece = 'unchanged-piece' as never;
    const result = applySplitConnectors(piece, [], baseContext, baseConfig);
    expect(result).toBe(piece);
  });

  it('generates fuse target for male scarf lap', () => {
    const face: CutFace = { ...baseFace, isMale: true };
    const result = applySplitConnectors('piece' as never, [face], baseContext, baseConfig);
    expect(result).toBeDefined();
  });

  it('generates cut target for female scarf ramp', () => {
    const face: CutFace = { ...baseFace, isMale: false };
    const result = applySplitConnectors('piece' as never, [face], baseContext, baseConfig);
    expect(result).toBeDefined();
  });

  it('handles zero wall height gracefully', () => {
    const context: BinGeometryContext = {
      ...baseContext,
      wallTopZ: baseContext.floorZ, // zero wall height
    };
    const result = applySplitConnectors('piece' as never, [baseFace], context, baseConfig);
    expect(result).toBeDefined();
  });

  it('handles very thin floor gracefully', () => {
    const context: BinGeometryContext = {
      ...baseContext,
      floorThickness: 0.1, // below MIN_FEATURE_HEIGHT
    };
    const result = applySplitConnectors('piece' as never, [baseFace], context, baseConfig);
    expect(result).toBeDefined();
  });
});
