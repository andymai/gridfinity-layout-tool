import { describe, expect, it } from 'vitest';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import { binId, gridUnits, heightUnits, layerId } from '@/core/types';
import { traceBinFootprint } from './traceBinFootprint';

describe('traceBinFootprint', () => {
  it('fills exactly the cells bins touch, across all layers', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(3), depth: gridUnits(2), height: heightUnits(12) },
      layers: [
        { id: layerId('layer1'), name: 'L1', height: heightUnits(3) },
        { id: layerId('layer2'), name: 'L2', height: heightUnits(3) },
      ],
      bins: [
        createTestBin({
          id: binId('a'),
          layerId: layerId('layer1'),
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(1),
        }),
        createTestBin({
          id: binId('b'),
          layerId: layerId('layer2'),
          x: gridUnits(2),
          y: gridUnits(1),
          width: gridUnits(1),
          depth: gridUnits(1),
        }),
      ],
    });
    const grid = traceBinFootprint(layout);
    expect(Array.from(grid.cells)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('ignores staged bins', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(2), depth: gridUnits(1), height: heightUnits(12) },
      bins: [
        createTestBin({
          id: binId('s'),
          layerId: STAGING_ID,
          x: gridUnits(0),
          y: gridUnits(0),
          width: gridUnits(2),
          depth: gridUnits(1),
        }),
      ],
    });
    const grid = traceBinFootprint(layout);
    expect(Array.from(grid.cells)).toEqual([0, 0]);
  });

  it('half-grid bins fill the whole cells they touch', () => {
    const layout = createTestLayout({
      drawer: { width: gridUnits(2), depth: gridUnits(1), height: heightUnits(12) },
      bins: [
        createTestBin({
          id: binId('h'),
          x: gridUnits(0.5),
          y: gridUnits(0),
          width: gridUnits(1),
          depth: gridUnits(0.5),
        }),
      ],
    });
    const grid = traceBinFootprint(layout);
    // Touches both unit cells.
    expect(Array.from(grid.cells)).toEqual([1, 1]);
  });
});
