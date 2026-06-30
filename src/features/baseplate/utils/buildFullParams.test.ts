import { describe, it, expect } from 'vitest';
import { buildFullParams } from './buildFullParams';

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
      paddingLeft: 0.5,
      paddingRight: 1.5,
      paddingFront: 2.5,
      paddingBack: 3.5,
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'start',
      detachMargins: false,
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
