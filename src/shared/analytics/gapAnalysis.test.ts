import { describe, it, expect } from 'vitest';
import { analyzeGaps, calculateFillPercentage } from '@/shared/analytics/gapAnalysis';
import { createTestLayout } from '@/test/testUtils';

describe('gapAnalysis', () => {
  describe('analyzeGaps', () => {
    it('returns full gap for empty layer', () => {
      const layout = createTestLayout();
      const result = analyzeGaps(layout, 'layer1');

      expect(result.largestGap).toBe('10x8');
      expect(result.fillPct).toBe(0);
      expect(result.gapFit).toBe('none');
    });

    it('calculates fill percentage correctly', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 5,
            depth: 4,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      const result = analyzeGaps(layout, 'layer1');

      // 5*4 = 20 cells occupied out of 10*8 = 80 total = 25%
      expect(result.fillPct).toBe(25);
    });

    it('determines exact gap fit', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 8,
            depth: 8,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      // Remaining gap is 2x8 on the right
      const result = analyzeGaps(layout, 'layer1', { width: 2, depth: 8 });

      expect(result.gapFit).toBe('exact');
    });

    it('determines partial gap fit', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 5,
            depth: 8,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      // Remaining gap is 5x8, placing a 2x2 would be partial fit
      const result = analyzeGaps(layout, 'layer1', { width: 2, depth: 2 });

      expect(result.gapFit).toBe('partial');
    });

    it('determines no gap fit when bin is too large', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 9,
            depth: 8,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      // Remaining gap is 1x8, placing a 2x2 would not fit
      const result = analyzeGaps(layout, 'layer1', { width: 2, depth: 2 });

      expect(result.gapFit).toBe('none');
    });

    it('ignores bins on other layers', () => {
      const layout = createTestLayout({
        layers: [
          { id: 'layer1', name: 'Layer 1', height: 3 },
          { id: 'layer2', name: 'Layer 2', height: 3 },
        ],
        bins: [
          {
            id: 'bin1',
            layerId: 'layer2', // Different layer
            x: 0,
            y: 0,
            width: 10,
            depth: 8,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      const result = analyzeGaps(layout, 'layer1');

      // Layer 1 should still be empty
      expect(result.fillPct).toBe(0);
      expect(result.largestGap).toBe('10x8');
    });

    it('handles multiple bins', () => {
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
          },
          {
            id: 'bin2',
            layerId: 'layer1',
            x: 2,
            y: 0,
            width: 2,
            depth: 2,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      const result = analyzeGaps(layout, 'layer1');

      // 2*2 + 2*2 = 8 cells out of 80 = 10%
      expect(result.fillPct).toBe(10);
    });
  });

  describe('calculateFillPercentage', () => {
    it('returns 0 for empty layer', () => {
      const layout = createTestLayout();
      const result = calculateFillPercentage(layout, 'layer1');

      expect(result).toBe(0);
    });

    it('calculates percentage correctly', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 4,
            depth: 4,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      const result = calculateFillPercentage(layout, 'layer1');

      // 4*4 = 16 out of 80 = 20%
      expect(result).toBe(20);
    });

    it('returns 100 for fully filled layer', () => {
      const layout = createTestLayout({
        bins: [
          {
            id: 'bin1',
            layerId: 'layer1',
            x: 0,
            y: 0,
            width: 10,
            depth: 8,
            height: 3,
            category: 'cat1',
            label: '',
            notes: '',
          },
        ],
      });

      const result = calculateFillPercentage(layout, 'layer1');

      expect(result).toBe(100);
    });

    it('handles empty drawer', () => {
      const layout = createTestLayout({
        drawer: { width: 0, depth: 0, height: 0 },
      });

      const result = calculateFillPercentage(layout, 'layer1');

      expect(result).toBe(0);
    });
  });
});
