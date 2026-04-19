/**
 * Tests for command payload Zod schemas.
 */

import { describe, it, expect } from 'vitest';
import * as z from 'zod';
import { COMMAND_SCHEMAS, getCommandSchema } from './schemas';
import type { CommandType } from '../commands';

// === Schema registry completeness ===

describe('COMMAND_SCHEMAS', () => {
  const ALL_COMMAND_TYPES: ReadonlyArray<CommandType> = [
    'bin.add',
    'bin.update',
    'bin.delete',
    'bin.deleteBatch',
    'bin.duplicate',
    'bin.moveToStaging',
    'bin.moveFromStaging',
    'bin.fillLayer',
    'bin.fillGaps',
    'bin.clearLayer',
    'layer.add',
    'layer.update',
    'layer.delete',
    'layer.reorder',
    'category.add',
    'category.update',
    'category.delete',
    'drawer.update',
    'layout.setName',
    'layout.setPrintBedSize',
    'layout.setGridUnitMm',
    'layout.setHeightUnitMm',
    'layout.setBaseplateParams',
  ];

  it('has schemas for all original domain command types', () => {
    for (const type of ALL_COMMAND_TYPES) {
      expect(COMMAND_SCHEMAS[type], `Missing schema for ${type}`).toBeDefined();
    }
  });

  it('has exactly 34 schemas', () => {
    const registeredCount = Object.keys(COMMAND_SCHEMAS).length;
    expect(registeredCount).toBe(34);
  });
});

describe('getCommandSchema', () => {
  it('returns a schema for known command types', () => {
    expect(getCommandSchema('bin.add')).toBeDefined();
    expect(getCommandSchema('layer.delete')).toBeDefined();
  });

  it('returns undefined for unknown command types', () => {
    expect(getCommandSchema('unknown.command')).toBeUndefined();
  });
});

// === Bin command schemas ===

describe('bin.add schema', () => {
  const schema = getCommandSchema('bin.add');

  it('accepts valid payload', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: 0,
      y: 0,
      width: 2,
      depth: 3,
      height: 3,
      category: 'cat-1',
      label: 'Tools',
      notes: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts payload with optional fields', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: 1.5,
      y: 2.5,
      width: 1,
      depth: 1,
      height: 2,
      category: 'cat-1',
      label: '',
      notes: 'some notes',
      clearanceHeight: 1,
      customProperties: { color: 'red' },
      linkedDesignId: 'design-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative coordinates', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: -1,
      y: 0,
      width: 1,
      depth: 1,
      height: 2,
      category: 'cat-1',
      label: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero-width bins', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: 0,
      y: 0,
      width: 0,
      depth: 1,
      height: 2,
      category: 'cat-1',
      label: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects width exceeding GRID_MAX', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: 0,
      y: 0,
      width: 51,
      depth: 1,
      height: 2,
      category: 'cat-1',
      label: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects height below MIN_BIN_HEIGHT', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 1,
      category: 'cat-1',
      label: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = z.safeParse(schema, { layerId: 'layer-1' });
    expect(result.success).toBe(false);
  });

  it('rejects labels exceeding max length', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 2,
      category: 'cat-1',
      label: 'a'.repeat(25),
      notes: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty layerId', () => {
    const result = z.safeParse(schema, {
      layerId: '',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 2,
      category: 'cat-1',
      label: '',
      notes: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('bin.update schema', () => {
  const schema = getCommandSchema('bin.update');

  it('accepts valid partial update', () => {
    const result = z.safeParse(schema, {
      id: 'bin-1',
      updates: { label: 'New label' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty updates', () => {
    const result = z.safeParse(schema, {
      id: 'bin-1',
      updates: {},
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const result = z.safeParse(schema, { updates: { label: 'hi' } });
    expect(result.success).toBe(false);
  });
});

describe('bin.deleteBatch schema', () => {
  const schema = getCommandSchema('bin.deleteBatch');

  it('accepts array with IDs', () => {
    const result = z.safeParse(schema, { ids: ['bin-1', 'bin-2'] });
    expect(result.success).toBe(true);
  });

  it('rejects empty array', () => {
    const result = z.safeParse(schema, { ids: [] });
    expect(result.success).toBe(false);
  });
});

describe('bin.moveFromStaging schema', () => {
  const schema = getCommandSchema('bin.moveFromStaging');

  it('accepts valid payload', () => {
    const result = z.safeParse(schema, {
      id: 'bin-1',
      layerId: 'layer-1',
      x: 3,
      y: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative x', () => {
    const result = z.safeParse(schema, {
      id: 'bin-1',
      layerId: 'layer-1',
      x: -1,
      y: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('bin.fillLayer schema', () => {
  const schema = getCommandSchema('bin.fillLayer');

  it('accepts valid payload', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      width: 1,
      depth: 1,
      categoryId: 'cat-1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional halfBinMode', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      width: 2,
      depth: 2,
      categoryId: 'cat-1',
      halfBinMode: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects halfBinMode as string', () => {
    const result = z.safeParse(schema, {
      layerId: 'layer-1',
      width: 2,
      depth: 2,
      categoryId: 'cat-1',
      halfBinMode: 'yes',
    });
    expect(result.success).toBe(false);
  });
});

// === Layer command schemas ===

describe('layer.add schema', () => {
  const schema = getCommandSchema('layer.add');

  it('accepts empty object', () => {
    const result = z.safeParse(schema, {});
    expect(result.success).toBe(true);
  });
});

describe('layer.update schema', () => {
  const schema = getCommandSchema('layer.update');

  it('accepts valid update', () => {
    const result = z.safeParse(schema, {
      id: 'layer-1',
      updates: { name: 'Bottom', height: 3 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects height below MIN_LAYER_HEIGHT', () => {
    const result = z.safeParse(schema, {
      id: 'layer-1',
      updates: { height: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe('layer.reorder schema', () => {
  const schema = getCommandSchema('layer.reorder');

  it('accepts valid indices', () => {
    const result = z.safeParse(schema, { fromIndex: 0, toIndex: 2 });
    expect(result.success).toBe(true);
  });

  it('rejects negative indices', () => {
    const result = z.safeParse(schema, { fromIndex: -1, toIndex: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer indices', () => {
    const result = z.safeParse(schema, { fromIndex: 0.5, toIndex: 1 });
    expect(result.success).toBe(false);
  });
});

// === Category command schemas ===

describe('category.add schema', () => {
  const schema = getCommandSchema('category.add');

  it('accepts valid payload', () => {
    const result = z.safeParse(schema, { name: 'Tools', color: '#ff0000' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = z.safeParse(schema, { name: '', color: '#ff0000' });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const result = z.safeParse(schema, { name: 'a'.repeat(25), color: '#ff0000' });
    expect(result.success).toBe(false);
  });
});

// === Drawer / layout command schemas ===

describe('drawer.update schema', () => {
  const schema = getCommandSchema('drawer.update');

  it('accepts partial update', () => {
    const result = z.safeParse(schema, { width: 10 });
    expect(result.success).toBe(true);
  });

  it('accepts empty update', () => {
    const result = z.safeParse(schema, {});
    expect(result.success).toBe(true);
  });

  it('accepts fractional edge values', () => {
    const result = z.safeParse(schema, {
      fractionalEdgeX: 'start',
      fractionalEdgeY: 'end',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid fractional edge', () => {
    const result = z.safeParse(schema, { fractionalEdgeX: 'middle' });
    expect(result.success).toBe(false);
  });

  it('rejects width below GRID_MIN', () => {
    const result = z.safeParse(schema, { width: 0.2 });
    expect(result.success).toBe(false);
  });

  it('rejects width above GRID_MAX', () => {
    const result = z.safeParse(schema, { width: 51 });
    expect(result.success).toBe(false);
  });
});

describe('layout.setName schema', () => {
  const schema = getCommandSchema('layout.setName');

  it('accepts valid name', () => {
    const result = z.safeParse(schema, { name: 'My Layout' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = z.safeParse(schema, { name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name exceeding max length', () => {
    const result = z.safeParse(schema, { name: 'a'.repeat(65) });
    expect(result.success).toBe(false);
  });
});

describe('layout.setPrintBedSize schema', () => {
  const schema = getCommandSchema('layout.setPrintBedSize');

  it('accepts valid size', () => {
    const result = z.safeParse(schema, { size: 256 });
    expect(result.success).toBe(true);
  });

  it('rejects zero size', () => {
    const result = z.safeParse(schema, { size: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative size', () => {
    const result = z.safeParse(schema, { size: -10 });
    expect(result.success).toBe(false);
  });
});

describe('layout.setBaseplateParams schema', () => {
  const schema = getCommandSchema('layout.setBaseplateParams');

  it('accepts valid params', () => {
    const result = z.safeParse(schema, {
      params: {
        magnetHoles: true,
        magnetDiameter: 6.5,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts params with optional fields', () => {
    const result = z.safeParse(schema, {
      params: {
        magnetHoles: false,
        magnetDiameter: 6.5,
        magnetDepth: 2,
        paddingLeft: 5,
        paddingRight: 5,
        paddingFront: 5,
        paddingBack: 5,
        connectorNubs: true,
        syncWithLayout: false,
        baseplateWidth: 10,
        baseplateDepth: 8,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects magnetDiameter below 0.5', () => {
    const result = z.safeParse(schema, {
      params: {
        magnetHoles: true,
        magnetDiameter: 0.1,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
      },
    });
    expect(result.success).toBe(false);
  });

  it('accepts lightweight, cornerRadius, and cornerRadii', () => {
    const result = z.safeParse(schema, {
      params: {
        magnetHoles: true,
        magnetDiameter: 6.5,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        lightweight: true,
        cornerRadius: 2.5,
        cornerRadii: { tl: 2.5, tr: 2.5, bl: 2.5, br: 2.5 },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative cornerRadius', () => {
    const result = z.safeParse(schema, {
      params: {
        magnetHoles: true,
        magnetDiameter: 6.5,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        cornerRadius: -1,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects cornerRadii missing a corner', () => {
    const result = z.safeParse(schema, {
      params: {
        magnetHoles: true,
        magnetDiameter: 6.5,
        magnetDepth: 2,
        paddingLeft: 0,
        paddingRight: 0,
        paddingFront: 0,
        paddingBack: 0,
        cornerRadii: { tl: 2, tr: 2, bl: 2 },
      },
    });
    expect(result.success).toBe(false);
  });
});
