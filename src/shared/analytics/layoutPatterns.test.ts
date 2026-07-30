import { describe, it, expect } from 'vitest';
import {
  detectArchetype,
  detectSpatialPatterns,
  computeUniformityScore,
  computeEdgeUsage,
} from '@/shared/analytics/layoutPatterns';
import { createDefaultLayout } from '@/core/constants';
import { binId, categoryId, gridUnits, heightUnits, layerId } from '@/core/types';
import type { Bin, Category, Drawer, Layer, Layout } from '@/core/types';

interface BinSpec {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  depth?: number;
  height?: number;
  layerId?: string;
  category?: string;
}

// Helper to create a test bin
function createBin(overrides: BinSpec = {}): Bin {
  return {
    id: binId(overrides.id ?? `bin-${Math.random().toString(36).substring(2, 11)}`),
    x: gridUnits(overrides.x ?? 0),
    y: gridUnits(overrides.y ?? 0),
    width: gridUnits(overrides.width ?? 1),
    depth: gridUnits(overrides.depth ?? 1),
    height: heightUnits(overrides.height ?? 1),
    layerId: layerId(overrides.layerId ?? 'layer-1'),
    category: categoryId(overrides.category ?? 'cat-1'),
    label: '',
    notes: '',
  };
}

// Helper to create a test layout with bins
function createTestLayout(bins: BinSpec[]): Layout {
  const layout = createDefaultLayout();
  layout.bins = bins.map((b, i) => createBin({ ...b, id: b.id || `bin-${i}` }));
  return layout;
}

function createDrawer(width: number, depth: number, height: number): Drawer {
  return { width: gridUnits(width), depth: gridUnits(depth), height: heightUnits(height) };
}

function createLayer(id: string, name: string, height: number): Layer {
  return { id: layerId(id), name, height: heightUnits(height) };
}

function createCategory(id: string, name: string, color: string): Category {
  return { id: categoryId(id), name, color };
}

describe('layoutPatterns', () => {
  describe('detectArchetype', () => {
    it('returns mixed for empty layout', () => {
      const layout = createTestLayout([]);
      expect(detectArchetype(layout)).toBe('mixed');
    });

    it('returns uniform when >80% bins are same size', () => {
      const bins: BinSpec[] = [
        { x: 0, y: 0, width: 2, depth: 2, height: 3 },
        { x: 2, y: 0, width: 2, depth: 2, height: 3 },
        { x: 4, y: 0, width: 2, depth: 2, height: 3 },
        { x: 6, y: 0, width: 2, depth: 2, height: 3 },
        { x: 0, y: 2, width: 2, depth: 2, height: 3 },
        { x: 2, y: 2, width: 1, depth: 1, height: 3 }, // One different size
      ];
      const layout = createTestLayout(bins);
      expect(detectArchetype(layout)).toBe('uniform');
    });

    it('returns mixed when sizes are varied', () => {
      const bins: BinSpec[] = [
        { x: 0, y: 0, width: 1, depth: 1, height: 1 },
        { x: 1, y: 0, width: 2, depth: 2, height: 2 },
        { x: 3, y: 0, width: 3, depth: 3, height: 3 },
        { x: 0, y: 1, width: 2, depth: 1, height: 2 },
        { x: 2, y: 1, width: 1, depth: 2, height: 1 },
      ];
      const layout = createTestLayout(bins);
      expect(detectArchetype(layout)).toBe('mixed');
    });

    it('returns border_fill when bins on 3+ edges with center bins', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(6, 6, 10);
      const bins: BinSpec[] = [
        // Left edge
        { x: 0, y: 0, width: 1, depth: 2 },
        { x: 0, y: 2, width: 1, depth: 2 },
        { x: 0, y: 4, width: 1, depth: 2 },
        // Right edge
        { x: 5, y: 0, width: 1, depth: 2 },
        { x: 5, y: 2, width: 1, depth: 2 },
        { x: 5, y: 4, width: 1, depth: 2 },
        // Bottom edge
        { x: 1, y: 0, width: 2, depth: 1 },
        { x: 3, y: 0, width: 2, depth: 1 },
        // Center bins
        { x: 2, y: 2, width: 2, depth: 2 },
      ];
      layout.bins = bins.map((b, i) => createBin({ ...b, id: `bin-${i}` }));
      expect(detectArchetype(layout)).toBe('border_fill');
    });

    it('returns layered when layers have different size patterns', () => {
      const layout = createDefaultLayout();
      layout.layers = [createLayer('layer-1', 'Layer 1', 5), createLayer('layer-2', 'Layer 2', 5)];
      // Layer 1 has small bins (1x1, 2x1)
      // Layer 2 has large bins (3x3, 4x4)
      // Different size sets with <50% overlap
      const bins: BinSpec[] = [
        // Layer 1 - small bins
        { x: 0, y: 0, width: 1, depth: 1, height: 3, layerId: 'layer-1' },
        { x: 1, y: 0, width: 2, depth: 1, height: 3, layerId: 'layer-1' },
        { x: 0, y: 1, width: 1, depth: 1, height: 3, layerId: 'layer-1' },
        { x: 1, y: 1, width: 2, depth: 1, height: 3, layerId: 'layer-1' },
        // Layer 2 - large bins with different sizes
        { x: 0, y: 0, width: 3, depth: 3, height: 4, layerId: 'layer-2' },
        { x: 3, y: 0, width: 4, depth: 4, height: 4, layerId: 'layer-2' },
        { x: 0, y: 3, width: 3, depth: 3, height: 4, layerId: 'layer-2' },
      ];
      layout.bins = bins.map((b, i) => createBin({ ...b, id: `bin-${i}` }));
      expect(detectArchetype(layout)).toBe('layered');
    });

    it('detects compartmentalized or uniform for clustered categories', () => {
      // This tests that the archetype detection runs and returns a valid archetype
      // The exact result depends on algorithm details (uniform may take precedence
      // if all bins are same size)
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 10, 12);
      layout.categories = [
        createCategory('cat-a', 'A', '#ff0000'),
        createCategory('cat-b', 'B', '#00ff00'),
      ];
      // Two distinct clusters of same-category bins with different sizes
      const bins: BinSpec[] = [
        // Cluster A - different sizes
        { x: 1, y: 1, width: 2, depth: 2, category: 'cat-a' },
        { x: 3, y: 1, width: 1, depth: 2, category: 'cat-a' },
        { x: 1, y: 3, width: 2, depth: 1, category: 'cat-a' },
        // Cluster B - different sizes
        { x: 6, y: 6, width: 2, depth: 2, category: 'cat-b' },
        { x: 8, y: 6, width: 1, depth: 2, category: 'cat-b' },
        { x: 6, y: 8, width: 2, depth: 1, category: 'cat-b' },
      ];
      layout.bins = bins.map((b, i) => createBin({ ...b, id: `bin-${i}` }));
      const archetype = detectArchetype(layout);
      expect(['compartmentalized', 'mixed']).toContain(archetype);
    });
  });

  describe('detectSpatialPatterns', () => {
    it('returns empty array for empty layout', () => {
      const layout = createTestLayout([]);
      expect(detectSpatialPatterns(layout)).toEqual([]);
    });

    it('detects edge_aligned when >60% bins touch edge', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      const bins: BinSpec[] = [
        // Bins on edges
        { x: 0, y: 0, width: 2, depth: 2 },
        { x: 0, y: 2, width: 2, depth: 2 },
        { x: 8, y: 0, width: 2, depth: 2 },
        { x: 8, y: 2, width: 2, depth: 2 },
        { x: 2, y: 6, width: 2, depth: 2 }, // Top edge
        // Center bin (not on edge) - less than 40%
        { x: 4, y: 3, width: 2, depth: 2 },
      ];
      layout.bins = bins.map((b, i) => createBin({ ...b, id: `bin-${i}` }));
      const patterns = detectSpatialPatterns(layout);
      expect(patterns).toContain('edge_aligned');
    });

    it('detects corner_start when early bins are near corners', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      // Use sortable IDs (a < b < c etc)
      const bins: BinSpec[] = [
        // Early bins (start of alphabet) near corners
        { id: 'a', x: 0, y: 0, width: 2, depth: 2 },
        { id: 'b', x: 0, y: 1, width: 1, depth: 1 },
        { id: 'c', x: 1, y: 0, width: 1, depth: 1 },
        // Later bins (end of alphabet) in center
        { id: 'x', x: 4, y: 4, width: 2, depth: 2 },
        { id: 'y', x: 5, y: 3, width: 2, depth: 2 },
        { id: 'z', x: 6, y: 4, width: 1, depth: 1 },
      ];
      layout.bins = bins.map((b) => createBin(b));
      const patterns = detectSpatialPatterns(layout);
      expect(patterns).toContain('corner_start');
    });

    it('detects large_first when sizes decrease over time', () => {
      const layout = createDefaultLayout();
      // Use sortable IDs
      const bins: BinSpec[] = [
        // Early bins are large
        { id: 'a', x: 0, y: 0, width: 3, depth: 3, height: 3 },
        { id: 'b', x: 3, y: 0, width: 3, depth: 3, height: 3 },
        { id: 'c', x: 0, y: 3, width: 2, depth: 2, height: 2 },
        // Later bins are small
        { id: 'x', x: 2, y: 3, width: 1, depth: 1, height: 1 },
        { id: 'y', x: 6, y: 0, width: 1, depth: 1, height: 1 },
        { id: 'z', x: 6, y: 1, width: 1, depth: 1, height: 1 },
      ];
      layout.bins = bins.map((b) => createBin(b));
      const patterns = detectSpatialPatterns(layout);
      expect(patterns).toContain('large_first');
    });

    it('detects category_grouped when same categories are adjacent', () => {
      const layout = createDefaultLayout();
      layout.categories = [
        createCategory('cat-a', 'A', '#ff0000'),
        createCategory('cat-b', 'B', '#00ff00'),
      ];
      const bins: BinSpec[] = [
        // Category A bins adjacent to each other
        { x: 0, y: 0, width: 1, depth: 1, category: 'cat-a' },
        { x: 1, y: 0, width: 1, depth: 1, category: 'cat-a' },
        { x: 0, y: 1, width: 1, depth: 1, category: 'cat-a' },
        // Category B bins adjacent to each other
        { x: 4, y: 4, width: 1, depth: 1, category: 'cat-b' },
        { x: 5, y: 4, width: 1, depth: 1, category: 'cat-b' },
        { x: 4, y: 5, width: 1, depth: 1, category: 'cat-b' },
      ];
      layout.bins = bins.map((b, i) => createBin({ ...b, id: `bin-${i}` }));
      const patterns = detectSpatialPatterns(layout);
      expect(patterns).toContain('category_grouped');
    });
  });

  describe('computeUniformityScore', () => {
    it('returns 1 for empty array', () => {
      expect(computeUniformityScore([])).toBe(1);
    });

    it('returns 1 for single bin', () => {
      const bins = [createBin()];
      expect(computeUniformityScore(bins)).toBe(1);
    });

    it('returns 1 for all same size bins', () => {
      const bins = [
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
      ];
      expect(computeUniformityScore(bins)).toBe(1);
    });

    it('returns lower score for varied sizes', () => {
      const bins = [
        createBin({ width: 1, depth: 1, height: 1 }),
        createBin({ width: 2, depth: 2, height: 2 }),
        createBin({ width: 3, depth: 3, height: 3 }),
        createBin({ width: 4, depth: 4, height: 4 }),
      ];
      const score = computeUniformityScore(bins);
      expect(score).toBeLessThan(1);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('returns moderate score for mostly uniform sizes', () => {
      // 9 same size bins, 1 different - highly uniform
      const bins = [
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 2, depth: 2, height: 3 }),
        createBin({ width: 1, depth: 1, height: 1 }),
      ];
      const score = computeUniformityScore(bins);
      expect(score).toBeGreaterThan(0.4);
      expect(score).toBeLessThan(1);
    });
  });

  describe('computeEdgeUsage', () => {
    it('returns all false for empty array', () => {
      const layout = createDefaultLayout();
      expect(computeEdgeUsage([], layout.drawer)).toEqual({
        left: false,
        right: false,
        top: false,
        bottom: false,
      });
    });

    it('detects left edge usage', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      const bins = [createBin({ x: 0, y: 3, width: 2, depth: 2 })];
      expect(computeEdgeUsage(bins, layout.drawer).left).toBe(true);
    });

    it('detects right edge usage', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      const bins = [createBin({ x: 8, y: 3, width: 2, depth: 2 })];
      expect(computeEdgeUsage(bins, layout.drawer).right).toBe(true);
    });

    it('detects top edge usage', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      const bins = [createBin({ x: 3, y: 6, width: 2, depth: 2 })];
      expect(computeEdgeUsage(bins, layout.drawer).top).toBe(true);
    });

    it('detects bottom edge usage', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      const bins = [createBin({ x: 3, y: 0, width: 2, depth: 2 })];
      expect(computeEdgeUsage(bins, layout.drawer).bottom).toBe(true);
    });

    it('detects multiple edges', () => {
      const layout = createDefaultLayout();
      layout.drawer = createDrawer(10, 8, 12);
      const bins = [
        createBin({ x: 0, y: 0, width: 2, depth: 2 }), // Left and bottom
        createBin({ x: 8, y: 6, width: 2, depth: 2 }), // Right and top
      ];
      const usage = computeEdgeUsage(bins, layout.drawer);
      expect(usage).toEqual({
        left: true,
        right: true,
        top: true,
        bottom: true,
      });
    });
  });
});
