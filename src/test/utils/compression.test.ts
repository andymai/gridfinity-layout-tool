/**
 * Tests for compression utilities.
 * These utilities use lz-string for compressing/decompressing layout data
 * to reduce IndexedDB storage usage.
 */

import { describe, it, expect } from 'vitest';
import {
  compressLayout,
  decompressLayout,
  compressString,
  decompressString,
  getCompressionRatio,
} from '@/shared/utils';
import type { Layout } from '@/core/types';

// Helper to create a test layout
function createTestLayout(overrides?: Partial<Layout>): Layout {
  return {
    version: '1.0',
    name: 'Test Layout',
    drawer: { width: 10, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories: [{ id: 'cat1', name: 'Default', color: '#3b82f6' }],
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
    bins: [
      {
        id: 'bin1',
        layerId: 'layer1',
        x: 0,
        y: 0,
        width: 2,
        depth: 2,
        height: 3,
        category: 'cat1',
        label: '',
        notes: '',
      },
    ],
    ...overrides,
  };
}

describe('compression utilities', () => {
  describe('compressString / decompressString', () => {
    it('should compress and decompress a string correctly', () => {
      const original = 'Hello, World! This is a test string.';
      const compressed = compressString(original);
      const decompressed = decompressString(compressed);

      expect(decompressed).toBe(original);
    });

    it('should produce a smaller output for repetitive strings', () => {
      const repetitive = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const compressed = compressString(repetitive);

      // Compressed should be smaller than original
      expect(compressed.length).toBeLessThan(repetitive.length);
    });

    it('should handle empty strings', () => {
      const compressed = compressString('');
      const decompressed = decompressString(compressed);

      expect(decompressed).toBe('');
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const compressed = compressString(unicode);
      const decompressed = decompressString(compressed);

      expect(decompressed).toBe(unicode);
    });

    it('should handle special JSON characters', () => {
      const special = '{"key": "value with \\"quotes\\" and \\n newlines"}';
      const compressed = compressString(special);
      const decompressed = decompressString(compressed);

      expect(decompressed).toBe(special);
    });

    it('should return empty string when decompression fails', () => {
      // Passing invalid compressed data that will return null from lz-string
      const result = decompressString('not-valid-compressed-data');
      expect(result).toBe('');
    });
  });

  describe('compressLayout / decompressLayout', () => {
    it('should compress and decompress a layout correctly', () => {
      const layout = createTestLayout();
      const compressed = compressLayout(layout);
      const decompressed = decompressLayout(compressed);

      expect(decompressed).toEqual(layout);
    });

    it('should handle layouts with many bins', () => {
      const bins = Array.from({ length: 100 }, (_, i) => ({
        id: `bin${i}`,
        layerId: 'layer1',
        x: i % 10,
        y: Math.floor(i / 10),
        width: 1,
        depth: 1,
        height: 3,
        category: 'cat1',
        label: `Bin ${i}`,
        notes: '',
      }));

      const layout = createTestLayout({ bins });
      const compressed = compressLayout(layout);
      const decompressed = decompressLayout(compressed);

      expect(decompressed).toEqual(layout);
      expect(decompressed.bins).toHaveLength(100);
    });

    it('should handle layouts with notes and labels', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            category: 'cat1',
            label: 'Screwdrivers',
            notes: 'Phillips and flathead, various sizes. Keep organized by size.',
          },
        ],
      });

      const compressed = compressLayout(layout);
      const decompressed = decompressLayout(compressed);

      expect(decompressed.bins[0].label).toBe('Screwdrivers');
      expect(decompressed.bins[0].notes).toContain('Phillips and flathead');
    });

    it('should handle layouts with custom properties', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
            customProperties: {
              partNumber: 'ABC-123',
              supplier: 'ACME Corp',
            },
          },
        ],
      });

      const compressed = compressLayout(layout);
      const decompressed = decompressLayout(compressed);

      expect(decompressed.bins[0].customProperties).toEqual({
        partNumber: 'ABC-123',
        supplier: 'ACME Corp',
      });
    });

    it('should return null for invalid compressed data', () => {
      const result = decompressLayout('invalid-data');
      expect(result).toBeNull();
    });

    it('should return null for corrupted compressed data', () => {
      const layout = createTestLayout();
      const compressed = compressLayout(layout);
      // Corrupt the data
      const corrupted = compressed.slice(0, compressed.length / 2);
      const result = decompressLayout(corrupted);
      expect(result).toBeNull();
    });
  });

  describe('getCompressionRatio', () => {
    it('should return a ratio less than 1 for typical layouts', () => {
      const layout = createTestLayout();
      const original = JSON.stringify(layout);
      const compressed = compressLayout(layout);

      const ratio = getCompressionRatio(original, compressed);

      // Compression should achieve some reduction
      expect(ratio).toBeLessThan(1);
      expect(ratio).toBeGreaterThan(0);
    });

    it('should show better compression for larger layouts', () => {
      const smallLayout = createTestLayout();
      const largeLayout = createTestLayout({
        bins: Array.from({ length: 50 }, (_, i) => ({
          id: `bin${i}`,
          layerId: 'layer1',
          x: i % 10,
          y: Math.floor(i / 10),
          width: 1,
          depth: 1,
          height: 3,
          category: 'cat1',
          label: `Storage Bin ${i}`,
          notes: 'Standard storage bin for workshop organization',
        })),
      });

      const smallOriginal = JSON.stringify(smallLayout);
      const smallCompressed = compressLayout(smallLayout);
      const smallRatio = getCompressionRatio(smallOriginal, smallCompressed);

      const largeOriginal = JSON.stringify(largeLayout);
      const largeCompressed = compressLayout(largeLayout);
      const largeRatio = getCompressionRatio(largeOriginal, largeCompressed);

      // Larger layouts typically compress better due to more repetition
      expect(largeRatio).toBeLessThanOrEqual(smallRatio);
    });

    it('should return 1 for empty original string', () => {
      const ratio = getCompressionRatio('', 'anything');
      expect(ratio).toBe(1);
    });
  });
});
