import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CutFace, BinGeometryContext } from './splitConnectorBuilder';
import type { applySplitConnectors as ApplySplitConnectorsFn } from './splitConnectorBuilder';
import { wallKeyGeometry, fitWallKeyToHeight } from './splitConnectorBuilder';

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
  binEdgeMin: -42,
  binEdgeMax: 42,
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

describe('wallKeyGeometry', () => {
  const wallThicknesses = [0.8, 1.2, 1.6, 2.0, 2.4, 4.0];
  const clearances = [0, 0.15, 0.3];

  it('always leaves a positive outer wall skin (groove never breaches the exterior)', () => {
    for (const wt of wallThicknesses) {
      for (const cl of clearances) {
        const { outerSkin } = wallKeyGeometry(wt, cl);
        expect(outerSkin).toBeGreaterThan(0);
        // Skin is anchored to a fixed value, capped at the wall thickness for thin walls.
        expect(outerSkin).toBeCloseTo(Math.min(0.8, wt), 6);
      }
    }
  });

  it('anchors the key to a fixed inset instead of pushing it deeper as the wall thickens', () => {
    const thin = wallKeyGeometry(1.2, 0.15);
    const thick = wallKeyGeometry(4.0, 0.15);
    // Unlike the old `wallThickness + halfWidth`, the inset no longer grows with the wall.
    expect(thick.perpInset).toBeCloseTo(thin.perpInset, 6);
    expect(thick.pilasterPerpDepth).toBeCloseTo(thin.pilasterPerpDepth, 6);
  });

  it('shrinks the inward pilaster intrusion as the wall thickens, to zero once it hosts the key', () => {
    const intrusion = (wt: number): number =>
      Math.max(0, wallKeyGeometry(wt, 0.15).pilasterPerpDepth - wt);
    expect(intrusion(1.2)).toBeGreaterThan(intrusion(2.0));
    expect(intrusion(2.0)).toBeGreaterThan(intrusion(3.0));
    // A thick wall encloses the key, so the pilaster adds no material at all.
    expect(intrusion(4.0)).toBe(0);
  });

  it('returns the 0.4mm baseline key footprint with no nozzle scaling at/below baseline', () => {
    const baseline = wallKeyGeometry(1.2, 0.15);
    const explicit04 = wallKeyGeometry(1.2, 0.15, 0.4);
    expect(explicit04.keyHalfWidth).toBe(baseline.keyHalfWidth);
    expect(explicit04.protrusion).toBe(baseline.protrusion);
    // Baseline: 1.6mm full key width (half 0.8), 2.4mm protrusion.
    expect(baseline.keyHalfWidth).toBeCloseTo(0.8, 10);
    expect(baseline.protrusion).toBeCloseTo(2.4, 10);
  });

  it('scales the key tongue to at least two perimeters on a wider nozzle', () => {
    const wide = wallKeyGeometry(1.2, 0.15, 0.6);
    // Full tongue width = 2 × half must clear two 0.6mm beads (1.2mm).
    expect(2 * wide.keyHalfWidth).toBeGreaterThanOrEqual(2 * 0.6 - 1e-9);
    // And the intact outer skin must grow too, so a fat bead can't breach it.
    expect(wide.outerSkin).toBeGreaterThan(wallKeyGeometry(1.2, 0.15, 0.4).outerSkin - 1e-9);
  });
});

describe('fitWallKeyToHeight', () => {
  const NOMINAL = 2.4;

  it('skips wall keys when the interior height is too short for a valid ramp', () => {
    const fit = fitWallKeyToHeight(1.0, NOMINAL);
    expect(fit.fits).toBe(false);
  });

  it('passes the full protrusion through on an ample wall', () => {
    const fit = fitWallKeyToHeight(12, NOMINAL);
    expect(fit.fits).toBe(true);
    expect(fit.protrusion).toBeCloseTo(NOMINAL, 10);
  });

  it('clamps protrusion on a short-but-valid wall so the tip ramp stays self-supporting', () => {
    const keyHeight = 3.0; // valid at 0.4mm (threshold 2.4mm) but too short for full 2.4mm
    const fit = fitWallKeyToHeight(keyHeight, NOMINAL);
    expect(fit.fits).toBe(true);
    expect(fit.protrusion).toBeLessThan(NOMINAL);
    expect(fit.protrusion).toBeGreaterThan(0);
    // The ramp (rises `protrusion`) must finish strictly below the key top.
    expect(fit.protrusion).toBeLessThan(keyHeight);
  });

  it('raises the minimum height with the nozzle (≥2-perimeter protrusion floor)', () => {
    // 2.6mm clears the 0.4mm threshold (2.4mm) but not the wider 0.6mm one (2.9mm).
    expect(fitWallKeyToHeight(2.6, NOMINAL, 0.4).fits).toBe(true);
    expect(fitWallKeyToHeight(2.6, NOMINAL, 0.6).fits).toBe(false);
    // Just above the 0.6mm threshold, the clamped protrusion still clears two 0.6mm beads.
    const fit = fitWallKeyToHeight(3.0, NOMINAL, 0.6);
    expect(fit.fits).toBe(true);
    expect(fit.protrusion).toBeGreaterThanOrEqual(2 * 0.6 - 1e-9);
  });

  it('keeps the clamped protrusion within nominal and below the key top across heights', () => {
    // The protrusion drives both the male tongue and the female groove (it has no
    // clearance/inflate parameter), so the only invariant worth enforcing is that for
    // every fitting height the clamp never exceeds the nominal and always leaves
    // vertical room for the lead-in notch above the ramp (protrusion < keyHeight).
    for (let keyHeight = 1.8; keyHeight <= 14; keyHeight += 0.1) {
      const fit = fitWallKeyToHeight(keyHeight, NOMINAL);
      if (!fit.fits) continue;
      expect(fit.protrusion).toBeLessThanOrEqual(NOMINAL + 1e-9);
      expect(fit.protrusion).toBeLessThan(keyHeight);
    }
  });
});
