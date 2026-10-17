import { describe, it, expect, afterEach } from 'vitest';
import { canPlaceBin } from './validationPlacement';
import { registerLinkedExcessResolver } from './collision';
import { createTestLayout, createTestBin } from '@/test/testUtils';
import { STAGING_ID } from '@/core/constants';
import type { Bin, HeightUnits, Layout, Rect } from '@/core/types';
import { binId, designId, gridUnits, heightUnits, layerId, mm } from '@/core/types';

const LAYER_1 = layerId('layer1');
const LAYER_2 = layerId('layer2');

function placementRect(r: {
  x: number;
  y: number;
  width: number;
  depth: number;
  height: number;
}): Rect & { height: HeightUnits } {
  return {
    x: gridUnits(r.x),
    y: gridUnits(r.y),
    width: gridUnits(r.width),
    depth: gridUnits(r.depth),
    height: heightUnits(r.height),
  };
}

function makeSingleLayerLayout(): Layout {
  return createTestLayout({
    drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
    layers: [{ id: LAYER_1, name: 'Layer 1', height: heightUnits(3) }],
  });
}

function makeTwoLayerLayout(): Layout {
  return createTestLayout({
    drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(12) },
    layers: [
      { id: LAYER_1, name: 'Layer 1', height: heightUnits(3) },
      { id: LAYER_2, name: 'Layer 2', height: heightUnits(6) },
    ],
  });
}

describe('canPlaceBin', () => {
  it('returns valid for a bin that fits in the drawer with no obstacles', () => {
    const layout = makeSingleLayerLayout();
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: true });
  });

  it('returns valid at the exact right/bottom boundary', () => {
    const layout = makeSingleLayerLayout();
    // x + width = 10 = drawer.width, y + depth = 8 = drawer.depth — exact fit
    const result = canPlaceBin(
      placementRect({ x: 8, y: 6, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: true });
  });

  describe('out_of_bounds', () => {
    it('returns out_of_bounds when x is negative', () => {
      const layout = makeSingleLayerLayout();
      const result = canPlaceBin(
        placementRect({ x: -1, y: 0, width: 2, depth: 2, height: 3 }),
        LAYER_1,
        layout
      );
      expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
    });

    it('returns out_of_bounds when y is negative', () => {
      const layout = makeSingleLayerLayout();
      const result = canPlaceBin(
        placementRect({ x: 0, y: -1, width: 2, depth: 2, height: 3 }),
        LAYER_1,
        layout
      );
      expect(result).toEqual({ valid: false, reason: 'out_of_bounds' });
    });
  });

  it('returns exceeds_width when x + width exceeds drawer width', () => {
    const layout = makeSingleLayerLayout();
    // 9 + 2 = 11 > 10
    const result = canPlaceBin(
      placementRect({ x: 9, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_width' });
  });

  it('returns exceeds_depth when y + depth exceeds drawer depth', () => {
    const layout = makeSingleLayerLayout();
    // 7 + 2 = 9 > 8
    const result = canPlaceBin(
      placementRect({ x: 0, y: 7, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'exceeds_depth' });
  });

  it('returns invalid_layer for an unknown layer id', () => {
    const layout = makeSingleLayerLayout();
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      layerId('nonexistent'),
      layout
    );
    expect(result).toEqual({ valid: false, reason: 'invalid_layer' });
  });

  describe('resting stack', () => {
    const lower = (height: number, extra: Partial<Bin> = {}): Bin =>
      createTestBin({
        id: binId('lower'),
        width: gridUnits(3),
        depth: gridUnits(3),
        height: heightUnits(height),
        ...extra,
      });

    it('rests an upper-layer bin with nothing below on the plate', () => {
      const layout = makeTwoLayerLayout();
      const result = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 10 }),
        LAYER_2,
        layout
      );
      expect(result).toEqual({ valid: true });
    });

    it('lets a bin rest on a lower bin taller than its layer', () => {
      const layout = makeTwoLayerLayout();
      layout.bins = [lower(5)];
      const result = canPlaceBin(
        placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 7 }),
        LAYER_2,
        layout
      );
      expect(result).toEqual({ valid: true });
    });

    it('returns exceeds_height when the stack under the bin leaves too little room', () => {
      const layout = makeTwoLayerLayout();
      layout.bins = [lower(5)];
      const result = canPlaceBin(
        placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 8 }),
        LAYER_2,
        layout
      );
      expect(result).toEqual({ valid: false, reason: 'exceeds_height' });
    });

    it('returns exceeds_height for a bin taller than the drawer on its own', () => {
      const layout = makeSingleLayerLayout();
      const result = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 13 }),
        LAYER_1,
        layout
      );
      expect(result).toEqual({ valid: false, reason: 'exceeds_height' });
    });

    it('refuses growing a lower bin when it lifts a stack past the drawer', () => {
      const layout = makeTwoLayerLayout();
      layout.bins = [
        lower(3),
        createTestBin({ id: binId('upper'), layerId: LAYER_2, height: heightUnits(8) }),
      ];
      const grow = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 5 }),
        LAYER_1,
        layout,
        binId('lower')
      );
      expect(grow).toMatchObject({
        valid: false,
        reason: 'exceeds_height',
        blockingInfo: { binId: 'upper', layerName: 'Layer 2' },
      });
      const fits = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 4 }),
        LAYER_1,
        layout,
        binId('lower')
      );
      expect(fits).toEqual({ valid: true });
    });

    it('does not let an existing overflow block unrelated edits', () => {
      const layout = makeTwoLayerLayout();
      layout.drawer = { ...layout.drawer, height: heightUnits(6) };
      layout.bins = [
        lower(3),
        createTestBin({ id: binId('upper'), layerId: LAYER_2, height: heightUnits(5) }),
      ];
      const elsewhere = canPlaceBin(
        placementRect({ x: 6, y: 6, width: 1, depth: 1, height: 3 }),
        LAYER_1,
        layout
      );
      expect(elsewhere).toEqual({ valid: true });

      const lowered = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 1, depth: 1, height: 4 }),
        LAYER_2,
        layout,
        binId('upper')
      );
      expect(lowered).toEqual({ valid: true });

      const raised = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 1, depth: 1, height: 6 }),
        LAYER_2,
        layout,
        binId('upper')
      );
      expect(raised).toEqual({ valid: false, reason: 'exceeds_height' });
    });

    it('refuses growing a bin under a stack that is already over the drawer', () => {
      const layout = makeTwoLayerLayout();
      layout.drawer = { ...layout.drawer, height: heightUnits(6) };
      layout.bins = [
        lower(3),
        createTestBin({ id: binId('upper'), layerId: LAYER_2, height: heightUnits(5) }),
      ];
      const grow = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 4 }),
        LAYER_1,
        layout,
        binId('lower')
      );
      expect(grow).toMatchObject({ valid: false, reason: 'exceeds_height' });
    });

    it('keeps the other bins of a group drag where they are while checking one', () => {
      // A bridge on layer 2 spans clearance and a taller bin, carrying a bin on
      // layer 3. Checking a second selected bin must not treat the bridge as gone.
      const layout = createTestLayout({
        drawer: { width: gridUnits(10), depth: gridUnits(8), height: heightUnits(20) },
        layers: [
          { id: LAYER_1, name: 'Layer 1', height: heightUnits(3) },
          { id: LAYER_2, name: 'Layer 2', height: heightUnits(3) },
          { id: layerId('layer3'), name: 'Layer 3', height: heightUnits(3) },
        ],
      });
      layout.bins = [
        createTestBin({ id: binId('tools'), clearanceHeight: heightUnits(2) }),
        createTestBin({ id: binId('tall'), x: gridUnits(1), height: heightUnits(6) }),
        createTestBin({ id: binId('bridge'), layerId: LAYER_2, width: gridUnits(2) }),
        createTestBin({ id: binId('top'), layerId: layerId('layer3') }),
        createTestBin({ id: binId('other'), layerId: LAYER_2, x: gridUnits(5) }),
      ];
      const group = new Set([binId('bridge'), binId('other')]);
      const result = canPlaceBin(
        placementRect({ x: 6, y: 0, width: 1, depth: 1, height: 3 }),
        LAYER_2,
        layout,
        binId('other'),
        group
      );
      expect(result).toEqual({ valid: true });
    });

    it('returns blocked_zone for a bin that would rest on reserved clearance', () => {
      const layout = makeTwoLayerLayout();
      layout.bins = [lower(3, { clearanceHeight: heightUnits(2) })];
      const result = canPlaceBin(
        placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 3 }),
        LAYER_2,
        layout
      );
      expect(result).toMatchObject({
        valid: false,
        reason: 'blocked_zone',
        blockingInfo: { binId: 'lower', layerId: 'layer1', layerName: 'Layer 1' },
      });
    });

    it('carries a moved bin’s own clearance when the caller omits it', () => {
      const layout = makeTwoLayerLayout();
      layout.bins = [
        lower(3, { clearanceHeight: heightUnits(2) }),
        createTestBin({
          id: binId('upper'),
          layerId: LAYER_2,
          x: gridUnits(5),
          height: heightUnits(2),
        }),
      ];
      const slideUnder = canPlaceBin(
        placementRect({ x: 4, y: 0, width: 3, depth: 3, height: 3 }),
        LAYER_1,
        layout,
        binId('lower')
      );
      expect(slideUnder).toMatchObject({
        valid: false,
        reason: 'blocked_zone',
        blockingInfo: { binId: 'upper' },
      });
    });
  });

  describe('linked-design excess rise', () => {
    afterEach(() => {
      registerLinkedExcessResolver(null);
    });

    it('stacks an upper bin on top of a lower design’s rise', () => {
      registerLinkedExcessResolver((bin) => (bin.linkedDesignId === 'lidded' ? 2 : 0));
      const layout = makeTwoLayerLayout();
      layout.bins = [
        createTestBin({
          id: binId('lidded-bin'),
          width: gridUnits(3),
          depth: gridUnits(3),
          height: heightUnits(3),
          linkedDesignId: designId('lidded'),
        }),
      ];
      const fits = canPlaceBin(
        placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 7 }),
        LAYER_2,
        layout
      );
      expect(fits).toEqual({ valid: true });
      const tooTall = canPlaceBin(
        placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 8 }),
        LAYER_2,
        layout
      );
      expect(tooTall).toEqual({ valid: false, reason: 'exceeds_height' });
    });

    it("counts the candidate's own excess against the bins it lifts", () => {
      registerLinkedExcessResolver((bin) => (bin.linkedDesignId === 'lidded' ? 2 : 0));
      const layout = makeTwoLayerLayout();
      layout.bins = [
        createTestBin({
          id: binId('upper'),
          layerId: LAYER_2,
          width: gridUnits(2),
          depth: gridUnits(2),
          height: heightUnits(8),
        }),
      ];
      const result = canPlaceBin(
        {
          ...placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
          linkedDesignId: designId('lidded'),
        },
        LAYER_1,
        layout
      );
      expect(result).toMatchObject({ valid: false, reason: 'exceeds_height' });

      const withoutLink = canPlaceBin(
        placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
        LAYER_1,
        layout
      );
      expect(withoutLink).toEqual({ valid: true });
    });
  });

  it('returns collision when bin footprints overlap on the same layer', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({
        id: binId('existing'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(3),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    if (result.valid) throw new Error('expected the placement to be rejected');
    expect(result.blockingInfo).toMatchObject({
      binId: 'existing',
      layerId: 'layer1',
      layerName: 'Layer 1',
    });
  });

  it('excludes a single bin from collision checks via excludeBinId', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({
        id: binId('moving'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(3),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 3 }),
      LAYER_1,
      layout,
      binId('moving')
    );
    expect(result).toEqual({ valid: true });
  });

  it('excludes a set of bins from collision checks via excludeBinIds', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({
        id: binId('bin1'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
      createTestBin({
        id: binId('bin2'),
        x: gridUnits(2),
        y: gridUnits(0),
        width: gridUnits(2),
        depth: gridUnits(2),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 4, depth: 2, height: 3 }),
      LAYER_1,
      layout,
      undefined,
      new Set([binId('bin1'), binId('bin2')])
    );
    expect(result).toEqual({ valid: true });
  });

  it('does not collide with staging bins', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({
        id: binId('staged'),
        layerId: STAGING_ID,
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(5),
        depth: gridUnits(5),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 3, depth: 3, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toEqual({ valid: true });
  });

  it('allows a bin shorter than the layer default height (layer height is not a constraint)', () => {
    const layout = makeTwoLayerLayout();
    // layer2 has height 6, but bins can be shorter
    const result = canPlaceBin(
      placementRect({ x: 0, y: 0, width: 2, depth: 2, height: 3 }),
      LAYER_2,
      layout
    );
    expect(result).toEqual({ valid: true });
  });

  it('includes blockingInfo.layerName as layer name, not id, when the layer is found', () => {
    const layout = makeSingleLayerLayout();
    layout.bins = [
      createTestBin({
        id: binId('blocker'),
        x: gridUnits(0),
        y: gridUnits(0),
        width: gridUnits(3),
        depth: gridUnits(3),
      }),
    ];
    const result = canPlaceBin(
      placementRect({ x: 1, y: 1, width: 2, depth: 2, height: 3 }),
      LAYER_1,
      layout
    );
    expect(result).toMatchObject({ valid: false, reason: 'collision' });
    if (result.valid) throw new Error('expected the placement to be rejected');
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
      placementRect({ x: 7, y: 5, width: 1, depth: 1, height: 3 }),
      LAYER_1,
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: false, reason: 'outside_drawer' });
  });

  it('rejects footprints straddling the outline boundary', () => {
    const result = canPlaceBin(
      placementRect({ x: 5, y: 5, width: 2, depth: 1, height: 3 }),
      LAYER_1,
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: false, reason: 'outside_drawer' });
  });

  it('accepts boundary-flush placements inside the shape', () => {
    const result = canPlaceBin(
      placementRect({ x: 4, y: 4, width: 2, depth: 4, height: 3 }),
      LAYER_1,
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: true });
  });

  it('bounds checks still take precedence over the outline', () => {
    const result = canPlaceBin(
      placementRect({ x: 9, y: 0, width: 3, depth: 1, height: 3 }),
      LAYER_1,
      makeShapedLayout()
    );
    expect(result).toMatchObject({ valid: false, reason: 'exceeds_width' });
  });

  it('scales the footprint by the per-axis pitch on a non-square grid (#2733)', () => {
    const UX = 48;
    const UY = 42;
    const layout = makeSingleLayerLayout();
    layout.gridUnitMm = mm(UX);
    layout.gridUnitMmY = mm(UY);
    // Same L shape scaled to the true per-axis pitches.
    layout.drawer.outline = {
      vertices: [
        { x: 0, y: 0 },
        { x: 10 * UX, y: 0 },
        { x: 10 * UX, y: 4 * UY },
        { x: 6 * UX, y: 4 * UY },
        { x: 6 * UX, y: 8 * UY },
        { x: 0, y: 8 * UY },
      ],
    };
    // Back-flush in the tall body (y ends at 8 × UY) — the X pitch on Y
    // would push the footprint past the outline.
    expect(
      canPlaceBin(placementRect({ x: 0, y: 6, width: 2, depth: 2, height: 3 }), LAYER_1, layout)
    ).toMatchObject({ valid: true });
    expect(
      canPlaceBin(placementRect({ x: 7, y: 5, width: 1, depth: 1, height: 3 }), LAYER_1, layout)
    ).toMatchObject({ valid: false, reason: 'outside_drawer' });
  });
});
