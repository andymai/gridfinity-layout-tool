import { describe, expect, it } from 'vitest';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { traceBinFootprint } from './traceBinFootprint';

describe('traceBinFootprint', () => {
  it('fills exactly the cells bins touch, across all layers', () => {
    const layout = createTestLayout({
      drawer: { width: 3, depth: 2, height: 12 },
      layers: [
        { id: 'layer1', name: 'L1', height: 3 },
        { id: 'layer2', name: 'L2', height: 3 },
      ],
      bins: [
        createTestBin({ id: 'a', layerId: 'layer1', x: 0, y: 0, width: 1, depth: 1 }),
        createTestBin({ id: 'b', layerId: 'layer2', x: 2, y: 1, width: 1, depth: 1 }),
      ],
    });
    const grid = traceBinFootprint(layout);
    expect(Array.from(grid.cells)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('ignores staged bins', () => {
    const layout = createTestLayout({
      drawer: { width: 2, depth: 1, height: 12 },
      bins: [createTestBin({ id: 's', layerId: STAGING_ID, x: 0, y: 0, width: 2, depth: 1 })],
    });
    const grid = traceBinFootprint(layout);
    expect(Array.from(grid.cells)).toEqual([0, 0]);
  });

  it('half-grid bins fill the whole cells they touch', () => {
    const layout = createTestLayout({
      drawer: { width: 2, depth: 1, height: 12 },
      bins: [createTestBin({ id: 'h', x: 0.5, y: 0, width: 1, depth: 0.5 })],
    });
    const grid = traceBinFootprint(layout);
    // Touches both unit cells.
    expect(Array.from(grid.cells)).toEqual([1, 1]);
  });
});
