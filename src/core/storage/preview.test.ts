import { describe, it, expect } from 'vitest';
import { computePreview } from './preview';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { categoryId, gridUnits, heightUnits, layerId } from '@/core/types';

describe('computePreview', () => {
  it('returns drawer dimensions', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(5), depth: gridUnits(4), height: heightUnits(3) },
    });
    const preview = computePreview(layout);

    expect(preview.drawerWidth).toBe(5);
    expect(preview.drawerDepth).toBe(4);
    expect(preview.drawerHeight).toBe(3);
  });

  it('counts all bins (including staging)', () => {
    const layout = createTestLayout({
      bins: [
        createTestBin({ x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ x: gridUnits(1), y: gridUnits(0) }),
        createTestBin({ x: gridUnits(0), y: gridUnits(0), layerId: STAGING_ID }),
      ],
    });
    const preview = computePreview(layout);

    // binCount includes all bins
    expect(preview.binCount).toBe(3);
  });

  it('excludes staging bins from binMap', () => {
    const layout = createTestLayout({
      bins: [
        createTestBin({ x: gridUnits(0), y: gridUnits(0) }),
        createTestBin({ x: gridUnits(1), y: gridUnits(0), layerId: STAGING_ID }),
      ],
    });
    const preview = computePreview(layout);
    const binMap = preview.binMap ?? [];

    // binMap only includes grid bins (getGridBins filters staging)
    expect(preview.binMap).toHaveLength(1);
    expect(binMap[0].x).toBe(0);
  });

  it('maps category colors to bins', () => {
    const layout = createTestLayout({
      categories: [{ id: categoryId('cat-1'), name: 'Tools', color: '#FF0000' }],
      bins: [createTestBin({ x: gridUnits(0), y: gridUnits(0), category: categoryId('cat-1') })],
    });
    const preview = computePreview(layout);
    const binMap = preview.binMap ?? [];

    expect(binMap[0].c).toBe('#FF0000');
  });

  it('uses fallback color for bins without matching category', () => {
    const layout = createTestLayout({
      bins: [
        createTestBin({ x: gridUnits(0), y: gridUnits(0), category: categoryId('nonexistent') }),
      ],
    });
    const preview = computePreview(layout);
    const binMap = preview.binMap ?? [];

    expect(binMap[0].c).toBe('#6B7280');
  });

  it('includes bin labels when present', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ x: gridUnits(0), y: gridUnits(0), label: 'Screws' })],
    });
    const preview = computePreview(layout);
    const binMap = preview.binMap ?? [];

    expect(binMap[0].l).toBe('Screws');
  });

  it('omits label field for unlabeled bins', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ x: gridUnits(0), y: gridUnits(0), label: '' })],
    });
    const preview = computePreview(layout);
    const binMap = preview.binMap ?? [];

    expect(binMap[0].l).toBeUndefined();
  });

  it('counts layers', () => {
    const layout = createTestLayout({
      layers: [
        { id: layerId('layer-1'), name: 'Layer 1', height: heightUnits(3) },
        { id: layerId('layer-2'), name: 'Layer 2', height: heightUnits(5) },
      ],
    });
    const preview = computePreview(layout);

    expect(preview.layerCount).toBe(2);
  });

  it('maps bin spatial data correctly', () => {
    const layout = createTestLayout({
      bins: [
        createTestBin({
          x: gridUnits(2),
          y: gridUnits(3),
          width: gridUnits(4),
          depth: gridUnits(5),
        }),
      ],
    });
    const preview = computePreview(layout);
    const binMap = preview.binMap ?? [];

    expect(binMap[0]).toMatchObject({ x: 2, y: 3, w: 4, d: 5 });
  });
});
