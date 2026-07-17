import { describe, it, expect } from 'vitest';
import { buildFullParams, maxCornerRadiusMm, plainRoundingLimit } from './buildFullParams';
import { cornerCutVertices } from '@/shared/utils/cornerCutOutline';
import type { CornerCutParams, DrawerOutline } from '@/core/types';

describe('buildFullParams', () => {
  const storedBase = {
    magnetHoles: true,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 1.0,
    paddingRight: 2.0,
    paddingFront: 3.0,
    paddingBack: 4.0,
  };

  it('passes through all stored fields', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');

    expect(result.magnetHoles).toBe(true);
    expect(result.magnetDiameter).toBe(6.5);
    expect(result.magnetDepth).toBe(2.4);
    expect(result.paddingLeft).toBe(1.0);
    expect(result.paddingRight).toBe(2.0);
    expect(result.paddingFront).toBe(3.0);
    expect(result.paddingBack).toBe(4.0);
  });

  it('forwards overTileHalfGrid when over-tile is on', () => {
    const result = buildFullParams(
      { ...storedBase, overTile: true, overTileHalfGrid: true },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(result.overTileHalfGrid).toBe(true);
  });

  it('normalizes overTileHalfGrid to undefined when over-tile is off', () => {
    const result = buildFullParams(
      { ...storedBase, overTile: false, overTileHalfGrid: true },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(result.overTileHalfGrid).toBeUndefined();
  });

  it('forwards overTileHalfGridSolidLeftover only under half-grid', () => {
    const on = buildFullParams(
      {
        ...storedBase,
        overTile: true,
        overTileHalfGrid: true,
        overTileHalfGridSolidLeftover: true,
      },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(on.overTileHalfGridSolidLeftover).toBe(true);

    // Solid-leftover is meaningless without half-grid → dropped.
    const orphaned = buildFullParams(
      {
        ...storedBase,
        overTile: true,
        overTileHalfGrid: false,
        overTileHalfGridSolidLeftover: true,
      },
      10,
      8,
      42,
      'end',
      'end'
    );
    expect(orphaned.overTileHalfGridSolidLeftover).toBeUndefined();
  });

  it('maps drawerWidth to width', () => {
    const result = buildFullParams(storedBase, 14, 8, 42, 'end', 'end');
    expect(result.width).toBe(14);
  });

  it('maps drawerDepth to depth', () => {
    const result = buildFullParams(storedBase, 10, 12, 42, 'end', 'end');
    expect(result.depth).toBe(12);
  });

  it('passes gridUnitMm through', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(result.gridUnitMm).toBe(42);
  });

  it('passes fractionalEdgeX through', () => {
    const start = buildFullParams(storedBase, 10, 8, 42, 'start', 'end');
    expect(start.fractionalEdgeX).toBe('start');

    const end = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(end.fractionalEdgeX).toBe('end');
  });

  it('passes fractionalEdgeY through', () => {
    const start = buildFullParams(storedBase, 10, 8, 42, 'end', 'start');
    expect(start.fractionalEdgeY).toBe('start');

    const end = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(end.fractionalEdgeY).toBe('end');
  });

  it('produces correct full result with all distinct values', () => {
    const stored = {
      magnetHoles: false,
      magnetDiameter: 5.0,
      magnetDepth: 1.5,
      paddingLeft: 0.5,
      paddingRight: 1.5,
      paddingFront: 2.5,
      paddingBack: 3.5,
    };

    const result = buildFullParams(stored, 20, 16, 42, 'start', 'start');

    expect(result).toEqual({
      width: 20,
      depth: 16,
      gridUnitMm: 42,
      magnetHoles: false,
      magnetDiameter: 5.0,
      magnetDepth: 1.5,
      magnetAnchor: 'edge',
      paddingLeft: 0.5,
      paddingRight: 1.5,
      paddingFront: 2.5,
      paddingBack: 3.5,
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'start',
      detachMargins: false,
      detachMarginConnector: false,
    });
  });

  describe('magnetAnchor', () => {
    it("defaults to 'edge' when the argument is omitted", () => {
      const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
      expect(result.magnetAnchor).toBe('edge');
    });

    it("passes through the legacy 'center' anchor", () => {
      const result = buildFullParams(
        storedBase,
        10,
        8,
        50,
        'end',
        'end',
        undefined,
        undefined,
        'center'
      );
      expect(result.magnetAnchor).toBe('center');
    });
  });

  describe('syncWithLayout', () => {
    it('uses drawer dims when syncWithLayout is undefined', () => {
      const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(10);
      expect(result.depth).toBe(8);
    });

    it('uses drawer dims when syncWithLayout is true', () => {
      const stored = {
        ...storedBase,
        syncWithLayout: true,
        baseplateWidth: 20,
        baseplateDepth: 16,
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(10);
      expect(result.depth).toBe(8);
    });

    it('uses custom dims when syncWithLayout is false', () => {
      const stored = {
        ...storedBase,
        syncWithLayout: false,
        baseplateWidth: 20,
        baseplateDepth: 16,
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(20);
      expect(result.depth).toBe(16);
    });

    it('falls back to drawer dims when syncWithLayout is false but custom dims missing', () => {
      const stored = { ...storedBase, syncWithLayout: false };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.width).toBe(10);
      expect(result.depth).toBe(8);
    });
  });

  describe('fractionalEdge sync/unsync', () => {
    it('uses drawer fractional edge when synced', () => {
      const stored = { ...storedBase, syncWithLayout: true };
      const result = buildFullParams(stored, 10, 8, 42, 'start', 'start');
      expect(result.fractionalEdgeX).toBe('start');
      expect(result.fractionalEdgeY).toBe('start');
    });

    it('uses stored fractional edge when not synced', () => {
      const stored = {
        ...storedBase,
        syncWithLayout: false,
        fractionalEdgeX: 'start' as const,
        fractionalEdgeY: 'start' as const,
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.fractionalEdgeX).toBe('start');
      expect(result.fractionalEdgeY).toBe('start');
    });

    it("defaults stored fractional edge to 'end' when unsynced and not set", () => {
      const stored = { ...storedBase, syncWithLayout: false };
      const result = buildFullParams(stored, 10, 8, 42, 'start', 'start');
      expect(result.fractionalEdgeX).toBe('end');
      expect(result.fractionalEdgeY).toBe('end');
    });
  });

  describe('stack-print feature stripping (connectors + magnets)', () => {
    // storedBase has magnetHoles: true.
    const withFeatures = {
      ...storedBase,
      connectorNubs: true,
      connectorStyle: 'dovetailKey' as const,
    };

    it('passes connectors and magnets through when stacking is off', () => {
      const result = buildFullParams(withFeatures, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.connectorStyle).toBe('dovetailKey');
      expect(result.magnetHoles).toBe(true);
    });

    it('keeps dovetail connectors but strips magnets when stacking (vertical prisms flip cleanly)', () => {
      const stored = {
        ...storedBase,
        connectorNubs: true,
        connectorStyle: undefined, // plain dovetail
        stackPrint: { enabled: true, gapMm: 0.2 as never },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.connectorStyle).toBeUndefined();
      expect(result.magnetHoles).toBe(false); // magnet pockets bridge when flipped
    });

    it('keeps dovetail key connectors when stacking', () => {
      const stored = {
        ...withFeatures,
        stackPrint: { enabled: true, gapMm: 0.2 as never },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.connectorStyle).toBe('dovetailKey');
      expect(result.magnetHoles).toBe(false);
    });

    it('strips snap clip connectors when stacking (its blind pocket bridges when flipped)', () => {
      const stored = {
        ...storedBase,
        connectorNubs: true,
        connectorStyle: 'snapClip' as const,
        stackPrint: { enabled: true, gapMm: 0.2 as never },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(false);
      expect(result.connectorStyle).toBeUndefined();
      expect(result.magnetHoles).toBe(false);
      // Stored params are untouched, so the style returns when stacking is off.
      expect(stored.connectorNubs).toBe(true);
      expect(stored.connectorStyle).toBe('snapClip');
    });

    it('keeps connectors and magnets when stackPrint exists but is disabled', () => {
      const stored = {
        ...withFeatures,
        stackPrint: { enabled: false, gapMm: 0.2 as never },
      };
      const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
      expect(result.connectorNubs).toBe(true);
      expect(result.magnetHoles).toBe(true);
    });
  });
});

describe('drawer outline handling', () => {
  const storedBase = {
    magnetHoles: true,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 1.0,
    paddingRight: 2.0,
    paddingFront: 3.0,
    paddingBack: 4.0,
  };
  const outline = {
    vertices: [
      { x: 0, y: 0 },
      { x: 420, y: 0 },
      { x: 420, y: 168 },
      { x: 168, y: 168 },
      { x: 168, y: 336 },
      { x: 0, y: 336 },
    ],
  };

  it('applies the outline and zeroes the subsumed params', () => {
    const stored = {
      ...storedBase,
      cornerRadius: 4,
      cornerRadii: { tl: 4, tr: 4, bl: 4, br: 4 },
      detachMargins: true,
      detachMarginConnector: true,
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    expect(result.outline).toBe(outline);
    expect(result.paddingLeft).toBe(0);
    expect(result.paddingRight).toBe(0);
    expect(result.paddingFront).toBe(0);
    expect(result.paddingBack).toBe(0);
    expect(result.cornerRadius).toBe(0);
    expect(result.cornerRadii).toBeUndefined();
    expect(result.detachMargins).toBe(false);
    expect(result.detachMarginConnector).toBe(false);
    // Stored params untouched — settings return when the shape is cleared.
    expect(stored.paddingBack).toBe(4.0);
    expect(stored.cornerRadius).toBe(4);
    expect(stored.detachMargins).toBe(true);
  });

  it('keeps magnets and solid floor working on shaped plates', () => {
    const stored = { ...storedBase, solidFloor: true, solidFloorThickness: 1.2 };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    expect(result.magnetHoles).toBe(true);
    expect(result.solidFloor).toBe(true);
  });

  it('ignores the outline for unsynced (custom-size) plates', () => {
    const stored = { ...storedBase, syncWithLayout: false, paddingLeft: 5 };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    expect(result.outline).toBeUndefined();
    expect(result.paddingLeft).toBe(5);
  });

  it('strips the outline under stack printing (uniform rectangular tiles)', () => {
    const stored = { ...storedBase, stackPrint: { enabled: true, gapMm: 0.2 as never } };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, outline);
    expect(result.outline).toBeUndefined();
  });

  it('emits no outline when the drawer has none', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end');
    expect(result.outline).toBeUndefined();
    expect(result.paddingLeft).toBe(1.0);
  });
});

describe('corner-cut shape + padding composition', () => {
  const storedBase = {
    magnetHoles: true,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 1.0,
    paddingRight: 2.0,
    paddingFront: 3.0,
    paddingBack: 4.0,
  };
  const cuts: CornerCutParams = {
    tl: { kind: 'radius', r: 60 },
    tr: { kind: 'radius', r: 60 },
    bl: { kind: 'chamfer', size: 20 },
    br: { kind: 'none' },
  };
  // 10×8 drawer at 42mm → 420×336mm grid.
  const cornerOutline: DrawerOutline = {
    vertices: cornerCutVertices(420, 336, cuts),
    authoring: { kind: 'corners', corners: cuts },
  };

  it('re-inscribes the cuts on the padded rectangle and keeps padding', () => {
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end', undefined, cornerOutline);
    expect(result.paddingLeft).toBe(1.0);
    expect(result.paddingRight).toBe(2.0);
    expect(result.paddingFront).toBe(3.0);
    expect(result.paddingBack).toBe(4.0);
    // totalW = 420 + 1 + 2 = 423, totalD = 336 + 3 + 4 = 343.
    expect(result.outline?.vertices).toEqual(cornerCutVertices(423, 343, cuts));
    expect(result.outline?.authoring).toEqual(cornerOutline.authoring);
  });

  it('reuses the stored outline identity at zero padding', () => {
    const stored = {
      ...storedBase,
      paddingLeft: 0,
      paddingRight: 0,
      paddingFront: 0,
      paddingBack: 0,
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, cornerOutline);
    expect(result.outline).toBe(cornerOutline);
    expect(result.paddingLeft).toBe(0);
  });

  it('still zeroes rounding and detach for corner-cut shapes', () => {
    const stored = {
      ...storedBase,
      cornerRadius: 4,
      cornerRadii: { tl: 4, tr: 4, bl: 4, br: 4 },
      detachMargins: true,
      detachMarginConnector: true,
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end', undefined, cornerOutline);
    expect(result.cornerRadius).toBe(0);
    expect(result.cornerRadii).toBeUndefined();
    expect(result.detachMargins).toBe(false);
    expect(result.detachMarginConnector).toBe(false);
  });

  it('falls back to shape-subsumes-padding when the authoring echo drifted', () => {
    const drifted: DrawerOutline = {
      // Vertices from DIFFERENT cuts than the echo claims.
      vertices: cornerCutVertices(420, 336, { ...cuts, tl: { kind: 'radius', r: 30 } }),
      authoring: { kind: 'corners', corners: cuts },
    };
    const result = buildFullParams(storedBase, 10, 8, 42, 'end', 'end', undefined, drifted);
    expect(result.outline).toBe(drifted);
    expect(result.paddingLeft).toBe(0);
    expect(result.paddingBack).toBe(0);
  });
});

describe('large corner radius → outline conversion', () => {
  const storedBase = {
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
  };

  it('keeps the plain rounding path for radii within the limit', () => {
    // Limit with zero padding: 42/2 = 21.
    const result = buildFullParams({ ...storedBase, cornerRadius: 21 }, 10, 8, 42, 'end', 'end');
    expect(result.outline).toBeUndefined();
    expect(result.cornerRadius).toBe(21);
  });

  it('padding raises the plain rounding limit', () => {
    const stored = {
      ...storedBase,
      paddingLeft: 10,
      paddingRight: 10,
      paddingFront: 10,
      paddingBack: 10,
      cornerRadius: 30,
    };
    expect(plainRoundingLimit(42, 10)).toBe(31);
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    expect(result.outline).toBeUndefined();
    expect(result.cornerRadius).toBe(30);
  });

  it('converts a beyond-limit radius to a radius-cut outline', () => {
    const result = buildFullParams({ ...storedBase, cornerRadius: 60 }, 10, 8, 42, 'end', 'end');
    const r60: CornerCutParams = {
      tl: { kind: 'radius', r: 60 },
      tr: { kind: 'radius', r: 60 },
      bl: { kind: 'radius', r: 60 },
      br: { kind: 'radius', r: 60 },
    };
    expect(result.outline?.vertices).toEqual(cornerCutVertices(420, 336, r60));
    expect(result.cornerRadius).toBe(0);
    expect(result.cornerRadii).toBeUndefined();
    expect(result.detachMargins).toBe(false);
  });

  it('converts when ANY per-corner radius exceeds the limit', () => {
    const stored = { ...storedBase, cornerRadii: { tl: 60, tr: 4, bl: 0, br: 4 } };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(420, 336, {
        tl: { kind: 'radius', r: 60 },
        tr: { kind: 'radius', r: 4 },
        bl: { kind: 'none' },
        br: { kind: 'radius', r: 4 },
      })
    );
  });

  it('clamps converted radii to the geometric ceiling', () => {
    // 2×2 grid → 84×84mm; ceiling is 84/2 − 0.1 = 41.9.
    const result = buildFullParams({ ...storedBase, cornerRadius: 100 }, 2, 2, 42, 'end', 'end');
    expect(maxCornerRadiusMm(84, 84)).toBeCloseTo(41.9);
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 41.9 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(84, 84, { tl: r, tr: r, bl: r, br: r })
    );
  });

  it('converts with padding kept — the padded extent hosts the arcs', () => {
    const stored = {
      ...storedBase,
      paddingLeft: 11,
      paddingRight: 11,
      paddingFront: 11,
      paddingBack: 11,
      cornerRadius: 45,
    };
    const result = buildFullParams(stored, 4, 6, 42, 'end', 'end');
    // totalW = 168 + 22 = 190, totalD = 252 + 22 = 274.
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 45 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(190, 274, { tl: r, tr: r, bl: r, br: r })
    );
    expect(result.paddingLeft).toBe(11);
  });

  it('never converts while stacking (rounding is stripped instead)', () => {
    const stored = {
      ...storedBase,
      cornerRadius: 60,
      stackPrint: { enabled: true, gapMm: 0.2 as never },
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    expect(result.outline).toBeUndefined();
    expect(result.cornerRadius).toBe(0);
  });

  it('converts on unsynced custom-size plates too', () => {
    const stored = {
      ...storedBase,
      syncWithLayout: false,
      baseplateWidth: 5,
      baseplateDepth: 5,
      cornerRadius: 60,
    };
    const result = buildFullParams(stored, 10, 8, 42, 'end', 'end');
    const r: CornerCutParams['tl'] = { kind: 'radius', r: 60 };
    expect(result.outline?.vertices).toEqual(
      cornerCutVertices(210, 210, { tl: r, tr: r, bl: r, br: r })
    );
  });
});
