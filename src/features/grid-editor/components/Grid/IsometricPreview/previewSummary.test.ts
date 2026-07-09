import { describe, it, expect } from 'vitest';
import { getPreviewSummary } from './previewSummary';
import { createTestLayout, createTestBin } from '@/test/testUtils';

describe('getPreviewSummary', () => {
  it('reports empty when no bins are placed', () => {
    const layout = createTestLayout({ bins: [] });
    const summary = getPreviewSummary(layout);

    expect(summary.isEmpty).toBe(true);
    expect(summary.binCount).toBe(0);
  });

  it('counts bins and layers and reads drawer dimensions', () => {
    // createTestLayout defaults: 10x8 drawer, one layer.
    const layout = createTestLayout({
      bins: [createTestBin({ id: 'a' }), createTestBin({ id: 'b' }), createTestBin({ id: 'c' })],
    });

    const summary = getPreviewSummary(layout);

    expect(summary).toEqual({
      isEmpty: false,
      binCount: 3,
      layerCount: layout.layers.length,
      drawerWidth: layout.drawer.width,
      drawerDepth: layout.drawer.depth,
    });
    expect(summary.drawerWidth).toBe(10);
    expect(summary.drawerDepth).toBe(8);
  });
});
