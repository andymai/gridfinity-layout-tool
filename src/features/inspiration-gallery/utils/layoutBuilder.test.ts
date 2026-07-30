import { describe, it, expect } from 'vitest';
import {
  createBin,
  createLayer,
  createCategory,
  computePreview,
  calculateMetrics,
  buildInspirationLayout,
} from './layoutBuilder';
import { gridUnits, heightUnits, binId, layerId, categoryId } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { createTestLayout, createTestBin } from '@/test/testUtils';

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
        drawer: { width: gridUnits(12), depth: gridUnits(10), height: heightUnits(15) },
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
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('cat-1'), name: 'General', color: '#6b7280' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(1),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
          createTestBin({
            id: binId('b2'),
            x: gridUnits(1),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(1),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
          createTestBin({
            id: binId('b3'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(1),
            height: heightUnits(3),
            layerId: STAGING_ID,
            category: categoryId('cat-1'),
          }),
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binCount).toBe(3); // All bins counted
      expect(preview.binMap).toHaveLength(2); // Staged bins excluded from visual
    });

    it('counts layers correctly', () => {
      const layout = createTestLayout({
        layers: [
          { id: layerId('l1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('l2'), name: 'Layer 2', height: heightUnits(3) },
          { id: layerId('l3'), name: 'Layer 3', height: heightUnits(6) },
        ],
      });

      const preview = computePreview(layout);

      expect(preview.layerCount).toBe(3);
    });

    it('creates binMap with correct positions and colors', () => {
      const layout = createTestLayout({
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [
          { id: categoryId('tools'), name: 'Tools', color: '#ff0000' },
          { id: categoryId('parts'), name: 'Parts', color: '#00ff00' },
        ],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(2),
            depth: gridUnits(3),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('tools'),
          }),
          createTestBin({
            id: binId('b2'),
            x: gridUnits(2),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(2),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('parts'),
          }),
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binMap).toHaveLength(2);
      expect(preview.binMap![0]).toEqual({ x: 0, y: 0, w: 2, d: 3, c: '#ff0000' });
      expect(preview.binMap![1]).toEqual({ x: 2, y: 0, w: 1, d: 2, c: '#00ff00' });
    });

    it('uses fallback color for unknown category', () => {
      const layout = createTestLayout({
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('known'), name: 'Known', color: '#ff0000' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(1),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('unknown'),
          }),
        ],
      });

      const preview = computePreview(layout);

      expect(preview.binMap![0].c).toBe('#6B7280'); // fallback gray
    });

    it('excludes staging bins from binMap', () => {
      const layout = createTestLayout({
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('cat-1'), name: 'General', color: '#6b7280' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(1),
            depth: gridUnits(1),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
          createTestBin({
            id: binId('b2'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
            layerId: STAGING_ID,
            category: categoryId('cat-1'),
          }),
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
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('cat-1'), name: 'General', color: '#6b7280' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
          createTestBin({
            id: binId('b2'),
            x: gridUnits(1),
            y: gridUnits(0),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
          createTestBin({
            id: binId('b3'),
            x: gridUnits(0),
            y: gridUnits(0),
            layerId: STAGING_ID,
            category: categoryId('cat-1'),
          }),
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.binCount).toBe(2);
    });

    it('counts layers', () => {
      const layout = createTestLayout({
        layers: [
          { id: layerId('l1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('l2'), name: 'Layer 2', height: heightUnits(6) },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.layerCount).toBe(2);
    });

    it('counts categories', () => {
      const layout = createTestLayout({
        categories: [
          { id: categoryId('c1'), name: 'Cat 1', color: '#ff0000' },
          { id: categoryId('c2'), name: 'Cat 2', color: '#00ff00' },
          { id: categoryId('c3'), name: 'Cat 3', color: '#0000ff' },
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.categoryCount).toBe(3);
    });

    it('counts labeled bins', () => {
      const layout = createTestLayout({
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('cat-1'), name: 'General', color: '#6b7280' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
            label: 'Has label',
          }),
          createTestBin({
            id: binId('b2'),
            x: gridUnits(1),
            y: gridUnits(0),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
          createTestBin({
            id: binId('b3'),
            x: gridUnits(2),
            y: gridUnits(0),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
            label: 'Another',
          }),
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.labeledBinCount).toBe(2);
    });

    it('does not count whitespace-only labels', () => {
      const layout = createTestLayout({
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('cat-1'), name: 'General', color: '#6b7280' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
            label: '  ',
          }),
        ],
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.labeledBinCount).toBe(0);
    });

    it('includes drawer size', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(15), depth: gridUnits(12), height: heightUnits(18) },
      });

      const metrics = calculateMetrics(layout);

      expect(metrics.drawerSize).toEqual({ width: 15, depth: 12, height: 18 });
    });
  });

  describe('buildInspirationLayout', () => {
    it('builds complete InspirationLayout with all fields', () => {
      const layout = createTestLayout({
        drawer: { width: gridUnits(8), depth: gridUnits(6), height: heightUnits(10) },
        layers: [
          { id: layerId('l1'), name: 'Layer 1', height: heightUnits(3) },
          { id: layerId('l2'), name: 'Layer 2', height: heightUnits(3) },
        ],
        categories: [
          { id: categoryId('c1'), name: 'Tools', color: '#ff0000' },
          { id: categoryId('c2'), name: 'Parts', color: '#00ff00' },
          { id: categoryId('c3'), name: 'Other', color: '#0000ff' },
        ],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
            layerId: layerId('l1'),
            category: categoryId('c1'),
            label: 'Screws',
          }),
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
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
        layers: [{ id: layerId('l1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [
          { id: categoryId('c1'), name: 'Cat 1', color: '#ff0000' },
          { id: categoryId('c2'), name: 'Cat 2', color: '#00ff00' },
        ],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            layerId: layerId('l1'),
            category: categoryId('c1'),
            label: 'Test',
          }),
          createTestBin({
            id: binId('b2'),
            x: gridUnits(1),
            y: gridUnits(0),
            layerId: layerId('l1'),
            category: categoryId('c2'),
          }),
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
        drawer: { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(6) },
        layers: [{ id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) }],
        categories: [{ id: categoryId('cat-1'), name: 'General', color: '#6b7280' }],
        bins: [
          createTestBin({
            id: binId('b1'),
            x: gridUnits(0),
            y: gridUnits(0),
            width: gridUnits(2),
            depth: gridUnits(2),
            height: heightUnits(3),
            layerId: layerId('layer-1'),
            category: categoryId('cat-1'),
          }),
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
