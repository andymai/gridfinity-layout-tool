import { describe, it, expect } from 'vitest';
import {
  createBin,
  createLayer,
  createCategory,
  computePreview,
  calculateMetrics,
  buildInspirationLayout,
} from '../utils/layoutBuilder';
import type { Layout } from '@/core/types';

/**
 * Helper to create a minimal valid Layout for testing.
 */
function createTestLayout(overrides: Partial<Layout> = {}): Layout {
  const defaultLayer = { id: 'layer-1', name: 'Layer 1', height: 3 };
  const defaultCategory = { id: 'cat-1', name: 'General', color: '#6b7280' };

  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: {
      width: 10,
      depth: 8,
      height: 12,
    },
    layers: [defaultLayer],
    categories: [defaultCategory],
    bins: [],
    gridUnitMm: 42,
    heightUnitMm: 7,
    printBedSize: 256,
    ...overrides,
  };
}

describe('layoutBuilder', () => {
  describe('createBin', () => {
    it('creates a bin with required fields', () => {
      const bin = createBin(0, 0, 2, 3, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
      });

      expect(bin.x).toBe(0);
      expect(bin.y).toBe(0);
      expect(bin.width).toBe(2);
      expect(bin.depth).toBe(3);
      expect(bin.layerId).toBe('layer-1');
      expect(bin.category).toBe('cat-1');
      expect(bin.id).toMatch(/^insp-\d+$/);
    });

    it('uses default height of 3 when not specified', () => {
      const bin = createBin(0, 0, 1, 1, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
      });

      expect(bin.height).toBe(3);
    });

    it('uses custom height when specified', () => {
      const bin = createBin(0, 0, 1, 1, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
        height: 6,
      });

      expect(bin.height).toBe(6);
    });

    it('sets label and notes with defaults', () => {
      const bin = createBin(0, 0, 1, 1, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
      });

      expect(bin.label).toBe('');
      expect(bin.notes).toBe('');
    });

    it('sets custom label and notes', () => {
      const bin = createBin(0, 0, 1, 1, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
        label: 'Screwdrivers',
        notes: 'Various sizes',
      });

      expect(bin.label).toBe('Screwdrivers');
      expect(bin.notes).toBe('Various sizes');
    });

    it('includes clearanceHeight when specified', () => {
      const bin = createBin(0, 0, 1, 1, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
        clearanceHeight: 5,
      });

      expect(bin.clearanceHeight).toBe(5);
    });

    it('omits clearanceHeight when not specified', () => {
      const bin = createBin(0, 0, 1, 1, {
        layerId: 'layer-1',
        categoryId: 'cat-1',
      });

      expect(bin).not.toHaveProperty('clearanceHeight');
    });

    it('generates unique IDs for each bin', () => {
      const bin1 = createBin(0, 0, 1, 1, { layerId: 'l', categoryId: 'c' });
      const bin2 = createBin(1, 0, 1, 1, { layerId: 'l', categoryId: 'c' });
      const bin3 = createBin(2, 0, 1, 1, { layerId: 'l', categoryId: 'c' });

      expect(bin1.id).not.toBe(bin2.id);
      expect(bin2.id).not.toBe(bin3.id);
      expect(bin1.id).not.toBe(bin3.id);
    });
  });

  describe('createLayer', () => {
    it('creates a layer with name and height', () => {
      const layer = createLayer('Top Layer', 6);

      expect(layer.name).toBe('Top Layer');
      expect(layer.height).toBe(6);
      expect(layer.id).toMatch(/^insp-\d+$/);
    });

    it('generates unique IDs for each layer', () => {
      const layer1 = createLayer('Layer 1', 3);
      const layer2 = createLayer('Layer 2', 3);

      expect(layer1.id).not.toBe(layer2.id);
    });
  });

  describe('createCategory', () => {
    it('creates a category with name and color', () => {
      const category = createCategory('Tools', '#ff0000');

      expect(category.name).toBe('Tools');
      expect(category.color).toBe('#ff0000');
      expect(category.id).toMatch(/^insp-\d+$/);
    });

    it('generates unique IDs for each category', () => {
      const cat1 = createCategory('Cat 1', '#ff0000');
      const cat2 = createCategory('Cat 2', '#00ff00');

      expect(cat1.id).not.toBe(cat2.id);
    });
  });

  describe('computePreview', () => {
    it('computes drawer dimensions from layout', () => {
      const layout = createTestLayout({
        drawer: { width: 12, depth: 10, height: 15 },
      });

      const preview = computePreview(layout);

      expect(preview.drawerWidth).toBe(12);
      expect(preview.drawerDepth).toBe(10);
      expect(preview.drawerHeight).toBe(15);
    });

    it('counts all bins including staging area for binCount', () => {
      // binCount represents total bins in the layout (including staged)
      // binMap excludes staged bins (for visual thumbnail only)
      const layout = createTestLayout({
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
          {
            id: 'b2',
            x: 1,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
          {
            id: 'b3',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: '__staging__',
            category: 'cat-1',
            label: '',
            notes: '',
          },
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binCount).toBe(3); // All bins counted
      expect(preview.binMap).toHaveLength(2); // Staged bins excluded from visual
    });

    it('counts layers correctly', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'l1', name: 'Layer 1', height: 3 },
          { id: 'l2', name: 'Layer 2', height: 3 },
          { id: 'l3', name: 'Layer 3', height: 6 },
        ],
      });

      const preview = computePreview(layout);

      expect(preview.layerCount).toBe(3);
    });

    it('creates binMap with correct positions and colors', () => {
      const layout = createTestLayout({
        categories: [
          { id: 'tools', name: 'Tools', color: '#ff0000' },
          { id: 'parts', name: 'Parts', color: '#00ff00' },
        ],
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 2,
            depth: 3,
            height: 3,
            layerId: 'layer-1',
            category: 'tools',
            label: '',
            notes: '',
          },
          {
            id: 'b2',
            x: 2,
            y: 0,
            width: 1,
            depth: 2,
            height: 3,
            layerId: 'layer-1',
            category: 'parts',
            label: '',
            notes: '',
          },
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binMap).toHaveLength(2);
      expect(preview.binMap![0]).toEqual({ x: 0, y: 0, w: 2, d: 3, c: '#ff0000' });
      expect(preview.binMap![1]).toEqual({ x: 2, y: 0, w: 1, d: 2, c: '#00ff00' });
    });

    it('uses fallback color for unknown category', () => {
      const layout = createTestLayout({
        categories: [{ id: 'known', name: 'Known', color: '#ff0000' }],
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'unknown',
            label: '',
            notes: '',
          },
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binMap![0].c).toBe('#6B7280'); // fallback gray
    });

    it('excludes staging bins from binMap', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
          {
            id: 'b2',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: '__staging__',
            category: 'cat-1',
            label: '',
            notes: '',
          },
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binMap).toHaveLength(1);
      // Color comes from default category 'cat-1' which has color '#6b7280'
      expect(preview.binMap![0]).toEqual({ x: 0, y: 0, w: 1, d: 1, c: '#6b7280' });
    });
  });

  describe('calculateMetrics', () => {
    it('counts bins excluding staging', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
          {
            id: 'b2',
            x: 1,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
          {
            id: 'b3',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: '__staging__',
            category: 'cat-1',
            label: '',
            notes: '',
          },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.binCount).toBe(2);
    });

    it('counts layers', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'l1', name: 'Layer 1', height: 3 },
          { id: 'l2', name: 'Layer 2', height: 6 },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.layerCount).toBe(2);
    });

    it('counts categories', () => {
      const layout = createTestLayout({
        categories: [
          { id: 'c1', name: 'Cat 1', color: '#ff0000' },
          { id: 'c2', name: 'Cat 2', color: '#00ff00' },
          { id: 'c3', name: 'Cat 3', color: '#0000ff' },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.categoryCount).toBe(3);
    });

    it('counts labeled bins', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: 'Has label',
            notes: '',
          },
          {
            id: 'b2',
            x: 1,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
          {
            id: 'b3',
            x: 2,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: 'Another',
            notes: '',
          },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.labeledBinCount).toBe(2);
    });

    it('does not count whitespace-only labels', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '  ',
            notes: '',
          },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.labeledBinCount).toBe(0);
    });

    it('includes drawer size', () => {
      const layout = createTestLayout({
        drawer: { width: 15, depth: 12, height: 18 },
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.drawerSize).toEqual({ width: 15, depth: 12, height: 18 });
    });
  });

  describe('buildInspirationLayout', () => {
    it('builds complete InspirationLayout with all fields', () => {
      const layout = createTestLayout({
        drawer: { width: 8, depth: 6, height: 10 },
        layers: [
          { id: 'l1', name: 'Layer 1', height: 3 },
          { id: 'l2', name: 'Layer 2', height: 3 },
        ],
        categories: [
          { id: 'c1', name: 'Tools', color: '#ff0000' },
          { id: 'c2', name: 'Parts', color: '#00ff00' },
          { id: 'c3', name: 'Other', color: '#0000ff' },
        ],
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: 'l1',
            category: 'c1',
            label: 'Screws',
            notes: '',
          },
        ],
      });

      const result = buildInspirationLayout(layout, {
        id: 'test-layout',
        name: 'Test Layout',
        theme: 'workshop',
        description: 'A detailed description',
        shortDescription: 'A short desc',
        tags: ['tools', 'workshop'],
      });

      expect(result.id).toBe('test-layout');
      expect(result.name).toBe('Test Layout');
      expect(result.theme).toBe('workshop');
      expect(result.description).toBe('A detailed description');
      expect(result.shortDescription).toBe('A short desc');
      expect(result.tags).toEqual(['tools', 'workshop']);
      expect(result.layout).toBe(layout);
    });

    it('calculates metrics correctly', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
        layers: [{ id: 'l1', name: 'Layer 1', height: 3 }],
        categories: [
          { id: 'c1', name: 'Cat 1', color: '#ff0000' },
          { id: 'c2', name: 'Cat 2', color: '#00ff00' },
        ],
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'l1',
            category: 'c1',
            label: 'Test',
            notes: '',
          },
          {
            id: 'b2',
            x: 1,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            layerId: 'l1',
            category: 'c2',
            label: '',
            notes: '',
          },
        ],
      });

      const result = buildInspirationLayout(layout, {
        id: 'test',
        name: 'Test',
        theme: 'kitchen',
        description: 'Desc',
        shortDescription: 'Short',
        tags: [],
      });

      expect(result.metrics.binCount).toBe(2);
      expect(result.metrics.layerCount).toBe(1);
      expect(result.metrics.categoryCount).toBe(2);
      expect(result.metrics.labeledBinCount).toBe(1);
      expect(result.metrics.drawerSize).toEqual({ width: 10, depth: 8, height: 12 });
    });

    it('computes preview correctly', () => {
      const layout = createTestLayout({
        drawer: { width: 5, depth: 4, height: 6 },
        bins: [
          {
            id: 'b1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            layerId: 'layer-1',
            category: 'cat-1',
            label: '',
            notes: '',
          },
        ],
      });

      const result = buildInspirationLayout(layout, {
        id: 'test',
        name: 'Test',
        theme: 'office',
        description: 'Desc',
        shortDescription: 'Short',
        tags: [],
      });

      expect(result.preview.drawerWidth).toBe(5);
      expect(result.preview.drawerDepth).toBe(4);
      expect(result.preview.drawerHeight).toBe(6);
      expect(result.preview.binCount).toBe(1);
      expect(result.preview.layerCount).toBe(1);
      expect(result.preview.binMap).toHaveLength(1);
    });
  });
});
