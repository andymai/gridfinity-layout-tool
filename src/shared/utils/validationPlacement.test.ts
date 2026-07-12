import { describe, it, expect } from 'vitest';
import { canPlaceBin } from './validationPlacement';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import type { Layout } from '@/core/types';

function makeSingleLayerLayout(): Layout {
  return createTestLayout({
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [{ id: 'layer1', name: 'Layer 1', height: 3 }],
  });
}

function makeTwoLayerLayout(): Layout {
  return createTestLayout({
    drawer: { width: 10, depth: 8, height: 12 },
    layers: [
      { id: 'layer1', name: 'Layer 1', height: 3 },
      { id: 'layer2', name: 'Layer 2', height: 6 },
    ],
  });
}

describe('canPlaceBin', () => {
  it('returns valid for a bin that fits in the drawer with no obstacles', () => {
    const layout = makeSingleLayerLayout();
    const result = canPlaceBin({ x: 0, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: true });
  });

  it('returns valid at the exact right/bottom boundary', () => {
    const layout = makeSingleLayerLayout();
    // x + width = 10 = drawer.width, y + depth = 8 = drawer.depth — exact fit
    const result = canPlaceBin({ x: 8, y: 6, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: true });
  });

  describe('out_of_bounds', () => {
    it('returns out_of_bounds when x is negative', () => {
      const layout = makeSingleLayerLayout();
      const result = canPlaceBin({ x: -1, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
      expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
    });

    it('returns out_of_bounds when y is negative', () => {
      const layout = makeSingleLayerLayout();
      const result = canPlaceBin({ x: 0, y: -1, width: 2, depth: 2, height: 3 }, 'layer1', layout);
      expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
    });
  });

  it('returns exceeds_width when x + width exceeds drawer width', () => {
    const layout = makeSingleLayerLayout();
    // 9 + 2 = 11 > 10
    const result = canPlaceBin({ x: 9, y: 0, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('returns exceeds_depth when y + depth exceeds drawer depth', () => {
    const layout = makeSingleLayerLayout();
    // 7 + 2 = 9 > 8
    const result = canPlaceBin({ x: 0, y: 7, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: false, reason: 'exceeds_depth' });
  });

  it('returns invalid_layer for an unknown layer id', () => {
    const layout = makeSingleLayerLayout();
    const result = canPlaceBin(
      { x: 0, y: 0, width: 2, depth: 2, height: 3 },
      'nonexistent',
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'invalid_layer' });
  });

  it('returns exceeds_height when bin height exceeds remaining drawer capacity', () => {
    const layout = makeTwoLayerLayout();
    // layer2 starts at z = layer1.height = 3; drawer.height = 12; maxHeight = 9
    const result = canPlaceBin({ x: 0, y: 0, width: 2, depth: 2, height: 10 }, 'layer2', layout);
    expect(result).toEqual({ valid: false, reason: 'exceeds_height' });
  });

  it('returns blocked_zone when a tall lower-layer bin protrudes into the target layer', () => {
    const layout = makeTwoLayerLayout();
    // layer1 height = 3; bin with height = 5 extends to z = 5 > layer2 start (3)
    layout.bins = [createTestBin({ id: 'tall', x: 0, y: 0, width: 3, depth: 3, height: 5 })];
    const result = canPlaceBin({ x: 1, y: 1, width: 2, depth: 2, height: 3 }, 'layer2', layout);
    expect(result).toMatchObject({ valid: false, reason: 'blocked_zone' });
    expect(result.blockingInfo).toMatchObject({
      binId: 'tall',
      layerId: 'layer1',
      layerName: 'Layer 1',
    });
  });

  it('returns collision when bin footprints overlap on the same layer', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [createTestBin({ id: 'existing', x: 0, y: 0, width: 3, depth: 3 })];
    const result = canPlaceBin({ x: 1, y: 1, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    expect(result.blockingInfo).toMatchObject({
      binId: 'existing',
      layerId: 'layer1',
      layerName: 'Layer 1',
    });
  });

  it('excludes a single bin from collision checks via excludeBinId', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [createTestBin({ id: 'moving', x: 0, y: 0, width: 3, depth: 3 })];
    const result = canPlaceBin(
      { x: 0, y: 0, width: 3, depth: 3, height: 3 },
      'layer1',
      layout,
      'moving'
    );
    expect(result).toEqual({ valid: true });
  });

  it('excludes a set of bins from collision checks via excludeBinIds', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({ id: 'bin1', x: 0, y: 0, width: 2, depth: 2 }),
      createTestBin({ id: 'bin2', x: 2, y: 0, width: 2, depth: 2 }),
    ];
    const result = canPlaceBin(
      { x: 0, y: 0, width: 4, depth: 2, height: 3 },
      'layer1',
      layout,
      undefined,
      new Set(['bin1', 'bin2'])
    );
    expect(result).toEqual({ valid: true });
  });

  it('does not collide with staging bins', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({ id: 'staged', layerId: STAGING_ID, x: 0, y: 0, width: 5, depth: 5 }),
    ];
    const result = canPlaceBin({ x: 0, y: 0, width: 3, depth: 3, height: 3 }, 'layer1', layout);
    expect(result).toEqual({ valid: true });
  });

  it('allows a bin shorter than the layer default height (layer height is not a constraint)', () => {
    const layout = makeTwoLayerLayout();
    // layer2 has height 6, but bins can be shorter
    const result = canPlaceBin({ x: 0, y: 0, width: 2, depth: 2, height: 3 }, 'layer2', layout);
    expect(result).toEqual({ valid: true });
  });

  it('includes blockingInfo.layerName as layer name, not id, when the layer is found', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [createTestBin({ id: 'blocker', x: 0, y: 0, width: 3, depth: 3 })];
    const result = canPlaceBin({ x: 1, y: 1, width: 2, depth: 2, height: 3 }, 'layer1', layout);
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    expect(result.blockingInfo?.layerName).toBe('Layer 1');
  });
});

describe('canPlaceBin with a drawer outline', () => {
  const U = 42;
  // 10×8 drawer with the right 4×4 corner (top) notched out.
  const L_OUTLINE = {
    vertices: [
      { x: 0, y: 0 },
      { x: 10 * U, y: 0 },
      { x: 10 * U, y: 4 * U },
      { x: 6 * U, y: 4 * U },
      { x: 6 * U, y: 8 * U },
      { x: 0, y: 8 * U },
    ],
  };
  function makeShapedLayout(): Layout {
    const layout = makeSingleLayerLayout();
    layout.drawer.outline = L_OUTLINE;
    return layout;
  }

  it('rejects placements in the notch with outside_drawer', () => {
    const result = canPlaceBin(
      { x: 7, y: 5, width: 1, depth: 1, height: 3 },
      'layer1',
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: false, reason: 'outside_drawer' });
  });

  it('rejects footprints straddling the outline boundary', () => {
    const result = canPlaceBin(
      { x: 5, y: 5, width: 2, depth: 1, height: 3 },
      'layer1',
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: false, reason: 'outside_drawer' });
  });

  it('accepts boundary-flush placements inside the shape', () => {
    const result = canPlaceBin(
      { x: 4, y: 4, width: 2, depth: 4, height: 3 },
      'layer1',
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: true });
  });

  it('bounds checks still take precedence over the outline', () => {
    const result = canPlaceBin(
      { x: 9, y: 0, width: 3, depth: 1, height: 3 },
      'layer1',
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: false, reason: 'exceeds_width' });
  });
});
