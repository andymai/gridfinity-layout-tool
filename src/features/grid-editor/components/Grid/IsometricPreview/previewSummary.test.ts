import { describe, it, expect } from 'vitest';
import { getPreviewSummary } from './previewSummary';
import { STAGING_ID } from '@/core/constants';
import { binId } from '@/core/types';
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
      bins: [
        createTestBin({ id: binId('a') }),
        createTestBin({ id: binId('b') }),
        createTestBin({ id: binId('c') }),
      ],
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

  it('excludes staging (off-grid stash) bins, which the preview does not render', () => {
    const layout = createTestLayout({
      bins: [
        createTestBin({ id: binId('placed') }),
        createTestBin({ id: binId('stashed-1'), layerId: STAGING_ID }),
        createTestBin({ id: binId('stashed-2'), layerId: STAGING_ID }),
      ],
    });

    const summary = getPreviewSummary(layout);
    expect(summary.binCount).toBe(1);
    expect(summary.isEmpty).toBe(false);
  });

  it('reports empty when only staging bins exist', () => {
    const layout = createTestLayout({
      bins: [createTestBin({ id: binId('stashed'), layerId: STAGING_ID })],
    });

    const summary = getPreviewSummary(layout);
    expect(summary.binCount).toBe(0);
    expect(summary.isEmpty).toBe(true);
  });
});
