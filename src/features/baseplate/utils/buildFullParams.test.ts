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
});
