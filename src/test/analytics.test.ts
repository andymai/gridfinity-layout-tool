import { describe, it, expect } from 'vitest';
import { computeLayoutMetrics } from '../utils/analytics';
import type { Layout } from '../types';
import { STAGING_ID } from '../constants';

const createTestLayout = (overrides?: Partial<Layout>): Layout => ({
  version: '1.0',
  name: 'Test',
  drawer: { width: 10, depth: 8, height: 12 },
  printBedSize: 256,
  gridUnitMm: 42,
  heightUnitMm: 7,
  categories: [
    { id: 'cat1', name: 'General', color: '#3b82f6' },
    { id: 'cat2', name: 'Tools', color: '#22c55e' },
  ],
  layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  bins: [],
  ...overrides,
});

describe('computeLayoutMetrics', () => {
  describe('bin counting', () => {
    it('counts bins on grid vs staging', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b2', layerId: 'layer1', x: 1, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b3', layerId: STAGING_ID, x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_count).toBe(3);
      expect(metrics.bins_on_grid).toBe(2);
      expect(metrics.bins_in_staging).toBe(1);
    });

    it('returns zero counts for empty layout', () => {
      const layout = createTestLayout();
      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_count).toBe(0);
      expect(metrics.bins_on_grid).toBe(0);
      expect(metrics.bins_in_staging).toBe(0);
    });
  });

  describe('size distribution', () => {
    it('tracks top bin sizes by count', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b2', layerId: 'layer1', x: 2, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b3', layerId: 'layer1', x: 4, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_top_sizes).toEqual([
        { size: '2x2', count: 2 },
        { size: '1x1', count: 1 },
      ]);
    });

    it('tracks height distribution', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b2', layerId: 'layer1', x: 1, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b3', layerId: 'layer1', x: 2, y: 0, width: 1, depth: 1, height: 6, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_heights).toEqual({ 3: 2, 6: 1 });
    });

    it('calculates average area', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 2, depth: 2, height: 3, category: 'cat1', label: '', notes: '' }, // 4
          { id: 'b2', layerId: 'layer1', x: 2, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' }, // 1
          { id: 'b3', layerId: 'layer1', x: 3, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' }, // 1
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bin_avg_area).toBe(2); // (4+1+1)/3 = 2
    });
  });

  describe('feature flags', () => {
    it('detects bins with labels', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: 'Screws', notes: '' },
          { id: 'b2', layerId: 'layer1', x: 1, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_labels).toBe(1);
      expect(metrics.feature_labels).toBe(true);
    });

    it('detects bins with notes', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: 'Important' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_notes).toBe(1);
      expect(metrics.feature_notes).toBe(true);
    });

    it('detects bins with clearance height', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '', clearanceHeight: 2 },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_clearance).toBe(1);
      expect(metrics.feature_clearance).toBe(true);
    });

    it('detects half-unit bins', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1.5, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.bins_with_half_units).toBe(1);
      expect(metrics.feature_half_bins).toBe(true);
    });

    it('detects multi-layer usage', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 6 },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.layer_count).toBe(2);
      expect(metrics.feature_multi_layer).toBe(true);
    });
  });

  describe('category tracking', () => {
    it('counts categories used', () => {
      const layout = createTestLayout({
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b2', layerId: 'layer1', x: 1, y: 0, width: 1, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
          { id: 'b3', layerId: 'layer1', x: 2, y: 0, width: 1, depth: 1, height: 3, category: 'cat2', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.category_count).toBe(2);
      expect(metrics.top_categories).toEqual([
        { name: 'General', count: 2 },
        { name: 'Tools', count: 1 },
      ]);
    });

    it('detects custom categories', () => {
      const layout = createTestLayout({
        categories: [
          { id: 'cat1', name: 'Coral', color: '#f87171' }, // default
          { id: 'cat2', name: 'My Custom', color: '#ff0000' }, // custom
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.custom_category_count).toBe(1);
      expect(metrics.feature_custom_categories).toBe(true);
    });
  });

  describe('drawer configuration', () => {
    it('detects default drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 10, depth: 8, height: 12 },
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.drawer_is_default).toBe(true);
      expect(metrics.feature_custom_drawer).toBe(false);
    });

    it('detects custom drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 15, depth: 10, height: 12 },
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.drawer_is_default).toBe(false);
      expect(metrics.feature_custom_drawer).toBe(true);
    });

    it('detects custom print bed', () => {
      const layout = createTestLayout({
        printBedSize: 300,
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.feature_custom_print_bed).toBe(true);
    });
  });

  describe('print bed overflow detection', () => {
    it('detects oversized bins', () => {
      const layout = createTestLayout({
        printBedSize: 84, // 2 grid units (84mm / 42mm)
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 1, height: 3, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.has_oversized_bins).toBe(true);
      expect(metrics.max_bin_width).toBe(3);
    });

    it('allows bins within print bed', () => {
      const layout = createTestLayout({
        printBedSize: 168, // 4 grid units
        bins: [
          { id: 'b1', layerId: 'layer1', x: 0, y: 0, width: 3, depth: 3, height: 3, category: 'cat1', label: '', notes: '' },
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.has_oversized_bins).toBe(false);
    });
  });

  describe('engagement thresholds', () => {
    it('marks 5+ bins as engaged', () => {
      const layout = createTestLayout({
        bins: Array.from({ length: 5 }, (_, i) => ({
          id: `b${i}`,
          layerId: 'layer1',
          x: i,
          y: 0,
          width: 1,
          depth: 1,
          height: 3,
          category: 'cat1',
          label: '',
          notes: '',
        })),
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.is_engaged).toBe(true);
      expect(metrics.is_substantial).toBe(false);
    });

    it('marks 15+ bins as substantial', () => {
      const layout = createTestLayout({
        bins: Array.from({ length: 15 }, (_, i) => ({
          id: `b${i}`,
          layerId: 'layer1',
          x: i % 10,
          y: Math.floor(i / 10),
          width: 1,
          depth: 1,
          height: 3,
          category: 'cat1',
          label: '',
          notes: '',
        })),
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.is_engaged).toBe(true);
      expect(metrics.is_substantial).toBe(true);
    });

    it('excludes staging bins from engagement count', () => {
      const layout = createTestLayout({
        bins: [
          ...Array.from({ length: 4 }, (_, i) => ({
            id: `grid${i}`,
            layerId: 'layer1',
            x: i,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          })),
          ...Array.from({ length: 5 }, (_, i) => ({
            id: `staging${i}`,
            layerId: STAGING_ID,
            x: 0,
            y: 0,
            width: 1,
            depth: 1,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          })),
        ],
      });

      const metrics = computeLayoutMetrics(layout);

      expect(metrics.is_engaged).toBe(false); // Only 4 on grid
    });
  });
});
