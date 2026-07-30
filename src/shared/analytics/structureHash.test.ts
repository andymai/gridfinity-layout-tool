import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeStructureHash, computeTemporalFields } from '@/shared/analytics/structureHash';
import { createDefaultLayout, STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits } from '@/core/types';
import type { Layout, Bin } from '@/core/types';

// Helper to create a test layout with bins
function createTestLayoutWithBins(binCount: number): Layout {
  const layout = createDefaultLayout();
  layout.bins = [];
  for (let i = 0; i < binCount; i++) {
    layout.bins.push({
      id: binId(`bin-${i}`),
      x: gridUnits(i % layout.drawer.width),
      y: gridUnits(Math.floor(i / layout.drawer.width)),
      width: gridUnits(1),
      depth: gridUnits(1),
      height: heightUnits(1),
      layerId: layout.layers[0].id,
      category: layout.categories[0].id,
      label: '',
      notes: '',
    });
  }
  return layout;
}

// Helper to create a layout with specific drawer dimensions
function createLayoutWithDrawer(width: number, depth: number, height: number): Layout {
  const layout = createDefaultLayout();
  layout.drawer = { width: gridUnits(width), depth: gridUnits(depth), height: heightUnits(height) };
  layout.bins = [];
  return layout;
}

describe('structureHash', () => {
  describe('computeStructureHash', () => {
    it('returns 8-character hex string', () => {
      const layout = createTestLayoutWithBins(5);
      const hash = computeStructureHash(layout);

      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });

    it('returns same hash for identical layouts', () => {
      const layout1 = createTestLayoutWithBins(10);
      const layout2 = createTestLayoutWithBins(10);

      const hash1 = computeStructureHash(layout1);
      const hash2 = computeStructureHash(layout2);

      expect(hash1).toBe(hash2);
    });

    it('returns different hash for layouts with different bin counts', () => {
      const layout1 = createTestLayoutWithBins(5);
      const layout2 = createTestLayoutWithBins(50);

      const hash1 = computeStructureHash(layout1);
      const hash2 = computeStructureHash(layout2);

      expect(hash1).not.toBe(hash2);
    });

    it('returns different hash for layouts with different drawer dimensions', () => {
      const layout1 = createLayoutWithDrawer(10, 8, 12);
      const layout2 = createLayoutWithDrawer(20, 5, 12);

      // Add same bins to both
      const bin: Bin = {
        id: binId('bin-1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        layerId: layout1.layers[0].id,
        category: layout1.categories[0].id,
        label: '',
        notes: '',
      };
      layout1.bins = [bin];
      layout2.bins = [{ ...bin, layerId: layout2.layers[0].id }];

      const hash1 = computeStructureHash(layout1);
      const hash2 = computeStructureHash(layout2);

      expect(hash1).not.toBe(hash2);
    });

    it('handles empty layout', () => {
      const layout = createDefaultLayout();
      layout.bins = [];

      const hash = computeStructureHash(layout);
      expect(hash).toMatch(/^[a-f0-9]{8}$/);
    });

    it('excludes staging bins', () => {
      const layout = createTestLayoutWithBins(5);
      const layoutWithStaging = createTestLayoutWithBins(5);

      // Add a staging bin
      layoutWithStaging.bins.push({
        id: binId('staging-bin'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
        height: heightUnits(3),
        layerId: STAGING_ID,
        category: layout.categories[0].id,
        label: '',
        notes: '',
      });

      const hash1 = computeStructureHash(layout);
      const hash2 = computeStructureHash(layoutWithStaging);

      // Hash should be the same since staging bins are excluded
      expect(hash1).toBe(hash2);
    });

    it('encodes different quadrant occupancy', () => {
      // Layout with bins in top-left quadrant only
      const layoutTopLeft = createLayoutWithDrawer(10, 10, 12);
      layoutTopLeft.bins = [
        {
          id: binId('bin-1'),
          x: gridUnits(0),
          y: gridUnits(9), // Top-left (grid origin is bottom-left)
          width: gridUnits(1),
          depth: gridUnits(1),
          height: heightUnits(1),
          layerId: layoutTopLeft.layers[0].id,
          category: layoutTopLeft.categories[0].id,
          label: '',
          notes: '',
        },
      ];

      // Layout with bins in bottom-right quadrant only
      const layoutBottomRight = createLayoutWithDrawer(10, 10, 12);
      layoutBottomRight.bins = [
        {
          id: binId('bin-1'),
          x: gridUnits(9),
          y: gridUnits(0), // Bottom-right
          width: gridUnits(1),
          depth: gridUnits(1),
          height: heightUnits(1),
          layerId: layoutBottomRight.layers[0].id,
          category: layoutBottomRight.categories[0].id,
          label: '',
          notes: '',
        },
      ];

      const hash1 = computeStructureHash(layoutTopLeft);
      const hash2 = computeStructureHash(layoutBottomRight);

      expect(hash1).not.toBe(hash2);
    });

    it('encodes different size distributions', () => {
      const layoutSmall = createDefaultLayout();
      layoutSmall.bins = [
        {
          id: binId('bin-1'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(1), // Small bin
          height: heightUnits(1),
          layerId: layoutSmall.layers[0].id,
          category: layoutSmall.categories[0].id,
          label: '',
          notes: '',
        },
      ];

      const layoutLarge = createDefaultLayout();
      layoutLarge.bins = [
        {
          id: binId('bin-1'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(5),
          depth: gridUnits(5), // Large bin
          height: heightUnits(1),
          layerId: layoutLarge.layers[0].id,
          category: layoutLarge.categories[0].id,
          label: '',
          notes: '',
        },
      ];

      const hash1 = computeStructureHash(layoutSmall);
      const hash2 = computeStructureHash(layoutLarge);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('computeTemporalFields', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('returns valid hour of day', () => {
      const result = computeTemporalFields();

      expect(result.hour_of_day).toBeGreaterThanOrEqual(0);
      expect(result.hour_of_day).toBeLessThanOrEqual(23);
    });

    it('returns valid day of week', () => {
      const result = computeTemporalFields();

      expect(result.day_of_week).toBeGreaterThanOrEqual(0);
      expect(result.day_of_week).toBeLessThanOrEqual(6);
    });

    it('correctly identifies weekend', () => {
      // Set to a Saturday (January 4, 2025 is a Saturday)
      vi.setSystemTime(new Date(2025, 0, 4, 12, 0, 0));
      const saturdayResult = computeTemporalFields();
      expect(saturdayResult.is_weekend).toBe(true);
      expect(saturdayResult.day_of_week).toBe(6); // Saturday

      // Set to a Sunday
      vi.setSystemTime(new Date(2025, 0, 5, 12, 0, 0));
      const sundayResult = computeTemporalFields();
      expect(sundayResult.is_weekend).toBe(true);
      expect(sundayResult.day_of_week).toBe(0); // Sunday

      // Set to a Monday
      vi.setSystemTime(new Date(2025, 0, 6, 12, 0, 0));
      const mondayResult = computeTemporalFields();
      expect(mondayResult.is_weekend).toBe(false);
      expect(mondayResult.day_of_week).toBe(1); // Monday
    });

    it('returns correct hour of day', () => {
      // Set to 3 PM
      vi.setSystemTime(new Date(2025, 0, 6, 15, 30, 0));
      const result = computeTemporalFields();
      expect(result.hour_of_day).toBe(15);
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  });
});
